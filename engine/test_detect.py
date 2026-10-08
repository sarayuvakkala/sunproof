import numpy as np
import pandas as pd

from engine.detect import detect


def _series(actual_factor):
    n = len(actual_factor)
    rng = np.random.default_rng(0)
    expected = 12 + rng.normal(0, 1, n)
    return pd.DataFrame({
        "date": pd.date_range("2026-09-01", periods=n),
        "expected_kwh": expected,
        "actual_kwh": expected * np.asarray(actual_factor) * (1 + rng.normal(0, 0.02, n)),
    })


def test_healthy_system_has_no_flags():
    out = detect(_series([1.0] * 30))
    assert not out["flag"].any()


def test_trip_is_flagged_same_day():
    f = [1.0] * 30
    f[10] = 0.0
    out = detect(_series(f))
    assert out.loc[10, "kind"] == "trip"


def test_20pct_drop_flagged_within_2_days():
    f = [1.0] * 15 + [0.8] * 15
    out = detect(_series(f))
    assert out.loc[15:16, "kind"].eq("shortfall").any()
    assert not out.loc[:14, "flag"].any()


def test_dust_ramp_flagged_as_dust():
    f = [1.0] * 10 + [1 - 0.005 * d for d in range(20)]
    out = detect(_series(f))
    assert out["kind"].eq("likely_dust").any()
    assert not out.loc[:9, "flag"].any()
