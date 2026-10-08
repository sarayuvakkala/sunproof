"""Build the demo household from public plant data (module M3).

One steady Kaggle Plant 1 inverter, scaled to a 3 kW home, with the plant's own
measured sunlight so expected and actual share the same sky. Dates are shifted to
end yesterday because the app replays it. It is NOT a real home, and every
screen says so.

    python -m accuracy.make_demo_household
"""

import json
import os
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from engine.expected import GAMMA_PDC, SYSTEM_LOSSES_PCT

INVERTER = "YxYtjZvoooNbGkE"  # steadiest Plant 1 inverter (daily ratio spread 3.2%)
HOME_KW = 3.0
SHARMA_DROP, SHARMA_DAYS = 0.8, 21
LABEL = "Demo household built from public plant data, not a real home"
OUT = Path(__file__).resolve().parent.parent / "data"


def load_plant1(data_dir: str):
    g = pd.read_csv(f"{data_dir}/Plant_1_Generation_Data.csv")
    g["DATE_TIME"] = pd.to_datetime(g["DATE_TIME"], dayfirst=True)
    w = pd.read_csv(f"{data_dir}/Plant_1_Weather_Sensor_Data.csv", parse_dates=["DATE_TIME"])
    return g, w


def build(data_dir: str) -> pd.DataFrame:
    g, w = load_plant1(data_dir)
    inv = g[g["SOURCE_KEY"] == INVERTER]
    energy = (inv.groupby(inv["DATE_TIME"].dt.date)["AC_POWER"].sum() * 0.25)  # kWh/day (AC_POWER is kW)

    w["day"] = w["DATE_TIME"].dt.date
    w["irr_t"] = w["IRRADIATION"] * w["MODULE_TEMPERATURE"]
    sky = w.groupby("day").agg(irr=("IRRADIATION", "sum"), irr_t=("irr_t", "sum"))
    sky["poa_kwh_m2"] = sky["irr"] * 0.25
    sky["temp_module"] = sky["irr_t"] / sky["irr"]

    df = sky[["poa_kwh_m2", "temp_module"]].join(energy.rename("plant_kwh"), how="inner")
    model_per_kw = df["poa_kwh_m2"] * (1 + GAMMA_PDC * (df["temp_module"] - 25)) * (1 - SYSTEM_LOSSES_PCT / 100) * 0.96
    effective_kw = float((df["plant_kwh"] / model_per_kw).median())
    df["actual_kwh"] = df["plant_kwh"] * HOME_KW / effective_kw

    shift = (date.today() - timedelta(days=1)) - df.index.max()
    df.index = [d + shift for d in df.index]
    df.index.name = "date"
    return df[["actual_kwh", "poa_kwh_m2", "temp_module"]].round(3)


def main():
    data_dir = os.path.expanduser(os.environ.get("SUNPROOF_DATA", "~/datasets/kaggle-solar"))
    OUT.mkdir(exist_ok=True)
    base = build(data_dir)
    base.to_csv(OUT / "demo_household.csv")

    sharma = base.copy()
    sharma.iloc[-SHARMA_DAYS:, sharma.columns.get_loc("actual_kwh")] *= SHARMA_DROP
    sharma.round(3).to_csv(OUT / "demo_sharma.csv")

    meta = {"kw": HOME_KW, "lat": 28.61, "lon": 77.21, "tilt": 20, "azimuth": 180, "tariff": 8,
            "mode": "replay", "isDemo": True, "label": LABEL,
            "source": f"Kaggle Solar Power Generation Data, Plant 1 inverter {INVERTER}",
            "sharma_variant": f"last {SHARMA_DAYS} days x {SHARMA_DROP}"}
    (OUT / "demo_household.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {len(base)} days ending {base.index.max()} to {OUT}")


if __name__ == "__main__":
    main()
