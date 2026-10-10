"""Issue lifecycle: send to installer, wait for a reply, remind, escalate, verify the fix."""

import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pandas as pd
from boto3.dynamodb.conditions import Key

from engine import constants as C
from engine.evidence import render
from engine.verify_fix import day_results, verify

from . import homes
from .authz import allowed
from .store import (APP_URL, BUCKET, DEMO_TIME_SCALE, RESPONSE_DAYS, STATE_MACHINE_ARN, TABLE, from_dynamo, get,
                    now_iso, presign, put, s3, sfn, to_dynamo)

IST = timezone(timedelta(hours=5, minutes=30))
ACTIONS = {"book_visit": "visit_booked", "fixed_remotely": "fixed_remotely", "not_system_issue": "disputed"}
DEMO_INSTALLER_ID = "demo-installer"  # the one fixed installer behind the installer app until real sign-in exists
NOT_YET = "9999-12-31"  # fixAfter while a booked visit has not happened: the 7-day check cannot start


# ---------- small helpers ----------

def _timing() -> dict:
    window = max(int(RESPONSE_DAYS * 86400 / DEMO_TIME_SCALE), 20)
    # The fix check starts after the visit, which can be days away, so it gets three weeks to finish.
    return {"window": window, "half": window // 2, "verify": max(int(21 * 86400 / DEMO_TIME_SCALE), 20)}


def _fmt(dt: datetime) -> str:
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")


def _update(issue_id: str, **fields):
    names = {f"#{k}": k for k in fields}
    vals = {f":{k}": to_dynamo(v) for k, v in fields.items()}
    TABLE.update_item(Key={"PK": f"ISSUE#{issue_id}", "SK": "META"},
                      UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
                      ExpressionAttributeNames=names, ExpressionAttributeValues=vals)


def _event(issue_id: str, event: str, note: str = "", status: str | None = None):
    names, vals = {"#t": "timeline"}, {":e": [to_dynamo({"at": now_iso(), "event": event, "note": note})], ":empty": []}
    expr = "SET #t = list_append(if_not_exists(#t, :empty), :e)"
    if status:
        expr += ", #s = :s"
        names["#s"], vals[":s"] = "status", status
    TABLE.update_item(Key={"PK": f"ISSUE#{issue_id}", "SK": "META"}, UpdateExpression=expr,
                      ExpressionAttributeNames=names, ExpressionAttributeValues=vals)


def _close(issue: dict):
    TABLE.delete_item(Key={"PK": "OPEN_ISSUES", "SK": issue["issueId"]})
    TABLE.update_item(Key={"PK": f"HOME#{issue['homeId']}", "SK": "META"},
                      UpdateExpression="SET active_issue = :n", ExpressionAttributeValues={":n": None})


def _cause(v: dict) -> tuple[str, str]:
    """(plain summary, likely cause). Worded as 'worth checking', never as an accusation."""
    days = sum(1 for d in v["daily"] if d["flag"] == "trip")
    if v["status"] == "trip":
        return (f"Output looks to have stopped on {days} day(s), about {v['units_lost']:.0f} units short of expected.",
                "An inverter trip, a tripped breaker or a grid outage is a likely cause. Worth checking the inverter.")
    pct = 100 * v["units_lost"] / max(sum(d["p50"] for d in v["daily"] if d["flag"]), 1)
    return (f"Output has run about {pct:.0f}% below the expected range, about {v['units_lost']:.0f} units short.",
            "A steady shortfall like this can point to a wiring, string or inverter problem, or new shading. "
            "Worth an on-site check.")


# ---------- household side ----------

def start_issue(home_id: str, approved: bool):
    if not allowed(("Household", home_id), "send_issue", "issue", home=home_id, context={"approved": bool(approved)}):
        return 403, {"error": "The household must approve before anything is sent."}
    meta = get(f"HOME#{home_id}")
    if meta is None:
        return 404, {"error": "home not found"}
    if meta.get("active_issue"):
        return 409, {"error": "An issue is already open for this home.", "issueId": meta["active_issue"]}
    v = homes.verdict_for(home_id)
    if v["status"] not in ("shortfall", "trip"):
        return 409, {"error": "Nothing worth sending: the check does not point at the system "
                              "(it looks fine, or like dust). See Clean or skip first."}

    issue_id, token, t = uuid.uuid4().hex[:10], secrets.token_urlsafe(16), _timing()
    deadline = datetime.now(timezone.utc) + timedelta(seconds=t["window"])
    summary, cause = _cause(v)
    png = render(pd.DataFrame(v["daily"]), f"{meta.get('name', 'Home')}: expected vs actual")
    chart_key = f"evidence/{issue_id}/chart.png"
    s3.put_object(Bucket=BUCKET, Key=chart_key, Body=png, ContentType="image/png")

    installer_id = meta.get("installer_id", DEMO_INSTALLER_ID)
    pct = v.get("pct_below") or (round(100 * (1 - v["ratio"])) if v.get("ratio") else 0)
    link = f"{APP_URL}/r/{token}"
    put({"PK": f"ISSUE#{issue_id}", "SK": "META", "issueId": issue_id, "homeId": home_id, "status": "sent",
         "created": now_iso(), "deadline": deadline.isoformat(timespec="seconds"), "deadlineText": _fmt(deadline),
         "token": token, "link": link, "summary": summary, "cause": cause, "evidenceKey": chart_key,
         "unitsLost": v["units_lost"], "rupeesLost": v["rupees_lost"], "co2Kg": v["co2_kg"],
         "installerId": installer_id, "pctBelow": pct, "dropStart": v.get("drop_start"), "dropDays": v.get("drop_days", 0),
         "periodStart": v["period"]["start"], "periodEnd": v["period"]["end"],
         "timeline": [{"at": now_iso(), "event": "created", "note": "Household approved and sent the issue."}],
         "installerName": meta.get("installer_name", "Installer")})
    put({"PK": f"TOKEN#{token}", "SK": "META", "issueId": issue_id})
    put({"PK": "OPEN_ISSUES", "SK": issue_id})
    put({"PK": f"PRO#{installer_id}", "SK": issue_id})
    TABLE.update_item(Key={"PK": f"HOME#{home_id}", "SK": "META"}, UpdateExpression="SET active_issue = :i",
                      ExpressionAttributeValues={":i": issue_id})
    ex = sfn.start_execution(stateMachineArn=STATE_MACHINE_ARN, name=issue_id,
                             input=json.dumps({"issueId": issue_id, "reopened": False, "timing": t}))
    _update(issue_id, executionArn=ex["executionArn"])
    return 200, {"issueId": issue_id, "status": "sent", "deadlineText": _fmt(deadline), "installerLink": link}


def issue_view(issue_id: str, home_id: str):
    issue = get(f"ISSUE#{issue_id}")
    if issue is None:
        return 404, {"error": "issue not found"}
    if not allowed(("Household", home_id), "read", "issue", home=issue["homeId"]):
        return 403, {"error": "not allowed"}
    return 200, {
        "issueId": issue_id, "homeId": issue["homeId"], "status": issue["status"], "deadlineText": issue["deadlineText"],
        "installerName": issue["installerName"], "summary": issue["summary"], "timeline": issue.get("timeline", []),
        "recovered": issue.get("recovered"), "escalationDraft": issue.get("escalationDraft"),
        "installerLink": issue["link"], "chartUrl": presign(issue["evidenceKey"]),
        # Visit progress, so the household sees what the installer does as it happens. visitDone is None for a visit
        # booked through the old email-style link, which has no installer app to report progress.
        "visit": issue.get("visit"), "visitDone": issue.get("visitDone"), "trip": issue.get("trip"),
        # The 7-day check, one entry per day so far; failedDay/failedPct are set when the fix did not hold.
        "checkDays": _check_days(issue), "failedDay": issue.get("failedDay"), "failedPct": issue.get("failedPct"),
    }


def _check_days(issue: dict) -> list[dict]:
    fix_after = issue.get("fixAfter") or ""
    if not fix_after or fix_after == NOT_YET:
        return []
    return day_results(homes.verdict_for(issue["homeId"], 90)["daily"], fix_after)


def recovered_total():
    items = [from_dynamo(i) for i in TABLE.query(KeyConditionExpression=Key("PK").eq("LEDGER"))["Items"]]
    return {"kwh": round(sum(i["kwh"] for i in items), 1), "rupees": round(sum(i["rupees"] for i in items)),
            "co2_kg": round(sum(i["co2_kg"] for i in items), 1), "fixes": len(items),
            "assumptions": {"tariff_inr_per_kwh": C.DEFAULT_TARIFF_INR_PER_KWH, "co2_kg_per_kwh": C.CO2_KG_PER_KWH,
                            "co2_source": C.CO2_SOURCE}}


# ---------- installer side (no signup; the link is the key) ----------

def _issue_for_token(token: str):
    t = get(f"TOKEN#{token}")
    return get(f"ISSUE#{t['issueId']}") if t else None


def installer_view(token: str):
    issue = _issue_for_token(token)
    if issue is None:
        return 404, {"error": "This link is not valid."}
    p = ("Installer", issue["issueId"])
    if not all(allowed(p, "read", k, issue=issue["issueId"]) for k in ("generation", "evidence", "issue")):
        return 403, {"error": "not allowed"}
    meta = get(f"HOME#{issue['homeId']}")
    v = homes.verdict_for(issue["homeId"], 45)
    # Deliberately NOT included: bill data and the household's contact details.
    return 200, {
        "issueId": issue["issueId"], "status": issue["status"], "deadlineText": issue["deadlineText"],
        "system": {"kw": meta["kw"], "name": meta.get("name")},
        "summary": issue["summary"], "likelyCause": issue["cause"], "unitsLost": issue["unitsLost"],
        "co2Kg": issue["co2Kg"], "period": {"start": issue["periodStart"], "end": issue["periodEnd"]},
        "daily": v["daily"], "chartUrl": presign(issue["evidenceKey"]), "timeline": issue.get("timeline", []),
        "isDemo": bool(meta.get("isDemo")),
    }


def installer_bill(token: str):
    """There is no bill route for installers; Cedar refuses it. Kept so the rule is demonstrable."""
    issue = _issue_for_token(token)
    if issue is None:
        return 404, {"error": "This link is not valid."}
    if not allowed(("Installer", issue["issueId"]), "read", "bill", issue=issue["issueId"]):
        return 403, {"error": "Installers cannot see the household's bill."}
    return 404, {"error": "no bill"}


def respond(token: str, body: dict):
    issue = _issue_for_token(token)
    if issue is None:
        return 404, {"error": "This link is not valid."}
    return apply_reply(issue, body, ("Installer", issue["issueId"]))


def apply_reply(issue: dict, body: dict, principal: tuple[str, str]):
    """One reply to an issue, from the installer link (principal Installer) or the installer app (principal Pro)."""
    iid, action = issue["issueId"], body.get("action")
    if action not in ACTIONS:
        return 400, {"error": "unknown action"}
    if not allowed(principal, "respond", "issue", issue=iid, installer=issue.get("installerId", DEMO_INSTALLER_ID)):
        return 403, {"error": "not allowed"}

    note = str(body.get("note") or "")[:300]
    visit = str(body.get("visit_date") or "")[:10]
    vtime = str(body.get("visit_time") or "")[:5]
    when = f"{visit} {vtime}".strip()
    label = {"book_visit": f"Installer booked a visit{(' for ' + when) if when else ''}.",
             "fixed_remotely": "Installer says it was fixed remotely.",
             "not_system_issue": "Installer says this is not a system issue (dust or billing)."}[action]
    token_key = issue.get("waitToken")
    if issue["status"] in ("fixed", "disputed", "escalation_draft", "no_data") or not token_key:
        _event(iid, "late_reply", f"{label} (received after the response window.) {note}".strip())
        return 200, {"ok": True, "late": True}

    last = homes.readings(issue["homeId"], 1)
    fix_after = str(last.index.max().date()) if len(last) else ""
    fields = {"fixAfter": fix_after, "waitToken": None, "failedDay": None, "failedPct": None}
    if principal[0] == "Pro":
        # In the installer app a booked visit comes first; the 7-day check starts when the visit is marked done.
        if action == "book_visit":
            fields.update(fixAfter=NOT_YET, visit={"date": visit, "time": vtime}, visitDone=False)
        if action == "fixed_remotely":
            fields["visitDone"] = True
    _update(iid, **fields)
    _event(iid, action, f"{label} {note}".strip(), status=ACTIONS[action])
    try:
        sfn.send_task_success(taskToken=token_key, output=json.dumps({"action": action}))
    except sfn.exceptions.TaskTimedOut:
        _event(iid, "late_reply", "Reply arrived just after the window closed.")
        return 200, {"ok": True, "late": True}
    except (sfn.exceptions.TaskDoesNotExist, sfn.exceptions.InvalidToken):
        return 200, {"ok": True, "late": True}
    return 200, {"ok": True, "status": ACTIONS[action]}


TRIP_STEPS = {
    "on_the_way": "Installer is on the way to your home.",
    "arrived": "Installer has arrived at your home.",
}


def set_trip(issue: dict, step: str, principal: tuple[str, str]):
    """The installer reports progress on a booked visit: on the way, then arrived. The household sees it live."""
    iid = issue["issueId"]
    if step not in TRIP_STEPS:
        return 400, {"error": "unknown step"}
    if not allowed(principal, "respond", "issue", issue=iid, installer=issue.get("installerId", DEMO_INSTALLER_ID)):
        return 403, {"error": "not allowed"}
    if issue["status"] != "visit_booked" or issue.get("visitDone"):
        return 409, {"error": "There is no booked visit in progress."}
    _update(iid, trip={"stage": step, "at": now_iso()})
    _event(iid, step, TRIP_STEPS[step])
    return 200, {"ok": True, "trip": step}


def mark_visit_done(issue: dict, principal: tuple[str, str]):
    """The installer says the booked visit happened. The 7-day fix check now starts from the latest reading."""
    iid = issue["issueId"]
    if not allowed(principal, "respond", "issue", issue=iid, installer=issue.get("installerId", DEMO_INSTALLER_ID)):
        return 403, {"error": "not allowed"}
    if issue["status"] != "visit_booked" or issue.get("visitDone"):
        return 409, {"error": "There is no booked visit waiting to be marked done."}
    last = homes.readings(issue["homeId"], 1)
    _update(iid, fixAfter=str(last.index.max().date()) if len(last) else "", visitDone=True)
    _event(iid, "visit_done", "Installer marked the visit done. SunProof is checking the next 7 days of output.")
    return 200, {"ok": True, "status": "visit_booked", "visitDone": True}


# ---------- fix verification ----------

def check_fix(issue_id: str) -> dict:
    issue = get(f"ISSUE#{issue_id}")
    if not issue or not issue.get("fixToken"):
        return {"result": "not_waiting"}
    meta = get(f"HOME#{issue['homeId']}")
    v = homes.verdict_for(issue["homeId"], 90)
    res = verify(v["daily"], issue["fixAfter"], tariff=float(meta.get("tariff", 8)))
    if res["result"] == "pending":
        return res
    if res["result"] == "relapse":
        # It was back for a while, then fell again. The household chooses what to do next (clean, or ask for a revisit),
        # so the check stays open until they do.
        if issue["status"] != "fix_failed":
            n = res["failed_day"]
            _update(issue_id, failedDay=n, failedPct=res["pct_below"])
            _event(issue_id, "fix_failed", f"Output was back for {n - 1} day(s), then fell again on day {n}, about "
                   f"{res['pct_below']}% under expected.", status="fix_failed")
        return res

    if res["result"] == "fixed":
        rec = res["recovered"]
        put({"PK": "LEDGER", "SK": issue_id, "homeId": issue["homeId"], "at": now_iso(), **rec})
        _update(issue_id, recovered=rec)
        _event(issue_id, "fixed", f"Output is back in the expected range. Recovered {rec['kwh']} units "
               f"(₹{rec['rupees']}, {rec['co2_kg']} kg CO₂).", status="fixed")
        _close(issue)
    else:
        _event(issue_id, "reopened", "Output is still below the expected range after the fix. Reopened with the installer.",
               status="reopened")
    token_key = issue["fixToken"]
    _update(issue_id, fixToken=None)
    try:
        sfn.send_task_success(taskToken=token_key, output=json.dumps({"result": res["result"]}))
    except Exception:  # execution already finished
        pass
    return res


MIN_DAY_GAP_S = 8  # a day never lands sooner than this after the last one, unless the presenter taps for it


def demo_advance_day(issue_id: str, manual: bool = False):
    """Demo only: add one more day of readings after the fix (labelled REPLAY) and run the check. The household app calls
    this on a timer, or when the presenter taps 'next day', so the 7-day check unfolds a day at a time."""
    issue = get(f"ISSUE#{issue_id}")
    if not issue:
        return 404, {"error": "issue not found"}
    meta = get(f"HOME#{issue['homeId']}")
    if not meta.get("isDemo"):
        return 403, {"error": "replay is only available for demo homes"}
    fix_after = issue.get("fixAfter") or ""
    if not issue.get("fixToken") or not fix_after or fix_after == NOT_YET or issue["status"] == "fix_failed":
        return 409, {"error": "No fix check is running."}
    last = issue.get("lastAdvanceAt")
    if not manual and last and (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() < MIN_DAY_GAP_S:
        return 200, {"result": "pending", "skipped": True}  # another page already moved the clock on
    day = sum(1 for d in homes.readings(issue["homeId"], 30).index if str(d.date()) > fix_after) + 1
    _update(issue_id, lastAdvanceAt=now_iso())
    if day <= 7:
        homes.replay_next_day(issue["homeId"], meta, day)
        _event(issue_id, "replay", f"Demo: day {day} of 7 after the fix (labelled REPLAY).")
    return 200, check_fix(issue_id)


def revisit(issue_id: str, home_id: str):
    """The fix did not hold and the household asks the installer to come back: the issue is open with the installer again."""
    issue = get(f"ISSUE#{issue_id}")
    if issue is None:
        return 404, {"error": "issue not found"}
    if not allowed(("Household", home_id), "send_issue", "issue", home=issue["homeId"], context={"approved": True}):
        return 403, {"error": "not allowed"}
    if issue["status"] != "fix_failed" or not issue.get("fixToken"):
        return 409, {"error": "There is no failed fix to send back."}
    token_key = issue["fixToken"]
    _update(issue_id, fixToken=None)
    _event(issue_id, "reopened", "Household asked the installer to come back, with the new readings.", status="reopened")
    try:
        sfn.send_task_success(taskToken=token_key, output=json.dumps({"result": "reopen"}))
    except Exception:  # execution already finished
        pass
    return 200, {"ok": True, "status": "reopened"}


def cleaned(issue_id: str, home_id: str):
    """The household cleaned the panels after the fix did not hold (or after the installer said it is not the system).
    Dust was the cause, so the issue is fixed: the energy dust was costing is counted (an estimate, not a measurement),
    and the installer sees the job as fixed too."""
    issue = get(f"ISSUE#{issue_id}")
    if issue is None:
        return 404, {"error": "issue not found"}
    if not allowed(("Household", home_id), "send_issue", "issue", home=issue["homeId"], context={"approved": True}):
        return 403, {"error": "not allowed"}
    if issue["status"] not in ("fix_failed", "disputed"):
        return 409, {"error": "There is nothing to clear by cleaning."}
    meta = get(f"HOME#{issue['homeId']}") or {}
    d = homes.clean_or_skip(issue["homeId"], "dust" if meta.get("isDemo") else None)
    rupees = round(d["rupees_per_month"])
    kwh = round(rupees / float(meta.get("tariff", 8)), 1)
    rec = {"kwh": kwh, "rupees": rupees, "co2_kg": round(kwh * C.CO2_KG_PER_KWH, 1), "by": "cleaning"}
    put({"PK": "LEDGER", "SK": issue_id, "homeId": issue["homeId"], "at": now_iso(), **rec})
    _update(issue_id, recovered=rec)
    _event(issue_id, "cleaned", f"Panels cleaned and output is back. Estimated {kwh} units (₹{rupees}, {rec['co2_kg']} kg CO₂).",
           status="fixed")
    _close(issue)
    token_key = issue.get("fixToken")
    if token_key:  # the fix check was waiting for the household: it ends here
        _update(issue_id, fixToken=None)
        try:
            sfn.send_task_success(taskToken=token_key, output=json.dumps({"result": "fixed"}))
        except Exception:  # execution already finished
            pass
    return 200, {"ok": True, "status": "fixed", "recovered": rec}


def demo_replay_fix(issue_id: str, outcome: str):
    """Demo only: replay 8 days of 'after the fix' readings, labelled REPLAY, then run the check."""
    issue = get(f"ISSUE#{issue_id}")
    if not issue:
        return 404, {"error": "issue not found"}
    meta = get(f"HOME#{issue['homeId']}")
    if not meta.get("isDemo"):
        return 403, {"error": "replay is only available for demo homes"}
    homes.replay_after_fix(issue["homeId"], "still_low" if outcome == "still_low" else "fixed")
    _event(issue_id, "replay", "Demo: replayed 8 days of readings after the visit (labelled REPLAY).")
    return 200, check_fix(issue_id)


# ---------- Step Functions tasks (the state machine invokes this Lambda) ----------

def run_task(e: dict) -> dict:
    task, iid = e["task"], e.get("issueId")
    if task == "daily_check":
        out = []
        for row in TABLE.query(KeyConditionExpression=Key("PK").eq("OPEN_ISSUES"))["Items"]:
            out.append({row["SK"]: check_fix(row["SK"]).get("result")})
        return {"checked": out}

    issue = get(f"ISSUE#{iid}")
    if task in ("notify", "rewait"):
        _update(iid, waitToken=e["taskToken"])
        if task == "notify":
            # No message leaves the app: the issue shows up in the installer app, which reads it from the table.
            note = ("The fix did not bring output back into the expected range, so this issue is open again."
                    if e.get("reopened") else "Sent to your installer in the SunProof installer app, with the evidence chart.")
            _event(iid, "sent_to_app", note)
        return {"ok": True}
    if task == "remind":
        _event(iid, "reminder", f"Midway reminder: still waiting for {issue['installerName']} to reply.")
        return {"ok": True}
    if task == "escalate":
        _update(iid, escalationDraft=_escalation_draft(issue))
        _event(iid, "escalation_draft", "No reply within the response window. A ready-to-file escalation draft is ready.",
               status="escalation_draft")
        _close(issue)
        return {"ok": True}
    if task == "await_fix":
        _update(iid, fixToken=e["taskToken"])
        _event(iid, "verifying", "Watching the next 7 days of generation to confirm the fix.")
        return {"ok": True}
    if task == "no_data":
        _event(iid, "no_data", "Not enough new readings arrived to confirm the fix.", status="no_data")
        _close(issue)
        return {"ok": True}
    raise ValueError(f"unknown task {task}")


def _escalation_draft(issue: dict) -> str:
    created = issue["created"][:10]
    return (
        "DRAFT: review, fill the [brackets] and file yourself. SunProof does not file this automatically.\n\n"
        "To: [Nodal officer / grievance cell: your DISCOM, or the PM Surya Ghar national portal grievance channel]\n"
        f"Subject: Rooftop solar underperforming, vendor has not responded (reference {issue['issueId']})\n\n"
        "Respected Sir/Madam,\n\n"
        "I have a subsidised rooftop solar system installed by "
        f"{issue['installerName']} [consumer number / installation date / system size: fill in].\n\n"
        f"An independent check of my inverter readings against expected generation found that output between "
        f"{issue['periodStart']} and {issue['periodEnd']} was about {issue['unitsLost']:.0f} units below the expected range "
        f"({issue['co2Kg']:.0f} kg of extra CO2 from replacement grid power). {issue['cause']}\n\n"
        f"On {created} I sent this evidence to the installer. The seven-day response window under MNRE's complaint "
        "procedure has ended without a response.\n\n"
        "Attached: the expected-vs-actual chart and daily readings (SunProof evidence pack).\n"
        "I request that the vendor be directed to inspect the system and explain the shortfall.\n\n"
        "Yours faithfully,\n[Name, address, contact]\n\n"
        "Note: this is a statistical comparison against a weather-based expected range, so the shortfall is "
        "'worth checking', not proof of fault.")
