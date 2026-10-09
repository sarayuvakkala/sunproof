"""Installer app backend: Cedar rules and job logic, with no AWS calls."""

import os
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

os.environ.setdefault("TABLE", "test-table")
os.environ.setdefault("BUCKET", "test-bucket")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-south-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")

from backend.functions.api import authz, handler, issues, pro  # noqa: E402

PRO = ("Pro", "demo-installer")
NOW = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)


# ---------- Cedar ----------

@pytest.mark.parametrize("kind", ["generation", "evidence", "issue"])
def test_pro_reads_own_jobs(kind):
    assert authz.allowed(PRO, "read", kind, issue="i1", installer="demo-installer")


def test_pro_reads_own_record():
    assert authz.allowed(PRO, "read", "record", installer="demo-installer")


@pytest.mark.parametrize("kind", ["generation", "evidence", "issue", "record"])
def test_pro_cannot_read_another_installers_data(kind):
    assert not authz.allowed(PRO, "read", kind, issue="i1", installer="someone-else")


@pytest.mark.parametrize("kind", ["bill", "household_contact"])
def test_pro_never_reads_bill_or_contact(kind):
    assert not authz.allowed(PRO, "read", kind, issue="i1", installer="demo-installer")


def test_pro_replies_only_to_own_issue():
    assert authz.allowed(PRO, "respond", "issue", issue="i1", installer="demo-installer")
    assert not authz.allowed(PRO, "respond", "issue", issue="i1", installer="someone-else")


def test_pro_cannot_send_issue_or_reply_on_other_kinds():
    assert not authz.allowed(PRO, "send_issue", "issue", home="h", issue="i1", installer="demo-installer",
                             context={"approved": True})
    assert not authz.allowed(PRO, "respond", "bill", issue="i1", installer="demo-installer")


def test_existing_rules_still_hold():
    assert not authz.allowed(("Installer", "i1"), "read", "bill", issue="i1")
    assert authz.allowed(("Installer", "i1"), "respond", "issue", issue="i1")
    assert not authz.allowed(("Household", "h"), "send_issue", "issue", home="h", context={"approved": False})
    assert authz.allowed(("Household", "h"), "send_issue", "issue", home="h", context={"approved": True})


# ---------- job logic ----------

def _issue(**kw):
    base = {"issueId": "i1", "homeId": "h1", "status": "sent", "created": "2026-10-06T12:00:00+00:00",
            "deadline": "2026-10-13T12:00:00+00:00", "deadlineText": "13 Oct", "unitsLost": 48.2, "pctBelow": 15,
            "periodStart": "2026-09-09", "periodEnd": "2026-10-08", "installerId": "demo-installer", "timeline": []}
    return {**base, **kw}


@pytest.mark.parametrize("status,done,expected", [
    ("sent", False, ("new", False)), ("reopened", False, ("new", False)), ("escalation_draft", False, ("new", True)),
    ("visit_booked", False, ("visit", False)), ("visit_booked", True, ("check", False)),
    ("fixed_remotely", False, ("check", False)), ("fixed", False, ("fixed", False)),
    ("disputed", False, ("closed", False)), ("no_data", False, ("closed", False)),
])
def test_state_mapping(status, done, expected):
    assert pro.state_of(_issue(status=status, visitDone=done)) == expected


def test_days_left_counts_down_then_goes_negative(monkeypatch):
    monkeypatch.setattr(pro, "DAY_SECONDS", 86400)
    assert pro.days_left(_issue(), NOW) == 4
    assert pro.days_left(_issue(deadline="2026-10-08T12:00:00+00:00"), NOW) == -1


def test_reply_days(monkeypatch):
    monkeypatch.setattr(pro, "DAY_SECONDS", 86400)
    tl = [{"at": "2026-10-06T12:00:00+00:00", "event": "created"}, {"at": "2026-10-07T12:00:00+00:00", "event": "book_visit"}]
    assert pro.reply_days(_issue(timeline=tl)) == 1.0
    assert pro.reply_days(_issue()) is None


def test_job_hides_bill_and_contact(monkeypatch):
    issue = _issue(summary="s", cause="c", co2Kg=3.0, evidenceKey="k", timeline=[])
    monkeypatch.setattr(pro, "get", lambda pk, sk="META": issue if pk.startswith("ISSUE#") else {"name": "Sharma ji", "kw": 3, "isDemo": True,
                                                                                                   "tariff": 8, "phone": "999", "installer_email": "x@y"})
    monkeypatch.setattr(pro.homes, "verdict_for", lambda *_a, **_k: {"daily": []})
    monkeypatch.setattr(pro, "presign", lambda k: "https://example/chart.png")
    status, job = pro.get_job("i1")
    assert status == 200 and job["name"] == "Sharma ji" and job["state"] == "new"
    flat = str(job).lower()
    assert "999" not in flat and "x@y" not in flat and "tariff" not in flat and "bill" not in flat


