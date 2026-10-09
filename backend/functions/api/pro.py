"""Installer app: the jobs, visits and record of one fixed demo installer.

There is no installer sign-in yet. Every request here acts as DEMO_INSTALLER_ID, and Cedar only lets that installer
see generation data, evidence and status for issues that belong to it. The bill and the household's contact details
are never part of any answer.
"""

import math
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

from . import homes, issues
from .authz import allowed
from .issues import DEMO_INSTALLER_ID, NOT_YET
from .store import DEMO_TIME_SCALE, TABLE, get, presign

PRINCIPAL = ("Pro", DEMO_INSTALLER_ID)
TERMINAL = ("fixed", "disputed", "escalation_draft", "no_data")
REPLIES = ("book_visit", "fixed_remotely", "not_system_issue", "late_reply")
DAY_SECONDS = 86400 / DEMO_TIME_SCALE  # one "day" of the response window, shortened in demo mode


def _issue(issue_id: str, action: str = "read"):
    """(issue, None) if the demo installer may act on it, else (None, (status, error))."""
    issue = get(f"ISSUE#{issue_id}")
    if issue is None:
        return None, (404, {"error": "job not found"})
    if not allowed(PRINCIPAL, action, "issue", issue=issue_id, installer=issue.get("installerId", DEMO_INSTALLER_ID)):
        return None, (403, {"error": "not allowed"})
    return issue, None


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def state_of(issue: dict) -> tuple[str, bool]:
    """(state, overdue). States match the app: new | visit | check | fixed | closed."""
    st = issue["status"]
    if st in ("sent", "reopened"):
        return "new", False
    if st == "escalation_draft":  # the window closed with no reply; a late reply is still recorded
        return "new", True
    if st == "visit_booked":
        return ("check" if issue.get("visitDone") else "visit"), False
    if st in ("fixed_remotely", "fix_failed"):  # fix_failed: the home owner is deciding what to do next
        return "check", False
    if st == "fixed":
        return "fixed", False
    return "closed", False  # disputed, no_data


def days_left(issue: dict, now: datetime) -> int:
    """Whole days left to reply, counted in the (possibly shortened) window. Negative once the window has closed."""
    x = (_parse(issue["deadline"]) - now).total_seconds() / DAY_SECONDS
    return math.ceil(x) if x >= 0 else -math.ceil(-x)


def reply_days(issue: dict) -> float | None:
    """How long the installer took to reply, in window days."""
    created = _parse(issue["created"])
    for e in issue.get("timeline", []):
        if e["event"] in REPLIES:
            return round(max((_parse(e["at"]) - created).total_seconds() / DAY_SECONDS, 0.0), 1)
    return None


def _check_day(issue: dict) -> int:
    fix_after = issue.get("fixAfter") or ""
    if not fix_after or fix_after == NOT_YET:
        return 0
    r = homes.readings(issue["homeId"], 30)
    return min(7, sum(1 for d in r.index if str(d.date()) > fix_after)) if len(r) else 0


def _weeks(issue: dict) -> int:
    days = (datetime.fromisoformat(issue["periodEnd"]) - datetime.fromisoformat(issue["periodStart"])).days + 1
    return max(1, round(days / 7))


def job_of(issue: dict, meta: dict, now: datetime) -> dict:
    state, overdue = state_of(issue)
    rec = issue.get("recovered")
    return {
        "issueId": issue["issueId"], "homeId": issue["homeId"], "name": meta.get("name") or "Home", "kw": meta.get("kw"),
        "city": meta.get("city", "Delhi"), "state": state, "overdue": overdue, "status": issue["status"],
        "daysLeft": days_left(issue, now) if state == "new" else None, "deadlineText": issue["deadlineText"],
        "pctBelow": issue.get("pctBelow", 0), "weeks": _weeks(issue), "unitsLost": round(issue["unitsLost"]),
        "visit": issue.get("visit") if state in ("visit", "check") and issue.get("visit", {}).get("date") else None,
        "day": 7 if state == "fixed" else (_check_day(issue) if state == "check" else 0),
        "recovered": rec, "replyDays": reply_days(issue), "created": issue["created"],
        "reopened": issue["status"] == "reopened", "fixFailed": issue["status"] == "fix_failed",
        "trip": (issue.get("trip") or {}).get("stage") if state == "visit" else None,
    }


def _jobs():
    rows = TABLE.query(KeyConditionExpression=Key("PK").eq(f"PRO#{DEMO_INSTALLER_ID}"))["Items"]
    for r in rows:
        issue, err = _issue(r["SK"])
        if issue:
            yield issue


def list_jobs():
    now = datetime.now(timezone.utc)
    jobs = [job_of(i, get(f"HOME#{i['homeId']}") or {}, now) for i in _jobs()]
    return 200, {"installer": DEMO_INSTALLER_ID, "jobs": sorted(jobs, key=lambda j: j["created"], reverse=True)}


def get_job(issue_id: str):
    issue, err = _issue(issue_id)
    if err:
        return err
    if not all(allowed(PRINCIPAL, "read", k, issue=issue_id, installer=issue.get("installerId", DEMO_INSTALLER_ID))
               for k in ("generation", "evidence", "issue")):
        return 403, {"error": "not allowed"}
    meta = get(f"HOME#{issue['homeId']}") or {}
    job = job_of(issue, meta, datetime.now(timezone.utc))
    v = homes.verdict_for(issue["homeId"], 45)
    # Deliberately NOT included: bill data and the household's contact details.
    job.update({"summary": issue["summary"], "likelyCause": issue["cause"],
                "period": {"start": issue["periodStart"], "end": issue["periodEnd"]}, "co2Kg": issue["co2Kg"],
                "daily": v["daily"], "chartUrl": presign(issue["evidenceKey"]), "timeline": issue.get("timeline", []),
                "isDemo": bool(meta.get("isDemo"))})
    return 200, job


def respond(issue_id: str, body: dict):
    issue, err = _issue(issue_id, "respond")
    if err:
        return err
    return issues.apply_reply(issue, body, PRINCIPAL)


def visit_done(issue_id: str):
    issue, err = _issue(issue_id, "respond")
    if err:
        return err
    return issues.mark_visit_done(issue, PRINCIPAL)


def trip(issue_id: str, body: dict):
    issue, err = _issue(issue_id, "respond")
    if err:
        return err
    return issues.set_trip(issue, str(body.get("step") or ""), PRINCIPAL)


def record():
    """Closed jobs behind the Record tab. `fixed` is true only when output really came back (verified, not claimed)."""
    if not allowed(PRINCIPAL, "read", "record", installer=DEMO_INSTALLER_ID):
        return 403, {"error": "not allowed"}
    rows = []
    for issue in _jobs():
        if issue["status"] not in TERMINAL:
            continue
        meta = get(f"HOME#{issue['homeId']}") or {}
        rec = issue.get("recovered") or {}
        rows.append({"issueId": issue["issueId"], "name": meta.get("name") or "Home", "city": meta.get("city", "Delhi"),
                     "closedAt": (issue.get("timeline") or [{"at": issue["created"]}])[-1]["at"],
                     "fixed": issue["status"] == "fixed", "unitsRecovered": rec.get("kwh", 0),
                     "co2Kg": rec.get("co2_kg", 0), "replyDays": reply_days(issue)})
    return 200, {"installer": DEMO_INSTALLER_ID, "rows": sorted(rows, key=lambda r: r["closedAt"], reverse=True)}
