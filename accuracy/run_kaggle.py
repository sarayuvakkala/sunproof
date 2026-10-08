"""Blind accuracy test on the Kaggle Indian plants (module M2).

    python -m accuracy.run_kaggle

1. Plant 1 (clean sensor): inject known faults with many seeds, run the product's
   detector without telling it where the faults are, and score it. Thresholds are
   tuned on the even-numbered inverters and reported on the odd-numbered ones.
2. Plant 1 original data: which inverters really underperform their peers.
3. Plant 2 (unreliable sensor): flag rate on original data, reported separately.
"""

import itertools
import json
import math
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

from accuracy.inject import WARMUP_DAYS, inject
from accuracy.kaggle import load_daily
from engine.detect import Thresholds, detect
from engine.expected import GAMMA_PDC, SYSTEM_LOSSES_PCT

SEEDS = range(20)
REPORT = Path(__file__).resolve().parent / "report.json"
TRIP_WINDOW, STEP_WINDOW, DUST_WINDOW = 2, 2, 7  # days allowed to catch each fault
DUST_CROSS = 0.05                                 # dust must be caught within 7 days of crossing 5% loss
AFTER_FAULT_GRACE = 5                             # days after a fault ends that are not scored as false alarms


def model_per_kw(df: pd.DataFrame) -> pd.Series:
    return df["poa_kwh_m2"] * (1 + GAMMA_PDC * (df["temp_module"] - 25)) * (1 - SYSTEM_LOSSES_PCT / 100) * 0.96


def run_detector(daily: pd.DataFrame, t: Thresholds) -> pd.DataFrame:
    """Per inverter: calibrate expected on its first week (as a new home would), then detect."""
    out = []
    for key, g in daily.groupby("source_key"):
        g = g.sort_values("date").reset_index(drop=True)
        m = model_per_kw(g)
        k = float((g["actual_kwh"] / m).iloc[:WARMUP_DAYS].median())
        det = detect(pd.DataFrame({"date": g["date"], "expected_kwh": m * k, "actual_kwh": g["actual_kwh"]}), t)
        det["source_key"] = key
        out.append(det)
    return pd.concat(out, ignore_index=True)


def score(det: pd.DataFrame, labels: pd.DataFrame) -> dict:
    res = {k: {"injected": 0, "caught": 0, "missed": 0} for k in ("trip", "step", "dust")}
    res["dust_below_5pct"] = {"injected": 0, "flagged": 0}
    excluded = set()
    flags = det[det["flag"]]
    for lab in labels.itertuples():
        lab = lab._replace(start_date=pd.Timestamp(lab.start_date), end_date=pd.Timestamp(lab.end_date))
        f = flags[flags["source_key"] == lab.source_key]["date"]
        if lab.kind == "dust":
            cross = lab.start_date + pd.Timedelta(math.ceil(DUST_CROSS / lab.severity), "D")
            if cross > lab.end_date:
                hit = ((f >= lab.start_date) & (f <= lab.end_date)).any()
                res["dust_below_5pct"]["injected"] += 1
                res["dust_below_5pct"]["flagged"] += int(hit)
            else:
                hit = ((f >= lab.start_date) & (f <= cross + pd.Timedelta(DUST_WINDOW - 1, "D"))).any()
                res["dust"]["injected"] += 1
                res["dust"]["caught" if hit else "missed"] += 1
        else:
            window = TRIP_WINDOW if lab.kind == "trip" else STEP_WINDOW
            hit = ((f >= lab.start_date) & (f <= lab.start_date + pd.Timedelta(window - 1, "D"))).any()
            res[lab.kind]["injected"] += 1
            res[lab.kind]["caught" if hit else "missed"] += 1
        for d in pd.date_range(lab.start_date, lab.end_date + pd.Timedelta(AFTER_FAULT_GRACE, "D")):
            excluded.add((lab.source_key, d))

    scored = det[[(k, d) not in excluded for k, d in zip(det["source_key"], det["date"])]]
    scored = scored[scored["ratio"].notna()]
    res["false_alarms"] = {"clean_inverter_days": int(len(scored)), "flagged": int(scored["flag"].sum())}
    return res


def add(a: dict, b: dict) -> dict:
    return {k: add(a[k], b[k]) if isinstance(a[k], dict) else a[k] + b[k] for k in a}


