# API reference

Base URL: the `ApiUrl` output of the `sunproof` stack (an API Gateway HTTP API). All bodies are JSON. Money is in ₹, energy in kWh, CO₂ in kg. CORS allows any origin; preflight (`OPTIONS`) returns 204.

Errors are `{"error": "message"}` with the status code shown below.

Constants (`engine/constants.py`): CO₂ 0.705 kg/kWh (CEA CO₂ Baseline Database v22.0, combined margin, FY 2025-26); default tariff ₹8/kWh (editable per home).

Verdict wording is always "worth checking", never an accusation.

## Household

### `GET /homes/{homeId}/verdict?days=30`
Home ids in the demo: `demo` (healthy) and `demo-sharma` (20% drop). Returns 404 for an unknown home.
```json
{
  "homeId": "demo-sharma", "name": "Sharma ji (demo)", "isDemo": true,
  "label": "Demo household built from public plant data, not a real home",
  "status": "ok | shortfall | trip | likely_dust | insufficient_data",
  "period": {"start": "2026-09-08", "end": "2026-10-07"},
  "expected_kwh": 344.1, "expected_band_kwh": [309.7, 371.7], "actual_kwh": 293.9, "ratio": 0.854,
  "units_lost": 48.1, "rupees_lost": 385, "co2_kg": 33.9,
  "daily": [{"date": "2026-09-24", "p10": 12.57, "p50": 13.97, "p90": 15.09, "actual": 11.07,
             "flag": null}],
  "message": {"en": "...", "hi": "..."},
  "assumptions": {"tariff_inr_per_kwh": 8.0, "co2_kg_per_kwh": 0.705, "co2_source": "..."},
  "activeIssue": null, "installerName": "Installer",
  "replayFrom": null
}
```
`daily[].flag` is `null`, `"trip"`, `"shortfall"` or `"likely_dust"`. `replayFrom` is the first date of replayed (not live) readings, or `null`.

### `POST /homes/{homeId}/voice`
Body `{"lang": "hi" | "en"}` → `{"audio_url": "<presigned S3 URL, 1 hour>", "text": "..."}`. Polly neural voice Kajal.

### `GET /homes/{homeId}/clean-or-skip[?scenario=rain|dust]`
```json
{"decision": "clean | skip", "reason_en": "...", "reason_hi": "...",
 "dust_loss_pct": 6.6, "rupees_per_month": 194, "cleaning_cost": 300.0,
 "rain_expected": {"date": "2026-10-10", "mm": 9.0}, "days_since_rain": 26,
 "simulated": null}
```
`rain_expected` is `null` when no washing rain (5 mm or more) is forecast. `?scenario=rain` or `dust` simulates the weather. It works for demo homes only (and only while `DemoMode` is on), and then `simulated` is `"rain"` or `"dust"`. Any other value gives the live Open-Meteo forecast.

### `POST /issues`
Body `{"homeId": "demo-sharma", "approved": true}`. Starts the Step Functions workflow; the issue appears in the installer app (`GET /pro/jobs`). Nothing is emailed.
- `200` → `{"issueId": "...", "status": "sent", "deadlineText": "...", "installerLink": "<site>/r/<token>"}`
- `403` the household did not approve (Cedar)
- `404` unknown home
- `409` an issue is already open, or the check does not point at the system (it looks fine, or like dust)

