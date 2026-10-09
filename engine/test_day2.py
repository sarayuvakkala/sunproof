from datetime import date

import pandas as pd

from engine.clean_or_skip import decide, estimate_dust_loss_pct
from engine.evidence import render
from engine.verify_fix import verify

TODAY = date(2026, 10, 8)  # a Thursday


def test_rain_soon_means_skip():
    r = decide(6.0, 12, 8, 300, [{"date": "2026-10-11", "mm": 9.0}], today=TODAY)
    assert r["decision"] == "skip"
    assert "Sunday" in r["reason_en"] and "रविवार" in r["reason_hi"]


def test_heavy_dust_no_rain_means_clean():
    r = decide(12.0, 12, 8, 300, [], today=TODAY)
    assert r["decision"] == "clean"


def test_light_dust_means_skip():
    r = decide(1.0, 12, 8, 300, [], today=TODAY)
    assert r["decision"] == "skip"


def test_dust_estimate_capped():
    assert round(estimate_dust_loss_pct(30), 6) == 7.6
    assert estimate_dust_loss_pct(400) == 15.0


def _daily(before_factor, after_factor, n_before=10, n_after=7):
    rows = []
    for i in range(n_before + n_after):
        f = before_factor if i < n_before else after_factor
        rows.append({"date": f"2026-09-{i + 1:02d}", "p10": 10.8, "p50": 12.0, "p90": 13.0,
                     "actual": 12.0 * f, "flag": "shortfall" if f < 0.9 else None})
    return rows


def test_fix_confirmed_and_recovered_counted():
    r = verify(_daily(0.8, 1.0), fix_after="2026-09-10")
    assert r["result"] == "fixed"
    assert r["recovered"]["kwh"] == 16.8  # 7 days x 12 kWh x 0.2


def test_still_low_reopens():
    assert verify(_daily(0.8, 0.8), fix_after="2026-09-10")["result"] == "reopen"


def test_too_few_days_pending():
    assert verify(_daily(0.8, 1.0, n_after=3), fix_after="2026-09-10")["result"] == "pending"


def test_evidence_png():
    d = pd.DataFrame(_daily(1.0, 0.8))
    png = render(d, "Expected vs actual")
    assert png[:8] == b"\x89PNG\r\n\x1a\n" and len(png) > 10_000
