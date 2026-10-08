"""Load the Kaggle plants as one daily table per inverter: date, source_key, actual_kwh, poa_kwh_m2, temp_module."""

import os

import pandas as pd


def data_dir() -> str:
    return os.path.expanduser(os.environ.get("SUNPROOF_DATA", "~/datasets/kaggle-solar"))


def load_daily(plant: int) -> pd.DataFrame:
    d = data_dir()
    g = pd.read_csv(f"{d}/Plant_{plant}_Generation_Data.csv")
    g["DATE_TIME"] = pd.to_datetime(g["DATE_TIME"], dayfirst=(plant == 1))  # Plant 1 dates are day-first
    w = pd.read_csv(f"{d}/Plant_{plant}_Weather_Sensor_Data.csv", parse_dates=["DATE_TIME"])

    g["date"] = g["DATE_TIME"].dt.normalize()
    energy = (g.groupby(["SOURCE_KEY", "date"])["AC_POWER"].sum() * 0.25).rename("actual_kwh")  # AC_POWER is kW

    w["date"] = w["DATE_TIME"].dt.normalize()
    w["irr_t"] = w["IRRADIATION"] * w["MODULE_TEMPERATURE"]
    sky = w.groupby("date").agg(irr=("IRRADIATION", "sum"), irr_t=("irr_t", "sum"))
    sky["poa_kwh_m2"] = sky["irr"] * 0.25
    sky["temp_module"] = sky["irr_t"] / sky["irr"]

    out = energy.reset_index().rename(columns={"SOURCE_KEY": "source_key"})
    return out.merge(sky[["poa_kwh_m2", "temp_module"]].reset_index(), on="date", how="inner")
