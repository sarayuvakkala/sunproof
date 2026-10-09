"""Cedar authorization: every read and every send goes through `allowed`."""

from pathlib import Path

import cedarpy

POLICIES = (Path(__file__).parent / "policies" / "sunproof.cedar").read_text()


def _uid(t: str, i: str) -> dict:
    return {"__entity": {"type": t, "id": i}}


def allowed(principal: tuple[str, str], action: str, kind: str, home: str = "", issue: str = "",
            context: dict | None = None) -> bool:
    """principal: ("Household", homeId) or ("Installer", issueId). kind: generation | evidence | issue | bill | ..."""
    ptype, pid = principal
    p_attrs = {"home": pid} if ptype == "Household" else {"issue": pid}
    rid = f"{kind}:{home or issue}"
    entities = [
        {"uid": _uid(ptype, pid), "attrs": p_attrs, "parents": []},
        {"uid": _uid("Data", rid), "attrs": {"kind": kind, "home": home, "issue": issue}, "parents": []},
    ]
    request = {
        "principal": f'{ptype}::"{pid}"',
        "action": f'Action::"{action}"',
        "resource": f'Data::"{rid}"',
        "context": context or {},
    }
    return cedarpy.is_authorized(request, POLICIES, entities).allowed
