"""Shared fault detector. The product and the accuracy test both call `detect`."""

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Thresholds:
    trip_ratio: float = 0.10       # day output below 10% of expected
    shortfall_ratio: float = 0.85  # 3-day median below 85% of expected
    dust_ratio: float = 0.95       # 5-day median below 95% ...
    dust_slope: float = -0.002     # ... and ratio falling by more than 0.2%/day over 7 days
    min_expected_kwh: float = 0.05 # ignore days with almost no sun


DEFAULT = Thresholds()


def _slope(values: np.ndarray) -> float:
    ok = ~np.isnan(values)
    if ok.sum() < 4:
        return np.nan
    x = np.arange(len(values))[ok]
    return float(np.polyfit(x, values[ok], 1)[0])


def detect(daily: pd.DataFrame, t: Thresholds = DEFAULT) -> pd.DataFrame:
    """Flag days that are worth checking.

    in:  columns date, expected_kwh, actual_kwh (one row per day, one system)
    out: same rows + ratio, flag (bool), kind ("trip" | "shortfall" | "likely_dust" | None)
    """
    out = daily.sort_values("date").reset_index(drop=True).copy()
    usable = out["expected_kwh"] > t.min_expected_kwh
    out["ratio"] = np.where(usable, out["actual_kwh"] / out["expected_kwh"].where(usable), np.nan)

    med3 = out["ratio"].rolling(3, min_periods=2).median()
    med5 = out["ratio"].rolling(5, min_periods=3).median()
    slope7 = out["ratio"].rolling(7, min_periods=4).apply(_slope, raw=True)

    trip = out["ratio"] < t.trip_ratio
    shortfall = ~trip & (med3 < t.shortfall_ratio)
    dust = ~trip & ~shortfall & (med5 < t.dust_ratio) & (slope7 < t.dust_slope)

    out["kind"] = None
    out.loc[dust, "kind"] = "likely_dust"
    out.loc[shortfall, "kind"] = "shortfall"
    out.loc[trip, "kind"] = "trip"
    out["flag"] = out["kind"].notna()
    return out
