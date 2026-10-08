# API contract (v1)

Base: API Gateway HTTP API. All bodies are JSON. Money in ₹, energy in kWh, CO₂ in kg.

Constants (see `engine/constants.py`):
- CO₂ factor: 0.705 kg/kWh, combined margin, CEA CO₂ Baseline Database v22.0 (FY 2025-26)
- Default tariff: ₹8/kWh (Delhi, household-editable)

## Household

### `GET /homes/{homeId}/verdict?days=30`
```json
{
  "homeId": "demo-sharma",
  "isDemo": true,
  "period": {"start": "2026-09-01", "end": "2026-09-30"},
  "status": "ok | shortfall | trip | likely_dust | insufficient_data",
  "expected_kwh": 390.0,
  "expected_band_kwh": [350.0, 420.0],
  "actual_kwh": 310.0,
  "ratio": 0.79,
  "units_lost": 80.0,
  "rupees_lost": 640.0,
  "co2_kg": 56.4,
  "daily": [
    {"date": "2026-09-01", "p10": 11.2, "p50": 13.0, "p90": 14.1, "actual": 12.6, "flag": null}
  ],
  "message": {"en": "...", "hi": "..."},
  "assumptions": {"tariff_inr_per_kwh": 8, "co2_kg_per_kwh": 0.705, "co2_source": "CEA v22.0 CM"}
}
```
Wording rule: messages say "worth checking", never accuse.

### `POST /homes/{homeId}/voice`
Body `{"lang": "hi" | "en"}` → `{"audio_url": "<presigned S3 URL>"}` (Polly Kajal)

### `GET /homes/{homeId}/clean-or-skip`
```json
{"decision": "clean | skip", "reason_en": "...", "reason_hi": "...",
 "dust_loss_pct": 6.1, "rupees_per_month": 195, "cleaning_cost": 300,
 "rain_expected": {"date": "2026-10-11", "mm": 8.4}}
```

### `POST /issues`
Body `{"homeId": "...", "approved": true}` → `{"issueId": "...", "status": "sent"}`
Starts the Step Functions issue workflow. Rejected (403) unless `approved` is true.

### `GET /issues/{issueId}`
```json
{"issueId": "...", "status": "sent | installer_replied | visit_booked | fixed_remotely | disputed | verifying | fixed | reopened | escalation_draft",
 "deadline": "2026-10-15T08:00:00+05:30",
 "timeline": [{"at": "...", "event": "sent", "note": "..."}],
 "recovered": {"kwh": 0, "rupees": 0, "co2_kg": 0},
 "escalation_draft": null}
```

## Installer (no signup, token in link)

### `GET /r/{token}`
Returns the evidence pack: daily expected vs actual, the likely cause, the chart URL. **Never** includes bill data (Cedar policy).

### `POST /r/{token}/respond`
Body `{"action": "book_visit" | "fixed_remotely" | "not_system_issue", "note": "optional", "visit_date": "optional"}` → `{"ok": true}`

## Public

### `GET /accuracy`
Returns `accuracy/report.json` (shape in `docs/modules.md`).
