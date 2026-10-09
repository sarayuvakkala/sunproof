"""Household data: readings, verdict, voice, clean-or-skip, demo reset."""

import os
import uuid
from datetime import timedelta
from pathlib import Path

import pandas as pd
from boto3.dynamodb.conditions import Key

from engine import expected as E
from engine.clean_or_skip import DEFAULT_CLEANING_COST, decide, estimate_dust_loss_pct, fetch_rain, today_ist
from engine.verdict import build_verdict
from .store import BUCKET, TABLE, from_dynamo, get, polly, presign, put, s3, to_dynamo

DATA = Path(__file__).resolve().parent.parent / "data"
DEMO_HOMES = {"demo": ("demo_household.csv", "Demo home"), "demo-sharma": ("demo_sharma.csv", "Sharma ji (demo)")}


def readings(home_id: str, days: int = 60) -> pd.DataFrame:
    items = TABLE.query(
        KeyConditionExpression=Key("PK").eq(f"HOME#{home_id}") & Key("SK").begins_with("READING#"),
        ScanIndexForward=False, Limit=days,
    )["Items"]
    rows = [{"date": i["SK"].split("#", 1)[1], **{k: v for k, v in from_dynamo(i).items() if k not in ("PK", "SK")}}
            for i in items]
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows).sort_values("date").set_index("date")
    df.index = pd.to_datetime(df.index)
    return df


def system_of(meta: dict) -> E.System:
    return E.System(kw=float(meta["kw"]), lat=float(meta["lat"]), lon=float(meta["lon"]),
                    tilt=float(meta.get("tilt", 20)), azimuth=float(meta.get("azimuth", 180)))


def verdict_for(home_id: str, days: int = 30):
    meta = get(f"HOME#{home_id}")
    if meta is None:
        return None
    r = readings(home_id, days)
    system = system_of(meta)
    if len(r) == 0:
        expected = pd.DataFrame(columns=["p10", "p50", "p90"])
    elif meta.get("mode") == "replay":
        expected = E.from_daily_poa(system, r[["poa_kwh_m2", "temp_module"]])
    else:
        past = (pd.Timestamp.now(tz=system.tz).normalize().tz_localize(None) - r.index.min()).days + 1
        expected = E.from_weather(system, E.fetch_open_meteo(system, past_days=min(max(past, 1), 92)))
    actual = r["actual_kwh"] if len(r) else pd.Series(dtype=float)
    v = build_verdict(expected, actual, tariff=float(meta.get("tariff", 8)))
    replay_from = r.index[r["replay"].fillna(False).astype(bool)].min() if "replay" in r else None
    v.update({"homeId": home_id, "isDemo": bool(meta.get("isDemo")), "label": meta.get("label"),
              "name": meta.get("name"), "activeIssue": meta.get("active_issue"),
              "installerName": meta.get("installer_name"),
              "replayFrom": str(replay_from.date()) if replay_from is not None and not pd.isna(replay_from) else None})
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
    return {"audio_url": presign(key), "text": text}


def clean_or_skip(home_id: str, scenario: str | None = None):
    """scenario 'rain' or 'dust' simulates the forecast, for demo homes only. Anything else is the live forecast."""
    meta = get(f"HOME#{home_id}")
    if meta is None:
        return None
    v = verdict_for(home_id)
    simulated = scenario if (scenario in ("rain", "dust") and os.environ.get("DEMO_MODE", "true") == "true"
                             and meta.get("isDemo")) else None
    today = today_ist()
    dry = [{"date": str(today + timedelta(days=i)), "mm": 0.0} for i in range(7)]

    if simulated == "rain":
        days_since_rain = 26
        forecast = [dict(d, mm=9.0) if i == 2 else d for i, d in enumerate(dry)]
        loss = estimate_dust_loss_pct(days_since_rain)
    elif simulated == "dust":
        days_since_rain, forecast, loss = 35, dry, 13.0
    else:
        days_since_rain, forecast = fetch_rain(float(meta["lat"]), float(meta["lon"]))
        if v and v["status"] == "likely_dust":
            loss = max(100 * (1 - (v["ratio"] or 1)), 0.0)
        else:
            loss = estimate_dust_loss_pct(days_since_rain)

    kwh_per_day = (v["expected_kwh"] / max(len(v["daily"]), 1)) if v and v["daily"] else float(meta["kw"]) * 4
    out = decide(loss, kwh_per_day, float(meta.get("tariff", 8)),
                 float(meta.get("cleaning_cost", DEFAULT_CLEANING_COST)), forecast, today=today)
    out["days_since_rain"] = days_since_rain
    out["simulated"] = simulated
    return out


