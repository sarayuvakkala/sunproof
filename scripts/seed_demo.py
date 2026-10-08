"""Load the demo households into DynamoDB.

    python scripts/seed_demo.py <TableName>
"""

import json
import sys
from decimal import Decimal
from pathlib import Path

import boto3
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"

HOMES = {
    "demo": ("demo_household.csv", "Demo home"),
    "demo-sharma": ("demo_sharma.csv", "Sharma ji (demo)"),
}


def main(table_name: str):
    table = boto3.resource("dynamodb").Table(table_name)
    meta = json.loads((DATA / "demo_household.json").read_text(), parse_float=Decimal)
    with table.batch_writer() as batch:
        for home_id, (csv, name) in HOMES.items():
            batch.put_item(Item={"PK": f"HOME#{home_id}", "SK": "META", "name": name,
                                 **{k: v for k, v in meta.items() if k != "sharma_variant"}})
            for d, row in pd.read_csv(DATA / csv, index_col="date").iterrows():
                batch.put_item(Item={"PK": f"HOME#{home_id}", "SK": f"READING#{d}",
                                     **{k: Decimal(str(v)) for k, v in row.items()}})
    print(f"seeded {list(HOMES)} into {table_name}")


if __name__ == "__main__":
    main(sys.argv[1])
