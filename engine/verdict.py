"""Turn expected vs actual into a plain-words verdict with units, ₹ and CO₂."""

import pandas as pd

from engine import constants as C
from engine.detect import detect

MESSAGES = {
    "ok": {
        "en": "Your solar is working as expected. It made {actual:.0f} units against an expected {lo:.0f}–{hi:.0f}.",
        "hi": "आपका सोलर सिस्टम ठीक चल रहा है। इसने {actual:.0f} यूनिट बनाए, उम्मीद {lo:.0f} से {hi:.0f} यूनिट की थी।",
    },
    "shortfall": {
        "en": "Your solar made about {pct:.0f}% less than expected. That is {units:.0f} units, about ₹{rupees:.0f} and {co2:.0f} kg of extra CO₂. Worth checking with your installer.",
        "hi": "आपके सोलर ने उम्मीद से लगभग {pct:.0f}% कम बिजली बनाई। यह {units:.0f} यूनिट, लगभग {rupees:.0f} रुपये और {co2:.0f} किलो अतिरिक्त CO₂ है। अपने इंस्टॉलर से जाँच करवाना ठीक रहेगा।",
    },
    "trip": {
        "en": "Your solar seems to have stopped on {days} day(s). That is {units:.0f} units, about ₹{rupees:.0f} and {co2:.0f} kg of extra CO₂. Worth checking the inverter.",
        "hi": "लगता है आपका सोलर {days} दिन बंद रहा। यह {units:.0f} यूनिट, लगभग {rupees:.0f} रुपये और {co2:.0f} किलो अतिरिक्त CO₂ है। इन्वर्टर की जाँच करवाना ठीक रहेगा।",
    },
    "likely_dust": {
        "en": "Output is slowly dropping, which usually means dust. About {units:.0f} units (₹{rupees:.0f}) lost so far. See whether cleaning is worth it.",
        "hi": "बिजली धीरे-धीरे कम हो रही है, जो आमतौर पर धूल की वजह से होता है। अब तक लगभग {units:.0f} यूनिट ({rupees:.0f} रुपये) का नुकसान हुआ। देखें कि सफ़ाई करवाना फ़ायदेमंद है या नहीं।",
    },
    "insufficient_data": {
        "en": "Not enough readings yet to judge. Add a few more days.",
        "hi": "अभी फ़ैसला करने के लिए पर्याप्त रीडिंग नहीं हैं। कुछ और दिनों की रीडिंग जोड़ें।",
    },
}

PRIORITY = ["trip", "shortfall", "likely_dust"]


def build_verdict(expected: pd.DataFrame, actual: pd.Series,
                  tariff: float = C.DEFAULT_TARIFF_INR_PER_KWH) -> dict:
    """expected: index date, columns p10/p50/p90. actual: daily kWh indexed by date."""
    df = expected.join(actual.rename("actual_kwh"), how="inner").dropna(subset=["actual_kwh"])
    if len(df) < 5:
        return _result("insufficient_data", df, tariff, units=0.0, days=0)

    det = detect(pd.DataFrame({"date": df.index, "expected_kwh": df["p50"].values,
                               "actual_kwh": df["actual_kwh"].values}))
    df["flag"] = det["kind"].values

    flagged = df[df["flag"].notna()]
    units = float((flagged["p50"] - flagged["actual_kwh"]).clip(lower=0).sum())
    flagged_expected = float(flagged["p50"].sum())
    pct = 100 * units / flagged_expected if flagged_expected else 0.0
    kinds = set(flagged["flag"])
    status = next((k for k in PRIORITY if k in kinds), "ok")
    return _result(status, df, tariff, units=units, days=int((df["flag"] == "trip").sum()), pct=pct)


def _result(status: str, df: pd.DataFrame, tariff: float, units: float, days: int, pct: float = 0.0) -> dict:
    expected = float(df["p50"].sum()) if len(df) else 0.0
    actual = float(df["actual_kwh"].sum()) if len(df) else 0.0
    rupees, co2 = units * tariff, units * C.CO2_KG_PER_KWH
    vals = dict(actual=actual, lo=float(df["p10"].sum()) if len(df) else 0, hi=float(df["p90"].sum()) if len(df) else 0,
                pct=pct, units=units, rupees=rupees, co2=co2, days=days)
    return {
        "status": status,
        "period": {"start": str(df.index.min().date()), "end": str(df.index.max().date())} if len(df) else None,
        "expected_kwh": round(expected, 1),
        "expected_band_kwh": [round(vals["lo"], 1), round(vals["hi"], 1)],
        "actual_kwh": round(actual, 1),
        "ratio": round(actual / expected, 3) if expected else None,
        "units_lost": round(units, 1),
        "rupees_lost": round(rupees),
        "co2_kg": round(co2, 1),
        "daily": [
            {"date": str(d.date()), "p10": round(r.p10, 2), "p50": round(r.p50, 2), "p90": round(r.p90, 2),
             "actual": round(r["actual_kwh"], 2), "flag": r.get("flag") if isinstance(r.get("flag"), str) else None}
            for d, r in df.iterrows()
        ],
        "message": {lang: MESSAGES[status][lang].format(**vals) for lang in ("en", "hi")},
        # The drop itself, so every screen quotes the same numbers: % below expected on the low days, when it began, how long.
        "pct_below": round(pct),
        "drop_start": str(df.index[df["flag"].notna()].min().date()) if "flag" in df and df["flag"].notna().any() else None,
        "drop_days": int(df["flag"].notna().sum()) if "flag" in df else 0,
        "assumptions": {"tariff_inr_per_kwh": tariff, "co2_kg_per_kwh": C.CO2_KG_PER_KWH, "co2_source": C.CO2_SOURCE},
    }
