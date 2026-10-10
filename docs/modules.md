# Module specs

**Status: all five modules are built, tested and live.** The specs below are kept so anyone can pick a module up from this page alone; where the built version differs from the first spec, the text has been updated.
Raw data lives **outside the repo**. Set `SUNPROOF_DATA=~/datasets/kaggle-solar` (contains the 4 Kaggle CSVs).

Shared interface (in `engine/detect.py`):
```python
detect(daily: pd.DataFrame) -> pd.DataFrame
# in:  columns date, expected_kwh, actual_kwh   (one row per day, one system)
# out: same rows + ratio, flag (bool), kind ("trip" | "shortfall" | "likely_dust" | None)
```
The accuracy test **must** call this same function, so the published accuracy is the accuracy of the product.

---

## M1. Fault injector: `accuracy/inject.py` ✅ built
- **In:** Kaggle generation CSV (one plant), seed.
- **Out:** `(faulty_df, labels_df)`. `labels_df` has columns `source_key, kind, start_date, end_date, severity`.
- **Faults** (one fault per faulty inverter, kinds rotate; the accuracy run uses seeds 0 to 19):
  - `trip`: AC output = 0 for 1–3 whole days
  - `step`: output × 0.8 from day X to the end
  - `dust`: output × (1 − r·d), r ∈ [0.003, 0.005]/day, d = days since start, reset to 0 on a chosen "rain" day
- Leave about a third of the inverters untouched (they're used to measure false alarms). Faults never start in the first 7 days, because the expected model is calibrated on that first week.
- **Test:** `pytest accuracy/test_inject.py` checks that the labels match the changes in the data, and that the same seed gives the same output.
- **Done when:** Plant 1 produces faulty data plus labels, and `pytest accuracy/test_inject.py` passes.

## M2. Kaggle accuracy run: `accuracy/run_kaggle.py` ✅ built
- **Expected kWh per inverter-day:** from on-site `IRRADIATION` + `MODULE_TEMPERATURE`:
  `expected = k_inv × Σ(irradiation × (1 − 0.004 × (T_mod − 25)))`, with `k_inv` fitted on that inverter's **first 7 days** (median ratio).
- Feed each inverter's daily table into `engine.detect.detect`.
- **"Caught":**
  - trip or step: flagged within 2 days of the start
  - dust: flagged within 7 days of the loss crossing 5%
- **False alarm:** a flagged day on an inverter with no injected fault at that time.
- **Data finding (Thu):** Plant 1 tracks its sunlight sensor closely (daily ratio spread ~3.6%). Plant 2 swings ~27% on **every** inverter, so its sensor or plant is unreliable.
- **Split:** Plant 1 inverters sorted by `SOURCE_KEY`. Even positions **tune** the thresholds, odd positions are the **held-out test**. Report test numbers only.
- **Plant 2:** run the same detector on its original data and report it separately as "messy real-world plant" (flag rate + note), not in the headline accuracy.
- Plant 1 `DC_POWER` is 10× too large (known dataset issue). Use `AC_POWER` only. Plant 1 dates are day-first (`dayfirst=True`).
- Also run on the **original** data and list inverters with a low median ratio ("real underperformers").
- **Out:** `accuracy/report.json`:
```json
{"dataset": "...", "method": "...", "seeds": 20,
 "tuned_on": "Plant 1, 11 inverters (even positions)", "tested_on": "Plant 1, 11 held-out inverters (odd positions)",
 "thresholds": {"trip_ratio": 0.1, "shortfall_ratio": 0.88, "dust_ratio": 0.95, "dust_slope": -0.002, "min_expected_kwh": 0.05},
 "catch_rules": {"trip": "within 2 days", "step_20pct": "within 2 days", "dust": "within 7 days of loss crossing 5%"},
 "by_kind": {"trip": {"injected": 60, "caught": 60, "missed": 0},
             "step": {"injected": 40, "caught": 40, "missed": 0},
             "dust": {"injected": 38, "caught": 30, "missed": 8}},
 "dust_below_5pct": {"injected": 2, "flagged": 0},
 "false_alarms": {"clean_inverter_days": 5561, "flagged": 31, "rate": 0.0056},
 "real_underperformers_plant_1": [{"plant": 1, "source_key": "...", "median_vs_peers": 0.919, "days_below_90pct_of_peers": 3}],
 "plant_2_note": "...", "plant_2_flag_rate_original": 0.233}
```
- **Done when:** `python -m accuracy.run_kaggle` writes the file deterministically.

## M3. Demo household: `accuracy/make_demo_household.py` ✅ built
- Use Plant 1 inverter `YxYtjZvoooNbGkE` (steadiest: daily ratio spread 3.2%), plus Plant 1's weather sensor for its sunlight. Scale its daily kWh by `3.0 / inverter_kw` (estimate `inverter_kw` from its peak AC power).
- Shift the dates so the series ends "yesterday" (it's a replay; label it so).
- **Out:** `data/demo_household.csv` with columns `date, actual_kwh, poa_kwh_m2, temp_module` (the expected model needs the same sky as the actual output, so this is a replay, not live weather), plus `data/demo_household.json` with `{kw: 3, lat: 28.61, lon: 77.21, tilt: 20, azimuth: 180, tariff: 8, label: "Demo household built from public plant data, not a real home"}`.
- **Sharma ji variant:** the same series with a 20% step drop over the last 21 days → `data/demo_sharma.csv`.

## M4. Clean or skip: `engine/clean_or_skip.py` ✅ built
```python
decide(dust_loss_pct: float, kwh_per_day: float, tariff: float, cleaning_cost: float,
       rain_forecast: list[dict], today: date | None = None) -> dict   # shape = GET /homes/{id}/clean-or-skip in api.md
```
- **Rule:**
  - If rain ≥ 5 mm is expected in the next 3 days → `skip`.
  - Otherwise, if the ₹ lost to dust before the next likely rain is more than the cleaning cost → `clean`.
  - Otherwise → `skip`.
- **Dust loss** defaults to 7.6%/month (Delhi study). Refine it with DeepSolarEye if time allows.
- `rain_forecast` comes from Open-Meteo (`daily=precipitation_sum`). Keep the fetch in a separate function so the decision can be tested offline.
- Dates use India time (UTC+5:30), not the server's UTC date.
- The demo weather switch (`?scenario=rain|dust`) is handled in `backend/functions/api/homes.py`, not here, so this module stays a pure decision.
- **Test:** `pytest engine/test_day2.py` covers rain soon, heavy dust, light dust and the dust-loss cap.

## M5. Evidence chart: `engine/evidence.py` ✅ built
```python
render(daily: pd.DataFrame, title: str) -> bytes   # PNG
```
- The expected P10–P90 band is shaded, the actual line is drawn on top, and flagged days are marked. Plain labels, no jargon. Uses matplotlib.
- The Lambda uploads the PNG to S3. This module only returns bytes. `engine/test_day2.py` checks that the output is a valid PNG.

---

## Also built
- `engine/expected.py`, `engine/verdict.py`, `engine/verify_fix.py` and the whole `backend/` (API, Step Functions, Cedar). See `docs/api.md`.