def write_readings(home_id: str, df: pd.DataFrame, replay: bool = False):
    with TABLE.batch_writer() as batch:
        for d, row in df.iterrows():
            item = {"PK": f"HOME#{home_id}", "SK": f"READING#{pd.Timestamp(d).date()}",
                    **{k: float(v) for k, v in row.items() if k in ("actual_kwh", "poa_kwh_m2", "temp_module")}}
            if replay:
                item["replay"] = True
            batch.put_item(Item=to_dynamo(item))


def delete_readings(home_id: str):
    items = TABLE.query(KeyConditionExpression=Key("PK").eq(f"HOME#{home_id}") & Key("SK").begins_with("READING#"),
                        ProjectionExpression="PK, SK")["Items"]
    with TABLE.batch_writer() as batch:
        for i in items:
            batch.delete_item(Key={"PK": i["PK"], "SK": i["SK"]})


def reset_demo(installer_email: str):
    """Put both demo homes back to their starting state and empty the recovery counter (for re-recording the demo)."""
    import json
    from boto3.dynamodb.conditions import Attr
    old = TABLE.scan(FilterExpression=Attr("PK").begins_with("ISSUE#") | Attr("PK").begins_with("TOKEN#"),
                     ProjectionExpression="PK, SK")["Items"]
    with TABLE.batch_writer() as batch:
        for r in old:
            batch.delete_item(Key={"PK": r["PK"], "SK": r["SK"]})
    for pk in ("LEDGER", "OPEN_ISSUES"):
        rows = TABLE.query(KeyConditionExpression=Key("PK").eq(pk), ProjectionExpression="PK, SK")["Items"]
        with TABLE.batch_writer() as batch:
            for r in rows:
                batch.delete_item(Key={"PK": r["PK"], "SK": r["SK"]})
    meta = json.loads((DATA / "demo_household.json").read_text())
    meta.pop("sharma_variant", None)
    for home_id, (csv, name) in DEMO_HOMES.items():
        delete_readings(home_id)
        df = pd.read_csv(DATA / csv, index_col="date", parse_dates=True)
        shift = (pd.Timestamp.now(tz="Asia/Kolkata").normalize().tz_localize(None) - pd.Timedelta(1, "D")) - df.index.max()
        df.index = df.index + shift
        write_readings(home_id, df)
        put({"PK": f"HOME#{home_id}", "SK": "META", **meta, "name": name,
             "installer_name": "Test installer (demo)", "installer_email": installer_email,
             "active_issue": None})
    return {"ok": True, "homes": list(DEMO_HOMES)}


def replay_after_fix(home_id: str, outcome: str = "fixed", days: int = 8):
    """Demo: append `days` of readings after the last one. 'fixed' = healthy output, 'still_low' = 20% under."""
    base = pd.read_csv(DATA / "demo_household.csv", index_col="date", parse_dates=True).tail(days).copy()
    last = readings(home_id, 5).index.max()
    base.index = [last + pd.Timedelta(i + 1, "D") for i in range(len(base))]
    if outcome == "still_low":
        base["actual_kwh"] = base["actual_kwh"] * 0.8
    write_readings(home_id, base, replay=True)