### `GET /issues/{issueId}?homeId={homeId}`
Only the household that owns the issue can read it (Cedar). `403` otherwise, `404` if the issue does not exist.
```json
{
  "issueId": "...", "homeId": "demo-sharma",
  "status": "sent | visit_booked | fixed_remotely | fix_failed | disputed | fixed | reopened | escalation_draft | no_data",
  "deadlineText": "08 Oct 2026, 10:21 AM IST", "installerName": "...", "summary": "...",
  "timeline": [{"at": "2026-10-08T04:44:40+00:00", "event": "created", "note": "..."}],
  "recovered": {"kwh": 18.1, "rupees": 145, "co2_kg": 12.8},
  "escalationDraft": null, "installerLink": "...", "chartUrl": "<presigned S3 URL, 1 hour>",
  "visit": {"date": "2026-10-10", "time": "11:00"}, "visitDone": false,
  "trip": {"stage": "on_the_way | arrived", "at": "2026-10-10T05:30:00+00:00"}
}
```
Timeline `event` values: `created`, `sent_to_app`, `reminder`, `on_the_way`, `arrived`, `visit_done`, `book_visit`, `fixed_remotely`, `not_system_issue`, `late_reply`, `verifying`, `replay`, `fixed`, `fix_failed`, `cleaned`, `reopened`, `escalation_draft`, `no_data`. `visit`, `visitDone` and `trip` are set for visits booked through the installer app (`visitDone` is `null` for the old link). `checkDays` lists the 7-day fix check so far, one `{day, ok}` per day (`ok` = that day's output was inside the expected range). `fix_failed` means output was back for a few days and then fell again (two low days in a row); `failedDay` is the first low day and `failedPct` how far under expected. The check then waits for the household: `POST /issues/{issueId}/revisit`, or clean the panels. `recovered` is set only when the status is `fixed`; `escalationDraft` only when it is `escalation_draft`.

### `POST /issues/{issueId}/revisit`
Body `{"homeId": "..."}`. After a `fix_failed`, the household asks the installer to come back: the issue is `reopened` and shows up again in the installer app as a new request. `200` `{"ok": true, "status": "reopened"}`, `409` unless the status is `fix_failed`, `403` for another home.

### `POST /issues/{issueId}/cleaned`
Body `{"homeId": "..."}`. The household cleaned the panels after a `fix_failed` (or after the installer said "not a system issue"). Dust was the cause, so the issue becomes `fixed`: the energy dust was costing is counted as an estimate (`recovered.by` is `"cleaning"`), the recovery counter goes up, and the installer app shows the job as fixed. `409` for any other status, `403` for another home.

### `GET /recovered`
Running total across all fixed issues: `{"kwh": 18, "rupees": 144, "co2_kg": 12.7, "fixes": 1, "assumptions": {...}}`.

### `GET /accuracy`
The contents of `accuracy/report.json`, or `{"status": "pending"}` if it is missing.

## Installer (no signup; the token in the link is the key)

### `GET /r/{token}`
The evidence pack: system name and size, summary, likely cause, units lost, period, `daily` (same shape as the verdict's), `chartUrl`, `timeline`, `status`, `deadlineText`, `isDemo`. It never contains the bill or the household's contact details (Cedar). `404` for an invalid token.

### `POST /r/{token}/respond`
Body `{"action": "book_visit" | "fixed_remotely" | "not_system_issue", "note": "optional, 300 chars", "visit_date": "optional YYYY-MM-DD"}`.
- `200` `{"ok": true, "status": "visit_booked"}` and the workflow resumes
- `200` `{"ok": true, "late": true}` if the response window has closed (the reply is recorded but changes nothing)
- `400` unknown action, `404` invalid token

### `GET /r/{token}/bill`
Always `403` `{"error": "Installers cannot see the household's bill."}`. It exists so the Cedar rule can be demonstrated.

## Installer app (one fixed demo installer, no sign-in yet)

These routes power the installer screens (Jobs, Visits, Record). Every request acts as the demo installer `demo-installer`; Cedar only lets it see generation data, evidence, status and its own record for issues that belong to it, and never the bill or the household's contact details. Real installer sign-in is a later step.

### `GET /pro/jobs`
`{"installer": "demo-installer", "jobs": [Job]}`, newest first. A **Job**:
```json
{
  "issueId": "...", "homeId": "demo-sharma", "name": "Sharma ji (demo)", "kw": 3.0, "city": "Delhi",
  "state": "new | visit | check | fixed | closed", "overdue": false,
  "status": "sent | reopened | visit_booked | fixed_remotely | fixed | disputed | escalation_draft | no_data",
  "daysLeft": 4, "deadlineText": "13 Oct 2026, 10:21 AM IST", "pctBelow": 15, "weeks": 3, "unitsLost": 48,
  "visit": {"date": "2026-10-12", "time": "11:00"}, "day": 0, "recovered": null, "replyDays": null,
  "created": "2026-10-09T04:44:40+00:00", "reopened": false
}
```
`state` is what the app shows. `new` means it needs a reply (`overdue` is true when the window closed with no reply; a late reply is still recorded). `visit` means a visit is booked, `check` means the 7-day fix check is running (`day` is 0 to 7), `fixed` and `closed` are finished. `daysLeft` is only set for `new`, counted in the response window (shortened in demo mode), and negative when overdue.

### `GET /pro/jobs/{issueId}`
A Job plus `summary`, `likelyCause`, `period`, `co2Kg`, `daily` (same shape as the verdict's), `chartUrl`, `timeline` and `isDemo`. `403` for another installer's issue, `404` if it does not exist.

### `POST /pro/jobs/{issueId}/respond`
Body `{"action": "book_visit" | "fixed_remotely" | "not_system_issue", "visit_date": "YYYY-MM-DD", "visit_time": "HH:MM", "note": "optional"}`. Same replies as the installer link, with one difference: **booking a visit holds the 7-day fix check** until the visit is marked done. A remote fix starts the check straight away. Responses as for `POST /r/{token}/respond`.

### `POST /pro/jobs/{issueId}/trip`
Body `{"step": "on_the_way" | "arrived"}`. The installer reports progress on a booked visit; the household sees it on its next refresh (`trip` on `GET /issues/{issueId}`). `200` `{"ok": true, "trip": "arrived"}`, `400` unknown step, `409` if there is no booked visit in progress, `403` for another installer's issue. A job in the list carries `trip` while its visit is waiting.

### `POST /pro/jobs/{issueId}/visit-done`
Marks the booked visit done and starts the 7-day check from the latest reading. `200` `{"ok": true, "visitDone": true}`, `409` if there is no booked visit waiting, `403` for another installer's issue.

### `GET /pro/record`
`{"installer": "demo-installer", "rows": [...]}`: the closed jobs (fixed, not a system issue, escalated or no data), newest first, each `{issueId, name, city, closedAt, fixed, unitsRecovered, co2Kg, replyDays}`. `fixed` is true only when the fix check confirmed that output came back.

## Demo only (available while the stack's `DemoMode` is `true`)

### `POST /demo/advance-day`
Body `{"issueId": "..."}`. Adds one more day of readings after the fix (labelled replay) and runs the check, so the 7-day check unfolds a day at a time. The household app calls it every 10 seconds, or when the presenter taps "next day". Mehta ji (`demo-mehta`, 4 kW, Jaipur) is a house where the repair does not hold: output is back for 4 days and falls again from day 5. Sharma ji (`demo-sharma`) holds for all 7. `409` if no fix check is running.

### `POST /demo/replay-fix`
Body `{"issueId": "...", "outcome": "fixed" | "still_low"}`. Appends 8 days of replayed readings (labelled REPLAY) after the visit and runs the fix check. → `{"result": "fixed" | "reopen" | "pending", ...}`. Demo homes only.

### `POST /demo/reset`
Restores both demo homes, deletes all issues, and empties the recovery counter. → `{"ok": true, "homes": ["demo", "demo-sharma"]}`.

## Internal (not HTTP)
The same Lambda also handles Step Functions tasks (`notify`, `remind`, `rewait`, `escalate`, `await_fix`, `no_data`) and the daily EventBridge `daily_check`. The 7-day response window is `7 days / DEMO_TIME_SCALE`; the fix check gets three times that (21 days) because it starts after a booked visit.
