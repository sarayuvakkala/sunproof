"""Second demo house: Mehta ji, 4 kW in Jaipur, output 16% under for the last 21 days. Built from the same public plant data as
the first demo household (scaled by 4/3), so it is not a real home either.

    python -m accuracy.make_demo_mehta
"""

from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"

if __name__ == "__main__":
    df = pd.read_csv(DATA / "demo_household.csv", index_col="date", parse_dates=True)
    df["actual_kwh"] = df["actual_kwh"] * 4 / 3
    df.iloc[-21:, df.columns.get_loc("actual_kwh")] *= 0.84
    df.to_csv(DATA / "demo_mehta.csv")