def evaluate(daily: pd.DataFrame, keys: list[str], t: Thresholds) -> dict:
    sub = daily[daily["source_key"].isin(keys)]
    total = None
    for seed in SEEDS:
        faulty, labels = inject(sub, seed=seed)
        r = score(run_detector(faulty, t), labels)
        total = r if total is None else add(total, r)
    fa = total["false_alarms"]
    fa["rate"] = round(fa["flagged"] / fa["clean_inverter_days"], 4) if fa["clean_inverter_days"] else 0.0
    return total


def objective(r: dict) -> float:
    caught = sum(r[k]["caught"] for k in ("trip", "step", "dust"))
    injected = sum(r[k]["injected"] for k in ("trip", "step", "dust"))
    return caught / injected - 5 * r["false_alarms"]["rate"]


def tune(daily: pd.DataFrame, keys: list[str]) -> Thresholds:
    grid = itertools.product([0.80, 0.85, 0.88, 0.90], [0.93, 0.95, 0.97], [-0.001, -0.002, -0.003])
    best, best_t = -1e9, Thresholds()
    for sr, dr, ds in grid:
        t = Thresholds(shortfall_ratio=sr, dust_ratio=dr, dust_slope=ds)
        o = objective(evaluate(daily, keys, t))
        if o > best:
            best, best_t = o, t
    return best_t


def underperformers(daily: pd.DataFrame, plant: int) -> list[dict]:
    """Inverters that make less than their peers under the same sky (original data)."""
    d = daily.copy()
    d["per_kw"] = d["actual_kwh"] / model_per_kw(d)
    plant_median = d.groupby("date")["per_kw"].median()
    d["vs_peers"] = d["per_kw"] / d["date"].map(plant_median)
    s = d.groupby("source_key")["vs_peers"].agg(["median", lambda x: (x < 0.9).sum()])
    s.columns = ["median_vs_peers", "days_below_90pct"]
    low = s[(s["median_vs_peers"] < 0.97) | (s["days_below_90pct"] >= 2)].sort_values("median_vs_peers")
    return [{"plant": plant, "source_key": k, "median_vs_peers": round(float(r.median_vs_peers), 3),
             "days_below_90pct_of_peers": int(r.days_below_90pct)} for k, r in low.iterrows()]


def main():
    p1 = load_daily(1)
    keys = sorted(p1["source_key"].unique())
    tune_keys, test_keys = keys[0::2], keys[1::2]

    t = tune(p1, tune_keys)
    test = evaluate(p1, test_keys, t)

    p2 = load_daily(2)
    p2_det = run_detector(p2[p2["date"] >= p2["date"].min()], t)
    p2_rate = float(p2_det["flag"].mean())

    report = {
        "dataset": "Kaggle Solar Power Generation Data (2 Indian plants, 34 days, 22 inverters each)",
        "method": "Known faults injected blind; the product's detector (engine.detect) scored against them.",
        "seeds": len(SEEDS),
        "tuned_on": f"Plant 1, {len(tune_keys)} inverters (even positions)",
        "tested_on": f"Plant 1, {len(test_keys)} held-out inverters (odd positions)",
        "thresholds": asdict(t),
        "catch_rules": {"trip": f"within {TRIP_WINDOW} days", "step_20pct": f"within {STEP_WINDOW} days",
                        "dust": f"within {DUST_WINDOW} days of loss crossing {int(DUST_CROSS * 100)}%"},
        "by_kind": {k: test[k] for k in ("trip", "step", "dust")},
        "dust_below_5pct": test["dust_below_5pct"],
        "false_alarms": test["false_alarms"],
        "real_underperformers_plant_1": underperformers(p1, 1),
        "plant_2_note": ("Plant 2 output swings ~27% around its own sunlight sensor on every inverter, so it is "
                         "not used for headline accuracy."),
        "plant_2_flag_rate_original": round(p2_rate, 3),
    }
    REPORT.write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps({k: report[k] for k in ("thresholds", "by_kind", "dust_below_5pct", "false_alarms")}, indent=2))
    print("underperformers:", report["real_underperformers_plant_1"])
    print("plant 2 flag rate:", report["plant_2_flag_rate_original"])


if __name__ == "__main__":
    main()
