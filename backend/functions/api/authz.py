"""Cedar authorization: every read and every send goes through `allowed`."""

from pathlib import Path

import cedarpy

POLICIES = (Path(__file__).parent / "policies" / "sunproof.cedar").read_text()


def _uid(t: str, i: str) -> dict:
    return {"__entity": {"type": t, "id": i}}


def allowed(principal: tuple[str, str], action: str, kind: str, home: str = "", issue: str = "",
            context: dict | None = None, installer: str = "") -> bool:
    """principal: ("Household", homeId), ("Installer", issueId) or ("Pro", installerId).
    kind: generation | evidence | issue | record | bill | ...  `installer` names who the resource belongs to."""
    ptype, pid = principal
    p_attrs = {"Household": {"home": pid}, "Installer": {"issue": pid}, "Pro": {"pro": pid}}[ptype]
    rid = f"{kind}:{home or issue or installer}"
    entities = [
        {"uid": _uid(ptype, pid), "attrs": p_attrs, "parents": []},
        {"uid": _uid("Data", rid), "attrs": {"kind": kind, "home": home, "issue": issue, "installer": installer}, "parents": []},
    ]
    request = {
        "principal": f'{ptype}::"{pid}"',
        "action": f'Action::"{action}"',
        "resource": f'Data::"{rid}"',
        "context": context or {},
    }
    return cedarpy.is_authorized(request, POLICIES, entities).allowed
