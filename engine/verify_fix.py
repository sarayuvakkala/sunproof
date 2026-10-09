"""After the installer says it's fixed: did output really come back? How much clean energy was recovered?"""

from engine import constants as C

MIN_DAYS_AFTER = 7


def verify(daily: list[dict], fix_after: str, tariff: float = C.DEFAULT_TARIFF_INR_PER_KWH,
           min_days: int = MIN_DAYS_AFTER) -> dict:
    """daily: verdict daily rows (date, p10, p50, actual, flag). fix_after: last date before the fix.

    result: "fixed" (output back inside the expected range), "reopen" (still low) or "pending" (too few days).
    """
    before = [d for d in daily if d["date"] <= fix_after and d["flag"]]
    after = [d for d in daily if d["date"] > fix_after]
    if len(after) < min_days:
        return {"result": "pending", "days_after": len(after)}

    exp_after = sum(d["p50"] for d in after)
    ratio_after = sum(d["actual"] for d in after) / exp_after if exp_after else 0.0
    ratio_before = (sum(d["actual"] for d in before) / sum(d["p50"] for d in before)) if before else ratio_after
    back_in_range = sum(d["actual"] for d in after) >= sum(d["p10"] for d in after)

    recovered = max(ratio_after - ratio_before, 0.0) * exp_after if back_in_range else 0.0
    return {
        "result": "fixed" if back_in_range else "reopen",
        "days_after": len(after),
        "ratio_before": round(ratio_before, 3),
        "ratio_after": round(ratio_after, 3),
        "recovered": {"kwh": round(recovered, 1), "rupees": round(recovered * tariff),
                      "co2_kg": round(recovered * C.CO2_KG_PER_KWH, 1)},
    }
