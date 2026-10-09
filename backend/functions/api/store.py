"""Shared AWS clients and small DynamoDB helpers."""

import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.config import Config

REGION = os.environ.get("AWS_REGION", "ap-south-1")
TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE"])
BUCKET = os.environ["BUCKET"]
# Regional endpoint + SigV4 so presigned links work for a Mumbai bucket without a redirect.
s3 = boto3.client("s3", region_name=REGION, endpoint_url=f"https://s3.{REGION}.amazonaws.com",
                  config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
sfn = boto3.client("stepfunctions")
polly = boto3.client("polly")

APP_URL = os.environ.get("APP_URL", "").rstrip("/")
STATE_MACHINE_ARN = os.environ.get("STATE_MACHINE_ARN", "")
DEMO_TIME_SCALE = float(os.environ.get("DEMO_TIME_SCALE", "1"))  # 1440 => 7 days run in 7 minutes
RESPONSE_DAYS = 7  # MNRE procedure: vendor explains a complaint within seven days


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def to_dynamo(v):
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, dict):
        return {k: to_dynamo(x) for k, x in v.items()}
    if isinstance(v, list):
        return [to_dynamo(x) for x in v]
    return v


def from_dynamo(v):
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, dict):
        return {k: from_dynamo(x) for k, x in v.items()}
    if isinstance(v, list):
        return [from_dynamo(x) for x in v]
    return v


def get(pk: str, sk: str = "META"):
    item = TABLE.get_item(Key={"PK": pk, "SK": sk}).get("Item")
    return from_dynamo(item) if item else None


def put(item: dict):
    TABLE.put_item(Item=to_dynamo(item))


def presign(key: str, expires: int = 3600) -> str:
    return s3.generate_presigned_url("get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=expires)
