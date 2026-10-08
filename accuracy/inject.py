"""Inject known faults into clean daily data (module M1).

Faults, chosen with a fixed seed:
- trip: output 0 for 1-3 whole days
- step: output x 0.8 from day X to the end
- dust: output x (1 - r*d), r in [0.003, 0.005]/day, reset to clean on a "rain" day

Each faulty inverter gets exactly one fault; about a third stay clean so false
alarms can be measured.
"""

import numpy as np
import pandas as pd

KINDS = ("trip", "step", "dust")
WARMUP_DAYS = 7  # the expected model is calibrated on each inverter's first week, so faults start after it


def inject(daily: pd.DataFrame, seed: int = 42, clean_share: float = 1 / 3):
    """daily: columns date, source_key, actual_kwh (+ anything else, kept).

    Returns (faulty, labels). labels: source_key, kind, start_date, end_date, severity.
    """
    rng = np.random.default_rng(seed)
    faulty = daily.sort_values(["source_key", "date"]).reset_index(drop=True).copy()
    keys = sorted(faulty["source_key"].unique())
    order = rng.permutation(len(keys))
    n_clean = round(len(keys) * clean_share)
    labels = []

    for n, idx in enumerate(order[n_clean:]):
        key = keys[idx]
        kind = KINDS[n % len(KINDS)]
        rows = faulty.index[faulty["source_key"] == key]
        dates = faulty.loc[rows, "date"].reset_index(drop=True)
        n_days = len(dates)

        if kind == "trip":
            start = int(rng.integers(WARMUP_DAYS, n_days - 3))
            length = int(rng.integers(1, 4))
            hit = rows[start:start + length]
            faulty.loc[hit, "actual_kwh"] = 0.0
            labels.append((key, kind, dates[start], dates[start + length - 1], 1.0))

        elif kind == "step":
            start = int(rng.integers(WARMUP_DAYS, n_days - 5))
            faulty.loc[rows[start:], "actual_kwh"] *= 0.8
            labels.append((key, kind, dates[start], dates[n_days - 1], 0.2))

        else:  # dust
            start = int(rng.integers(WARMUP_DAYS, n_days - 18))
            rate = float(rng.uniform(0.003, 0.005))
            rain = start + int(rng.integers(16, n_days - start)) if n_days - start > 16 else n_days
            d = np.arange(rain - start)
            hit = rows[start:rain]
            faulty.loc[hit, "actual_kwh"] *= (1 - rate * d)
            labels.append((key, kind, dates[start], dates[rain - 1], rate))

    lab = pd.DataFrame(labels, columns=["source_key", "kind", "start_date", "end_date", "severity"])
    return faulty, lab
