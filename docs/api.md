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
  "activeIssue": null, "installerName": "Test installer (demo)",
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
Body `{"homeId": "demo-sharma", "approved": true}`. Starts the Step Functions workflow and emails the installer.
- `200` → `{"issueId": "...", "status": "sent", "deadlineText": "...", "installerLink": "<site>/r/<token>"}`
- `403` the household did not approve (Cedar)
- `404` unknown home
- `409` an issue is already open, or the check does not point at the system (it looks fine, or like dust)

### `GET /issues/{issueId}?homeId={homeId}`
Only the household that owns the issue can read it (Cedar). `403` otherwise, `404` if the issue does not exist.
```json
{
  "issueId": "...", "homeId": "demo-sharma",
  "status": "sent | visit_booked | fixed_remotely | disputed | fixed | reopened | escalation_draft | no_data",
  "deadlineText": "08 Oct 2026, 10:21 AM IST", "installerName": "...", "summary": "...",
  "timeline": [{"at": "2026-10-08T04:44:40+00:00", "event": "created", "note": "..."}],
  "recovered": {"kwh": 18.1, "rupees": 145, "co2_kg": 12.8},
  "escalationDraft": null, "installerLink": "...", "chartUrl": "<presigned S3 URL, 1 hour>"
}
```
Timeline `event` values: `created`, `email_sent`, `email_failed`, `reminder`, `book_visit`, `fixed_remotely`, `not_system_issue`, `late_reply`, `verifying`, `replay`, `fixed`, `reopened`, `escalation_draft`, `no_data`. `recovered` is set only when the status is `fixed`; `escalationDraft` only when it is `escalation_draft`.

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

## Demo only (available while the stack's `DemoMode` is `true`)

### `POST /demo/replay-fix`
Body `{"issueId": "...", "outcome": "fixed" | "still_low"}`. Appends 8 days of replayed readings (labelled REPLAY) after the visit and runs the fix check. → `{"result": "fixed" | "reopen" | "pending", ...}`. Demo homes only.

### `POST /demo/reset`
Restores both demo homes, deletes all issues, and empties the recovery counter. → `{"ok": true, "homes": ["demo", "demo-sharma"]}`.

## Internal (not HTTP)
The same Lambda also handles Step Functions tasks (`notify`, `remind`, `rewait`, `escalate`, `await_fix`, `no_data`) and the daily EventBridge `daily_check`. The 7-day window is `7 days / DEMO_TIME_SCALE`.
