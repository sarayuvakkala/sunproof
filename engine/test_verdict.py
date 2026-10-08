import numpy as np
import pandas as pd

from engine import constants as C
from engine.verdict import build_verdict


def _inputs(factor):
    n = len(factor)
    idx = pd.date_range("2026-09-01", periods=n, name="date")
    p50 = pd.Series(12.0, index=idx)
    expected = pd.DataFrame({"p10": p50 * 0.9, "p50": p50, "p90": p50 * 1.08})
    actual = p50 * np.asarray(factor)
    return expected, actual


def test_healthy_is_ok_with_no_loss():
    v = build_verdict(*_inputs([1.0] * 30))
    assert v["status"] == "ok"
    assert v["units_lost"] == 0
    assert "working as expected" in v["message"]["en"]


def test_20pct_drop_reports_units_rupees_co2():
    v = build_verdict(*_inputs([1.0] * 9 + [0.8] * 21))
    assert v["status"] == "shortfall"
    # 21 flagged days x 2.4 kWh lost; first drop day is caught a day later, so allow a small gap
    assert 45 <= v["units_lost"] <= 50.4
    assert v["rupees_lost"] == round(v["units_lost"] * C.DEFAULT_TARIFF_INR_PER_KWH)
    assert v["co2_kg"] == round(v["units_lost"] * C.CO2_KG_PER_KWH, 1)
    assert "about 20% less" in v["message"]["en"]
    assert "worth checking" in v["message"]["en"].lower()


def test_trip_beats_other_statuses():
    f = [1.0] * 30
    f[20] = 0.0
    v = build_verdict(*_inputs(f))
    assert v["status"] == "trip"
    assert "1 day" in v["message"]["en"]


def test_too_few_days():
    assert build_verdict(*_inputs([1.0] * 3))["status"] == "insufficient_data"
