"""The 7-day fix check, day by day: a fix that holds, one that fails after a while, and the revisit that follows."""

import os

os.environ.setdefault("TABLE", "test-table")
os.environ.setdefault("BUCKET", "test-bucket")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-south-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")

from pathlib import Path  # noqa: E402

import pandas as pd  # noqa: E402

from backend.functions.api import homes, issues  # noqa: E402
from engine import constants as C  # noqa: E402
from engine.verify_fix import day_results, verify  # noqa: E402


def _daily(actuals, start="2026-10-10"):
    return [{"date": str((pd.Timestamp(start) + pd.Timedelta(i, "D")).date()), "p10": 9.0, "p50": 10.0, "actual": a, "flag": None}
            for i, a in enumerate(actuals)]


FIX_AFTER = "2026-10-09"
DATA = Path(__file__).resolve().parent.parent.parent / "data"  # in the Lambda image this sits next to the api package


def test_days_arrive_one_at_a_time_and_stay_pending_until_day_seven():
    for n in range(1, 7):
        assert verify(_daily([10.0] * n), FIX_AFTER)["result"] == "pending"
    assert verify(_daily([10.0] * 7), FIX_AFTER)["result"] == "fixed"


def test_a_fix_that_fails_after_a_while_is_a_relapse():
    r = verify(_daily([10, 10, 10, 10, 7.5, 7.5]), FIX_AFTER)
    assert r["result"] == "relapse" and r["failed_day"] == 5 and r["pct_below"] == 25


def test_one_bad_day_is_not_a_relapse():
    assert verify(_daily([10, 10, 10, 10, 7.5, 10]), FIX_AFTER)["result"] == "pending"


def test_output_that_never_came_back_still_reopens():
    assert verify(_daily([7.5, 7.5]), FIX_AFTER)["result"] == "reopen"


def test_day_results_mark_each_day_inside_or_outside_the_range():
    assert day_results(_daily([10, 10, 7.5, 10]), FIX_AFTER) == [
        {"day": 1, "ok": True}, {"day": 2, "ok": True}, {"day": 3, "ok": False}, {"day": 4, "ok": True}]
    assert len(day_results(_daily([10] * 9), FIX_AFTER)) == 7


def test_mehta_ji_repair_holds_for_four_days_then_falls(monkeypatch):
    monkeypatch.setattr(homes, "DATA", DATA)
    written = []
    meta = homes.DEMO_HOMES["demo-mehta"][2] | {"kw": 4.0}
    monkeypatch.setattr(homes, "readings", lambda hid, days=60: pd.DataFrame({"x": [1]}, index=pd.to_datetime(["2026-10-09"])))
    monkeypatch.setattr(homes, "write_readings", lambda hid, df, replay=False: written.append(float(df["actual_kwh"].iloc[0])))
    for day in range(1, 8):
        homes.replay_next_day("demo-mehta", meta, day)
    base = [b * 4 / 3 for b in pd.read_csv(DATA / "demo_household.csv").tail(7)["actual_kwh"]]
    assert [round(w, 3) for w in written[:4]] == [round(b, 3) for b in base[:4]]
    assert [round(w, 3) for w in written[4:]] == [round(b * 0.8, 3) for b in base[4:]]


def test_sharma_ji_repair_holds_every_day(monkeypatch):
    monkeypatch.setattr(homes, "DATA", DATA)
    written = []
    monkeypatch.setattr(homes, "readings", lambda hid, days=60: pd.DataFrame({"x": [1]}, index=pd.to_datetime(["2026-10-09"])))
    monkeypatch.setattr(homes, "write_readings", lambda hid, df, replay=False: written.append(float(df["actual_kwh"].iloc[0])))
    base = pd.read_csv(DATA / "demo_household.csv").tail(7)["actual_kwh"].tolist()
    for day in range(1, 8):
        homes.replay_next_day("demo-sharma", {"kw": 3.0}, day)
    assert [round(w, 3) for w in written] == [round(b, 3) for b in base]


# ---------- revisit ----------

def _failed(**kw):
    return {"issueId": "i1", "homeId": "demo-mehta", "status": "fix_failed", "fixToken": "tok", **kw}


