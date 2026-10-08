"""Expected generation for a rooftop system, as a daily range (P10/P50/P90).

Two weather inputs:
- `from_weather`: hourly GHI/DNI/DHI + air temperature (Open-Meteo), for real homes.
- `from_poa`: measured plane-of-array sunlight + module temperature, for replayed
  public-plant data (the demo household), so expected and actual share the same sky.
"""

from dataclasses import dataclass

import pandas as pd
import pvlib
import requests

# Daily uncertainty of a weather-driven estimate. Kept wide on purpose:
# verdicts are ranges, not accusations.
BAND_LOW, BAND_HIGH = 0.90, 1.08
SYSTEM_LOSSES_PCT = 14.0  # PVWatts default: wiring, mismatch, soiling baseline, etc.
GAMMA_PDC = -0.004        # power temperature coefficient, 1/°C


@dataclass(frozen=True)
class System:
    kw: float
    lat: float
    lon: float
    tilt: float = 20.0
    azimuth: float = 180.0  # south
    tz: str = "Asia/Kolkata"


def _ac_kw(system: System, poa_wm2: pd.Series, temp_cell: pd.Series) -> pd.Series:
    pdc = pvlib.pvsystem.pvwatts_dc(poa_wm2, temp_cell, system.kw * 1000, GAMMA_PDC)
    pdc = pdc * (1 - SYSTEM_LOSSES_PCT / 100)
    pac = pvlib.inverter.pvwatts(pdc, pdc0=system.kw * 1000 / 0.96)
    return pac.clip(lower=0) / 1000


def _daily_band(ac_kw: pd.Series) -> pd.DataFrame:
    step_h = pd.Series(ac_kw.index).diff().median() / pd.Timedelta(hours=1)
    p50 = (ac_kw * step_h).groupby(ac_kw.index.date).sum()
    out = pd.DataFrame({"p50": p50})
    out["p10"], out["p90"] = out["p50"] * BAND_LOW, out["p50"] * BAND_HIGH
    out.index = pd.to_datetime(out.index)
    out.index.name = "date"
    return out[["p10", "p50", "p90"]]


def from_weather(system: System, hourly: pd.DataFrame) -> pd.DataFrame:
    """hourly: tz-aware index, columns ghi, dni, dhi (W/m²), temp_air (°C), wind_speed (m/s)."""
    solpos = pvlib.solarposition.get_solarposition(hourly.index, system.lat, system.lon)
    poa = pvlib.irradiance.get_total_irradiance(
        system.tilt, system.azimuth, solpos["apparent_zenith"], solpos["azimuth"],
        hourly["dni"], hourly["ghi"], hourly["dhi"],
    )["poa_global"].fillna(0)
    temp_cell = pvlib.temperature.faiman(poa, hourly["temp_air"], hourly.get("wind_speed", 1.0))
    return _daily_band(_ac_kw(system, poa, temp_cell))


def from_poa(system: System, measured: pd.DataFrame) -> pd.DataFrame:
    """measured: datetime index, columns poa_wm2, temp_module (°C)."""
    return _daily_band(_ac_kw(system, measured["poa_wm2"], measured["temp_module"]))


OPEN_METEO = "https://api.open-meteo.com/v1/forecast"


def fetch_open_meteo(system: System, past_days: int = 31, forecast_days: int = 1) -> pd.DataFrame:
    """Hourly weather for the last `past_days` days (Open-Meteo, free for non-commercial use)."""
    r = requests.get(OPEN_METEO, timeout=20, params={
        "latitude": system.lat, "longitude": system.lon, "timezone": system.tz,
        "hourly": "shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m,wind_speed_10m",
        "wind_speed_unit": "ms", "past_days": past_days, "forecast_days": forecast_days,
    })
    r.raise_for_status()
    h = r.json()["hourly"]
    idx = pd.DatetimeIndex(pd.to_datetime(h["time"])).tz_localize(system.tz)
    return pd.DataFrame({
        "ghi": h["shortwave_radiation"], "dni": h["direct_normal_irradiance"],
        "dhi": h["diffuse_radiation"], "temp_air": h["temperature_2m"],
        "wind_speed": h["wind_speed_10m"],
    }, index=idx)
