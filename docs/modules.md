# Module specs

Each module is self-contained: anyone on the team can pick it up from this page alone.
Raw data lives **outside the repo**. Set `SUNPROOF_DATA=~/datasets/kaggle-solar` (contains the 4 Kaggle CSVs).

Shared interface (owned by Sarayu, in `engine/detect.py`):
```python
detect(daily: pd.DataFrame) -> pd.DataFrame
# in:  columns date, expected_kwh, actual_kwh   (one row per day, one system)
# out: same rows + ratio, flag (bool), kind ("trip" | "shortfall" | "likely_dust" | None)
```
The accuracy test **must** call this same function, so the published accuracy is the accuracy of the product.

---

## M1. Fault injector: `accuracy/inject.py`  (partner)
- **In:** Kaggle generation CSV (one plant), seed.
- **Out:** `(faulty_df, labels_df)`. `labels_df` has columns `source_key, kind, start_date, end_date, severity`.
- **Faults** (fixed seed 42, about 30 in total across both plants):
  - `trip`: AC output = 0 for 1–3 whole days
  - `step`: output × 0.8 from day X to the end
  - `dust`: output × (1 − r·d), r ∈ [0.003, 0.005]/day, d = days since start, reset to 0 on a chosen "rain" day
- Leave about a third of the inverters untouched (they're used to measure false alarms).
- **Test:** `pytest accuracy/test_inject.py` checks that the labels match the changes in the data, and that the same seed gives the same output.
- **Done when:** both plants produce faulty data plus labels.

## M2. Kaggle accuracy run: `accuracy/run_kaggle.py`  (partner)
- **Expected kWh per inverter-day:** from on-site `IRRADIATION` + `MODULE_TEMPERATURE`:
  `expected = k_inv × Σ(irradiation × (1 − 0.004 × (T_mod − 25)))`, with `k_inv` fitted on that inverter's **first 7 days** (median ratio).
- Feed each inverter's daily table into `engine.detect.detect`.
- **"Caught":**
  - trip or step: flagged within 2 days of the start
  - dust: flagged within 7 days of the loss crossing 5%
- **False alarm:** a flagged day on an inverter with no injected fault at that time.
- **Tune** thresholds on Plant 1 only. **Report** on Plant 2.
- Also run on the **original** data and list inverters with a low median ratio ("real underperformers").
- **Out:** `accuracy/report.json`:
```json
{"dataset": "Kaggle Solar Power Generation Data (2 Indian plants, 34 days)",
 "tuned_on": "plant_1", "tested_on": "plant_2", "seed": 42,
 "by_kind": {"trip": {"injected": 0, "caught": 0, "missed": 0},
             "step": {"injected": 0, "caught": 0, "missed": 0},
             "dust": {"injected": 0, "caught": 0, "missed": 0}},
 "false_alarms": {"clean_inverter_days": 0, "flagged": 0, "rate": 0.0},
 "real_underperformers": [{"plant": 2, "source_key": "...", "median_ratio": 0.0}]}
```
- **Done when:** `python -m accuracy.run_kaggle` writes the file deterministically.

## M3. Demo household: `accuracy/make_demo_household.py`  (partner)
- Pick one **clean** Plant 2 inverter (high, steady ratio). Scale its daily kWh by `3.0 / inverter_kw` (estimate `inverter_kw` from its peak AC power).
- Shift the dates so the series ends "yesterday" (it's a replay; label it so).
- **Out:** `data/demo_household.csv` with columns `date, actual_kwh`, plus `data/demo_household.json` with `{kw: 3, lat: 28.61, lon: 77.21, tilt: 20, azimuth: 180, tariff: 8, label: "Demo household built from public plant data, not a real home"}`.
- **Sharma ji variant:** the same series with a 20% step drop over the last 21 days → `data/demo_sharma.csv`.

## M4. Clean or skip: `engine/clean_or_skip.py`  (partner)
```python
decide(dust_loss_pct: float, kwh_per_day: float, tariff: float, cleaning_cost: float,
       rain_forecast: list[dict]) -> dict   # shape = GET /clean-or-skip in api.md
```
- **Rule:**
  - If rain ≥ 5 mm is expected in the next 3 days → `skip`.
  - Otherwise, if the ₹ lost to dust before the next likely rain is more than the cleaning cost → `clean`.
  - Otherwise → `skip`.
- **Dust loss** defaults to 7.6%/month (Delhi study). Refine it with DeepSolarEye if time allows.
- `rain_forecast` comes from Open-Meteo (`daily=precipitation_sum`). Keep the fetch in a separate function so the decision can be tested offline.
- **Test:** `pytest engine/test_clean_or_skip.py` covers rain soon, heavy dust and light dust.

## M5. Evidence chart: `engine/evidence.py`  (partner)
```python
render(daily: pd.DataFrame, title: str) -> bytes   # PNG
```
- The expected P10–P90 band is shaded, the actual line is drawn on top, and flagged days are marked. Plain labels, no jargon. Uses matplotlib.
- The Lambda uploads the PNG to S3. This module only returns bytes.

---

## Handoff
At the end of each day, add 3 lines to `docs/handoff.md`: **done / half-done / next**. Push at least every 3 hours.