def test_job_of_another_installer_is_forbidden(monkeypatch):
    monkeypatch.setattr(pro, "get", lambda pk, sk="META": _issue(installerId="someone-else"))
    assert pro.get_job("i1")[0] == 403
    assert pro.visit_done("i1")[0] == 403
    assert pro.respond("i1", {"action": "book_visit"})[0] == 403


def test_missing_job_is_404(monkeypatch):
    monkeypatch.setattr(pro, "get", lambda pk, sk="META": None)
    assert pro.get_job("nope")[0] == 404


# ---------- replies ----------

class _Sfn:
    class exceptions:
        class TaskTimedOut(Exception): ...
        class TaskDoesNotExist(Exception): ...
        class InvalidToken(Exception): ...

    def __init__(self):
        self.sent = []

    def send_task_success(self, **kw):
        self.sent.append(kw)


@pytest.fixture
def rec(monkeypatch):
    calls = {"update": [], "event": []}
    monkeypatch.setattr(issues, "_update", lambda iid, **f: calls["update"].append(f))
    monkeypatch.setattr(issues, "_event", lambda iid, ev, note="", status=None: calls["event"].append((ev, status)))
    monkeypatch.setattr(issues.homes, "readings", lambda *_a, **_k: pd.DataFrame({"actual_kwh": [1.0]}, index=pd.to_datetime(["2026-10-08"])))
    monkeypatch.setattr(issues, "sfn", _Sfn())
    return calls


def test_pro_booking_holds_the_fix_check_until_visit_done(rec):
    issue = _issue(waitToken="tok")
    out = issues.apply_reply(issue, {"action": "book_visit", "visit_date": "2026-10-12", "visit_time": "11:00"}, PRO)
    assert out == (200, {"ok": True, "status": "visit_booked"})
    fields = rec["update"][0]
    assert fields["fixAfter"] == issues.NOT_YET and fields["visit"] == {"date": "2026-10-12", "time": "11:00"}
    assert rec["event"][0] == ("book_visit", "visit_booked")


def test_installer_link_booking_keeps_the_old_behaviour(rec):
    issue = _issue(waitToken="tok")
    issues.apply_reply(issue, {"action": "book_visit", "visit_date": "2026-10-12"}, ("Installer", "i1"))
    assert rec["update"][0] == {"fixAfter": "2026-10-08", "waitToken": None, "failedDay": None, "failedPct": None}


def test_remote_fix_starts_the_check_now(rec):
    issues.apply_reply(_issue(waitToken="tok"), {"action": "fixed_remotely"}, PRO)
    assert rec["update"][0]["fixAfter"] == "2026-10-08" and rec["update"][0]["visitDone"] is True


def test_unknown_action_and_late_reply(rec):
    assert issues.apply_reply(_issue(waitToken="t"), {"action": "x"}, PRO)[0] == 400
    out = issues.apply_reply(_issue(status="fixed", waitToken=None), {"action": "book_visit"}, PRO)
    assert out == (200, {"ok": True, "late": True}) and rec["event"][0][0] == "late_reply"


def test_visit_done_starts_the_check_from_the_latest_reading(rec):
    out = issues.mark_visit_done(_issue(status="visit_booked", visitDone=False), PRO)
    assert out[0] == 200
    assert rec["update"][0] == {"fixAfter": "2026-10-08", "visitDone": True}
    assert rec["event"][0][0] == "visit_done"


def test_visit_done_needs_a_booked_visit(rec):
    assert issues.mark_visit_done(_issue(status="sent"), PRO)[0] == 409
    assert issues.mark_visit_done(_issue(status="visit_booked", visitDone=True), PRO)[0] == 409
    assert rec["update"] == []


# ---------- record and routes ----------

def test_record_lists_only_closed_jobs(monkeypatch):
    done = _issue(issueId="a", status="fixed", recovered={"kwh": 20.0, "rupees": 160, "co2_kg": 14.1},
                  timeline=[{"at": "2026-10-08T00:00:00+00:00", "event": "fixed"}])
    open_ = _issue(issueId="b", status="sent")
    no = _issue(issueId="c", status="disputed", timeline=[{"at": "2026-10-07T00:00:00+00:00", "event": "not_system_issue"}])
    monkeypatch.setattr(pro, "_jobs", lambda: iter([done, open_, no]))
    monkeypatch.setattr(pro, "get", lambda pk, sk="META": {"name": "Home", "city": "Noida"})
    status, body = pro.record()
    assert status == 200
    assert [r["issueId"] for r in body["rows"]] == ["a", "c"]
    assert body["rows"][0]["fixed"] and body["rows"][0]["unitsRecovered"] == 20.0
    assert not body["rows"][1]["fixed"] and body["rows"][1]["unitsRecovered"] == 0


