"""HTTP API entry point. One container Lambda serves the household and public routes."""

import json
import os
import uuid
from decimal import Decimal
from pathlib import Path

import boto3
import pandas as pd
from botocore.config import Config
from boto3.dynamodb.conditions import Key

from engine import expected as E
from engine.verdict import build_verdict

TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE"])
BUCKET = os.environ["BUCKET"]
REGION = os.environ.get("AWS_REGION", "ap-south-1")
# Regional endpoint + SigV4 so presigned links work for a Mumbai bucket without a redirect.
s3 = boto3.client("s3", region_name=REGION, endpoint_url=f"https://s3.{REGION}.amazonaws.com",
                  config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
polly = boto3.client("polly")

REPORT = Path(__file__).resolve().parent.parent / "accuracy" / "report.json"


def _resp(status: int, body) -> dict:
    return {"statusCode": status, "headers": {"content-type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=_num)}


def _num(o):
    if isinstance(o, Decimal):
        return float(o)
    raise TypeError(type(o))


def load_home(home_id: str, days: int):
    meta = TABLE.get_item(Key={"PK": f"HOME#{home_id}", "SK": "META"}).get("Item")
    if not meta:
        return None, None
    items = TABLE.query(
        KeyConditionExpression=Key("PK").eq(f"HOME#{home_id}") & Key("SK").begins_with("READING#"),
        ScanIndexForward=False, Limit=days,
    )["Items"]
    rows = [{"date": i["SK"].split("#", 1)[1], **{k: float(v) for k, v in i.items() if isinstance(v, Decimal)}}
            for i in items]
    readings = pd.DataFrame(rows).sort_values("date").set_index("date") if rows else pd.DataFrame()
    if len(readings):
        readings.index = pd.to_datetime(readings.index)
    return meta, readings


def verdict_for(home_id: str, days: int = 30):
    meta, readings = load_home(home_id, days)
    if meta is None:
        return None
    system = E.System(kw=float(meta["kw"]), lat=float(meta["lat"]), lon=float(meta["lon"]),
                      tilt=float(meta.get("tilt", 20)), azimuth=float(meta.get("azimuth", 180)))
    if len(readings) == 0:
        expected = pd.DataFrame(columns=["p10", "p50", "p90"])
    elif meta.get("mode") == "replay":
        expected = E.from_daily_poa(system, readings[["poa_kwh_m2", "temp_module"]])
    else:
        past = (pd.Timestamp.now(tz=system.tz).normalize().tz_localize(None) - readings.index.min()).days + 1
        expected = E.from_weather(system, E.fetch_open_meteo(system, past_days=min(max(past, 1), 92)))
    actual = readings["actual_kwh"] if len(readings) else pd.Series(dtype=float)
    v = build_verdict(expected, actual, tariff=float(meta.get("tariff", 8)))
    v.update({"homeId": home_id, "isDemo": bool(meta.get("isDemo", False)), "label": meta.get("label"),
              "name": meta.get("name")})
    return v


def voice(home_id: str, lang: str):
    v = verdict_for(home_id)
    if v is None:
        return None
    text = v["message"]["hi" if lang == "hi" else "en"]
    audio = polly.synthesize_speech(Text=text, VoiceId="Kajal", Engine="neural", OutputFormat="mp3",
                                    LanguageCode="hi-IN" if lang == "hi" else "en-IN")["AudioStream"].read()
    key = f"tmp/voice/{home_id}/{uuid.uuid4().hex}.mp3"
    s3.put_object(Bucket=BUCKET, Key=key, Body=audio, ContentType="audio/mpeg")
    url = s3.generate_presigned_url("get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=3600)
    return {"audio_url": url, "text": text}


def handler(event, _ctx):
    route = event.get("routeKey", "")
    params = event.get("pathParameters") or {}
    query = event.get("queryStringParameters") or {}
    body = json.loads(event["body"]) if event.get("body") else {}

    if route == "GET /homes/{homeId}/verdict":
        v = verdict_for(params["homeId"], int(query.get("days", 30)))
        return _resp(200, v) if v else _resp(404, {"error": "home not found"})

    if route == "POST /homes/{homeId}/voice":
        out = voice(params["homeId"], body.get("lang", "hi"))
        return _resp(200, out) if out else _resp(404, {"error": "home not found"})

    if route == "GET /accuracy":
        if REPORT.exists():
            return _resp(200, json.loads(REPORT.read_text()))
        return _resp(200, {"status": "pending"})

    return _resp(404, {"error": f"no route {route}"})
