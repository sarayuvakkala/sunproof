"""Single container Lambda: HTTP API routes, Step Functions tasks and the daily schedule."""

import json
import os
import re
from pathlib import Path

from . import homes, issues, pro
from .store import to_dynamo  # noqa: F401  (import check at cold start)

REPORT = Path(__file__).resolve().parent.parent / "accuracy" / "report.json"
DEMO_MODE = os.environ.get("DEMO_MODE", "true") == "true"


def _resp(status: int, body) -> dict:
    return {"statusCode": status, "headers": {"content-type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def _need(v):
    return _resp(200, v) if v is not None else _resp(404, {"error": "not found"})


def _tuple(t):
    return _resp(t[0], t[1])


def route(method: str, path: str, query: dict, body: dict) -> dict:
    m = re.fullmatch(r"/homes/([^/]+)/verdict", path)
    if m and method == "GET":
        return _need(homes.verdict_for(m[1], int(query.get("days", 30))))
    m = re.fullmatch(r"/homes/([^/]+)/voice", path)
    if m and method == "POST":
        return _need(homes.voice(m[1], body.get("lang", "hi")))
    m = re.fullmatch(r"/homes/([^/]+)/clean-or-skip", path)
    if m and method == "GET":
        return _need(homes.clean_or_skip(m[1], query.get("scenario")))

    if path == "/issues" and method == "POST":
        return _tuple(issues.start_issue(body.get("homeId", ""), bool(body.get("approved"))))
    m = re.fullmatch(r"/issues/([^/]+)", path)
    if m and method == "GET":
        return _tuple(issues.issue_view(m[1], query.get("homeId", "")))

    m = re.fullmatch(r"/issues/([^/]+)/revisit", path)
    if m and method == "POST":
        return _tuple(issues.revisit(m[1], body.get("homeId", "")))

    m = re.fullmatch(r"/issues/([^/]+)/cleaned", path)
    if m and method == "POST":
        return _tuple(issues.cleaned(m[1], body.get("homeId", "")))

    m = re.fullmatch(r"/r/([^/]+)", path)
    if m and method == "GET":
        return _tuple(issues.installer_view(m[1]))
    m = re.fullmatch(r"/r/([^/]+)/respond", path)
    if m and method == "POST":
        return _tuple(issues.respond(m[1], body))
    m = re.fullmatch(r"/r/([^/]+)/bill", path)
    if m and method == "GET":
        return _tuple(issues.installer_bill(m[1]))

    # Installer app (one fixed demo installer; see pro.py)
    if path == "/pro/jobs" and method == "GET":
        return _tuple(pro.list_jobs())
    m = re.fullmatch(r"/pro/jobs/([^/]+)", path)
    if m and method == "GET":
        return _tuple(pro.get_job(m[1]))
    m = re.fullmatch(r"/pro/jobs/([^/]+)/respond", path)
    if m and method == "POST":
        return _tuple(pro.respond(m[1], body))
    m = re.fullmatch(r"/pro/jobs/([^/]+)/visit-done", path)
    if m and method == "POST":
        return _tuple(pro.visit_done(m[1]))
    m = re.fullmatch(r"/pro/jobs/([^/]+)/trip", path)
    if m and method == "POST":
        return _tuple(pro.trip(m[1], body))
    if path == "/pro/record" and method == "GET":
        return _tuple(pro.record())

    if path == "/recovered" and method == "GET":
        return _resp(200, issues.recovered_total())
    if path == "/accuracy" and method == "GET":
        return _resp(200, json.loads(REPORT.read_text()) if REPORT.exists() else {"status": "pending"})

    if DEMO_MODE and path == "/demo/replay-fix" and method == "POST":
        return _tuple(issues.demo_replay_fix(body.get("issueId", ""), body.get("outcome", "fixed")))
    if DEMO_MODE and path == "/demo/advance-day" and method == "POST":
        return _tuple(issues.demo_advance_day(body.get("issueId", ""), bool(body.get("manual"))))
    if DEMO_MODE and path == "/demo/reset" and method == "POST":
        return _resp(200, homes.reset_demo())

    return _resp(404, {"error": f"no route {method} {path}"})


def handler(event, _ctx):
    if "task" in event:  # Step Functions / EventBridge
        return issues.run_task(event)
    http = event["requestContext"]["http"]
    if http["method"] == "OPTIONS":  # CORS preflight; API Gateway adds the CORS headers
        return {"statusCode": 204, "body": ""}
    body = json.loads(event["body"]) if event.get("body") else {}
    try:
        return route(http["method"], event["rawPath"], event.get("queryStringParameters") or {}, body)
    except Exception as e:  # keep the API answering with JSON
        print("ERROR", repr(e))
        return _resp(500, {"error": "Something went wrong. Please try again."})