def test_routes(monkeypatch):
    monkeypatch.setattr(pro, "list_jobs", lambda: (200, {"jobs": []}))
    monkeypatch.setattr(pro, "visit_done", lambda i: (200, {"id": i}))
    monkeypatch.setattr(pro, "respond", lambda i, b: (200, {"id": i, "b": b}))
    assert handler.route("GET", "/pro/jobs", {}, {})["statusCode"] == 200
    assert '"x1"' in handler.route("POST", "/pro/jobs/x1/visit-done", {}, {})["body"]
    assert '"book_visit"' in handler.route("POST", "/pro/jobs/x1/respond", {}, {"action": "book_visit"})["body"]
    assert handler.route("DELETE", "/pro/jobs", {}, {})["statusCode"] == 404


def test_timing_gives_the_fix_check_time_after_a_visit():
    assert issues._timing()["verify"] >= 3 * issues._timing()["window"]


# ---------- no email: the installer app is the only way the issue reaches the installer ----------

def test_notify_and_remind_only_record_events(monkeypatch):
    events = []
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": _issue(installerName="Test installer", homeId="h1"))
    monkeypatch.setattr(issues, "_update", lambda iid, **f: None)
    monkeypatch.setattr(issues, "_event", lambda iid, ev, note="", status=None: events.append((ev, note)))
    assert issues.run_task({"task": "notify", "issueId": "i1", "taskToken": "t", "reopened": False}) == {"ok": True}
    assert issues.run_task({"task": "remind", "issueId": "i1"}) == {"ok": True}
    assert [e[0] for e in events] == ["sent_to_app", "reminder"]
    assert "installer app" in events[0][1]
    assert not hasattr(issues, "mail")


def test_reopened_notify_says_so(monkeypatch):
    events = []
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": _issue(installerName="T"))
    monkeypatch.setattr(issues, "_update", lambda iid, **f: None)
    monkeypatch.setattr(issues, "_event", lambda iid, ev, note="", status=None: events.append(note))
    issues.run_task({"task": "notify", "issueId": "i1", "taskToken": "t", "reopened": True})
    assert "open again" in events[0]


# ---------- live visit progress (installer app -> household) ----------

def test_trip_steps_are_recorded_for_a_booked_visit(rec):
    issue = _issue(status="visit_booked", visitDone=False)
    assert issues.set_trip(issue, "on_the_way", PRO) == (200, {"ok": True, "trip": "on_the_way"})
    assert rec["update"][0]["trip"]["stage"] == "on_the_way"
    assert issues.set_trip(issue, "arrived", PRO)[0] == 200
    assert [e[0] for e in rec["event"]] == ["on_the_way", "arrived"]


def test_trip_needs_a_booked_visit_and_a_known_step(rec):
    assert issues.set_trip(_issue(status="visit_booked"), "flying", PRO)[0] == 400
    assert issues.set_trip(_issue(status="sent"), "arrived", PRO)[0] == 409
    assert issues.set_trip(_issue(status="visit_booked", visitDone=True), "arrived", PRO)[0] == 409
    assert issues.set_trip(_issue(status="visit_booked", installerId="someone-else"), "arrived", PRO)[0] == 403
    assert rec["update"] == []


def test_household_sees_the_visit_progress(monkeypatch):
    issue = _issue(status="visit_booked", visitDone=False, visit={"date": "2026-10-10", "time": "11:00"},
                   trip={"stage": "arrived", "at": "2026-10-10T05:30:00+00:00"}, deadlineText="x", installerName="T",
                   summary="s", link="l", evidenceKey="k")
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": issue)
    monkeypatch.setattr(issues, "presign", lambda k: "u")
    status, view = issues.issue_view("i1", "h1")
    assert status == 200
    assert view["visit"] == {"date": "2026-10-10", "time": "11:00"} and view["visitDone"] is False
    assert view["trip"]["stage"] == "arrived"


def test_old_link_booking_reports_no_visit_progress(monkeypatch):
    issue = _issue(status="visit_booked", deadlineText="x", installerName="T", summary="s", link="l", evidenceKey="k")
    monkeypatch.setattr(issues, "get", lambda pk, sk="META": issue)
    monkeypatch.setattr(issues, "presign", lambda k: "u")
    view = issues.issue_view("i1", "h1")[1]
    assert view["visitDone"] is None and view["trip"] is None


def test_job_carries_the_trip_only_while_a_visit_is_waiting():
    meta = {"name": "Home", "kw": 3}
    on = pro.job_of(_issue(status="visit_booked", visitDone=False, trip={"stage": "on_the_way"}), meta, NOW)
    done = pro.job_of(_issue(status="visit_booked", visitDone=True, trip={"stage": "arrived"}), meta, NOW)
    assert on["trip"] == "on_the_way" and done["trip"] is None


def test_trip_route(monkeypatch):
    monkeypatch.setattr(pro, "trip", lambda i, b: (200, {"id": i, "step": b.get("step")}))
    assert '"arrived"' in handler.route("POST", "/pro/jobs/x1/trip", {}, {"step": "arrived"})["body"]
