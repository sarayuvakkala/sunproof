"""Should the household pay for cleaning, or wait for rain? (module M4)"""

from datetime import date, datetime, timedelta, timezone

import requests

from engine import constants as C

IST = timezone(timedelta(hours=5, minutes=30))
RAIN_MM = 5.0          # rain that washes panels
RAIN_SOON_DAYS = 3     # rain this soon means: skip
MAX_LOSS_PCT = 15.0
DEFAULT_CLEANING_COST = 300.0  # ₹ per wash (installer estimate ₹2,500-5,000/yr)
DUST_PCT_PER_DAY = C.DEFAULT_DUST_LOSS_PCT_PER_MONTH / 30


def today_ist() -> date:
    return datetime.now(IST).date()


def estimate_dust_loss_pct(days_since_rain: int) -> float:
    return min(days_since_rain * DUST_PCT_PER_DAY, MAX_LOSS_PCT)


def decide(dust_loss_pct: float, kwh_per_day: float, tariff: float, cleaning_cost: float,
           rain_forecast: list[dict], today: date | None = None) -> dict:
    """rain_forecast: [{"date": "YYYY-MM-DD", "mm": float}] for the coming days."""
    today = today or today_ist()
    rain = next((r for r in rain_forecast if r["mm"] >= RAIN_MM and date.fromisoformat(r["date"]) >= today), None)
    days_to_rain = (date.fromisoformat(rain["date"]) - today).days if rain else 30
    rupees_per_day = kwh_per_day * dust_loss_pct / 100 * tariff
    loss_until_rain = rupees_per_day * days_to_rain

    if rain and days_to_rain <= RAIN_SOON_DAYS:
        decision = "skip"
        day_en = date.fromisoformat(rain["date"]).strftime("%A")
        en = f"Skip cleaning. Rain is expected on {day_en} ({rain['mm']:.0f} mm), which should wash the panels."
        hi = f"अभी सफ़ाई न करवाएँ। {_hi_day(rain['date'])} को बारिश ({rain['mm']:.0f} मिमी) की उम्मीद है, जिससे पैनल धुल जाएँगे।"
    elif loss_until_rain > cleaning_cost:
        decision = "clean"
        en = (f"Cleaning pays. Dust is costing about ₹{rupees_per_day * 30:.0f} a month, and no rain is expected soon. "
              f"A ₹{cleaning_cost:.0f} wash pays for itself.")
        hi = (f"सफ़ाई करवाना फ़ायदेमंद है। धूल से हर महीने लगभग {rupees_per_day * 30:.0f} रुपये का नुकसान हो रहा है "
              f"और जल्दी बारिश की उम्मीद नहीं है।")
    else:
        decision = "skip"
        en = (f"Skip for now. Dust is costing only about ₹{rupees_per_day * 30:.0f} a month, "
              f"less than a ₹{cleaning_cost:.0f} wash.")
        hi = f"अभी रहने दें। धूल से हर महीने सिर्फ़ लगभग {rupees_per_day * 30:.0f} रुपये का नुकसान है, जो सफ़ाई के खर्च से कम है।"

    return {
        "decision": decision, "reason_en": en, "reason_hi": hi,
        "dust_loss_pct": round(dust_loss_pct, 1),
        "rupees_per_month": round(rupees_per_day * 30),
        "cleaning_cost": cleaning_cost,
        "rain_expected": rain,
    }


HI_DAYS = ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]


def _hi_day(iso: str) -> str:
    return HI_DAYS[date.fromisoformat(iso).weekday()]


def fetch_rain(lat: float, lon: float, past_days: int = 31, forecast_days: int = 7) -> tuple[int, list[dict]]:
    """Open-Meteo daily rain. Returns (days since last washing rain, forecast list)."""
    r = requests.get("https://api.open-meteo.com/v1/forecast", timeout=20, params={
        "latitude": lat, "longitude": lon, "timezone": "Asia/Kolkata", "daily": "precipitation_sum",
        "past_days": past_days, "forecast_days": forecast_days,
    })
    r.raise_for_status()
    d = r.json()["daily"]
    days = [{"date": t, "mm": float(mm or 0)} for t, mm in zip(d["time"], d["precipitation_sum"])]
    today = today_ist().isoformat()
    past = [x for x in days if x["date"] < today]
    last_rain = next((i for i, x in enumerate(reversed(past)) if x["mm"] >= RAIN_MM), len(past))
    return last_rain + 1, [x for x in days if x["date"] >= today]