def test_revisit_reopens_the_issue_with_the_installer(monkeypatch):
    events, sent = [], []
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": _failed())
    monkeypatch.setattr(issues, "_update", lambda iid, **f: None)
    monkeypatch.setattr(issues, "_event", lambda iid, ev, note="", status=None: events.append((ev, status)))
    monkeypatch.setattr(issues.sfn, "send_task_success", lambda **k: sent.append(k["output"]))
    assert issues.revisit("i1", "demo-mehta") == (200, {"ok": True, "status": "reopened"})
    assert events == [("reopened", "reopened")] and '"reopen"' in sent[0]


def test_revisit_only_after_a_failed_fix(monkeypatch):
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": _failed(status="fixed_remotely"))
    assert issues.revisit("i1", "demo-mehta")[0] == 409


def test_revisit_belongs_to_the_household_of_that_home(monkeypatch):
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": _failed())
    assert issues.revisit("i1", "demo-sharma")[0] == 403


def test_advance_day_needs_a_running_check(monkeypatch):
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": {"isDemo": True, "homeId": "h", "fixToken": None, "status": "sent"})
    assert issues.demo_advance_day("i1")[0] == 409


# ---------- cleaning clears it ----------

def _cleaning_stubs(monkeypatch, issue):
    calls = {"put": [], "update": [], "event": [], "sent": [], "closed": []}
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": issue if pk.startswith("ISSUE#") else {"isDemo": True, "tariff": 8})
    monkeypatch.setattr(homes, "clean_or_skip", lambda hid, scenario=None: {"rupees_per_month": 348.0})
    monkeypatch.setattr(issues, "put", lambda item: calls["put"].append(item))
    monkeypatch.setattr(issues, "_update", lambda iid, **f: calls["update"].append(f))
    monkeypatch.setattr(issues, "_event", lambda iid, ev, note="", status=None: calls["event"].append((ev, status)))
    monkeypatch.setattr(issues, "_close", lambda i: calls["closed"].append(i["issueId"]))
    monkeypatch.setattr(issues.sfn, "send_task_success", lambda **k: calls["sent"].append(k["output"]))
    return calls


def test_cleaning_after_a_failed_fix_makes_it_fixed(monkeypatch):
    calls = _cleaning_stubs(monkeypatch, _failed())
    code, body = issues.cleaned("i1", "demo-mehta")
    assert code == 200 and body["status"] == "fixed"
    assert body["recovered"] == {"kwh": 43.5, "rupees": 348, "co2_kg": round(43.5 * C.CO2_KG_PER_KWH, 1), "by": "cleaning"}
    assert calls["event"] == [("cleaned", "fixed")] and calls["closed"] == ["i1"]
    assert calls["put"][0]["PK"] == "LEDGER" and '"fixed"' in calls["sent"][0]


def test_cleaning_after_not_the_system_makes_it_fixed(monkeypatch):
    calls = _cleaning_stubs(monkeypatch, _failed(status="disputed", fixToken=None))
    assert issues.cleaned("i1", "demo-mehta")[0] == 200
    assert calls["sent"] == [] and calls["event"] == [("cleaned", "fixed")]


def test_cleaning_does_not_touch_other_states(monkeypatch):
    _cleaning_stubs(monkeypatch, _failed(status="sent"))
    assert issues.cleaned("i1", "demo-mehta")[0] == 409
    _cleaning_stubs(monkeypatch, _failed())
    assert issues.cleaned("i1", "demo-sharma")[0] == 403


def test_a_day_does_not_land_twice_when_two_pages_drive_the_clock(monkeypatch):
    from datetime import datetime, timezone
    recent = datetime.now(timezone.utc).isoformat()
    issue = {"isDemo": True, "homeId": "demo-sharma", "fixToken": "t", "fixAfter": "2026-10-09", "status": "fixed_remotely", "lastAdvanceAt": recent}
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": issue if pk.startswith("ISSUE#") else {"isDemo": True})
    assert issues.demo_advance_day("i1") == (200, {"result": "pending", "skipped": True})
