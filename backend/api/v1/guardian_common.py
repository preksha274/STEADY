"""
STEADY Guardian - Shared authorization & data helpers.

This module centralises *all* cross-user access for the Guardian safety
layer. Nothing here weakens the DataStore's per-user isolation:

- Reads/writes of a specific user's documents still go through the existing
  ``DataStore`` methods (which enforce ``user_id`` matching).
- The only "cross-user" operation is a read-only scan of a collection used to
  *discover* guardian links / alerts / zones by id. Every such scan is always
  paired with an explicit authorization check (``assert_patient_access``)
  before any patient data is returned.

Authorization model
-------------------
A user may access a patient's Guardian data when either:
  * the user *is* that patient, or
  * an active ``guardian_links`` document links the user (as guardian) to the
    patient.

No generic "read any user's data" method is added to the DataStore.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from db.store import db

# ---------------------------------------------------------------------------
# Collection names (DataStore lazily creates each on first write)
# ---------------------------------------------------------------------------
GUARDIAN_LINKS = "guardian_links"
PAIRING_CODES = "guardian_pairing_codes"
SAFE_ZONES = "safe_zones"
LOCATION_PINGS = "location_pings"
ALERTS = "alerts"
GUARDIAN_SETTINGS = "guardian_settings"

# ---------------------------------------------------------------------------
# Alert taxonomy
# ---------------------------------------------------------------------------
ALERT_TYPES = (
    "SAFE_ZONE_BREACH",
    "SAFE_ZONE_RETURN",
    "NIGHT_ACTIVITY",
    "PROLONGED_INACTIVITY",
    "FREEZE_ASSIST",
    "SOS",
)

ALERT_PRIORITIES = ("INFO", "AWARENESS", "IMPORTANT", "HIGH", "CRITICAL")

# Guardian settings defaults (non-diagnostic, configurable thresholds only).
DEFAULT_SETTINGS: Dict[str, Any] = {
    "inactivity_threshold_min": 180,
    "inactivity_alert_active": False,
    "last_activity_at": None,
    "night_enabled": False,
    "night_start_time": "22:00",
    "night_end_time": "07:00",
    "last_night_alert_key": None,
    "last_night_alert_date": None,
    "geofence_inside": None,
    "geofence_last_evaluated_at": None,
}


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_hhmm(value: Optional[str]) -> Optional[int]:
    """Parse ``HH:MM`` into minutes-since-midnight, or ``None`` if invalid."""
    if not value:
        return None
    try:
        parts = str(value).split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return None
        return hour * 60 + minute
    except (ValueError, IndexError):
        return None


def is_within_night_window(now: datetime, start_str: str, end_str: str) -> bool:
    """True when ``now`` falls inside the configured night window (wrap-safe)."""
    start = _parse_hhmm(start_str)
    end = _parse_hhmm(end_str)
    if start is None or end is None:
        return False
    now_min = now.hour * 60 + now.minute
    if start == end:
        return False
    if start < end:
        return start <= now_min < end
    # Window wraps past midnight.
    return now_min >= start or now_min < end


def _night_window_key(now: datetime, start_str: str, end_str: str) -> str:
    """Stable key identifying the *night* a moment belongs to (dedup support)."""
    start = _parse_hhmm(start_str)
    end = _parse_hhmm(end_str)
    day = now.date()
    if start is not None and end is not None and start > end:
        now_min = now.hour * 60 + now.minute
        if now_min < end:
            day = day - timedelta(days=1)
    return day.isoformat()
# ---------------------------------------------------------------------------
# Local read-only collection scan (authorization lookups only)
# ---------------------------------------------------------------------------
def _all_docs(collection_name: str) -> List[Dict[str, Any]]:
    """
    Return a snapshot of every document in a collection.

    Used exclusively to *locate* records by id or relationship before an
    authorization check. Never returned to a client directly. Accessing the
    DataStore's in-memory collection avoids adding a public cross-user API.
    """
    return list(db._get_coll(collection_name).values())


# ---------------------------------------------------------------------------
# Guardian link helpers
# ---------------------------------------------------------------------------
def get_links_for_patient(patient_id: str) -> List[Dict[str, Any]]:
    return [
        d
        for d in _all_docs(GUARDIAN_LINKS)
        if d.get("patient_id") == patient_id and d.get("status", "active") == "active"
    ]


def get_links_for_guardian(guardian_id: str) -> List[Dict[str, Any]]:
    return [
        d
        for d in _all_docs(GUARDIAN_LINKS)
        if d.get("guardian_id") == guardian_id and d.get("status", "active") == "active"
    ]


def is_linked(guardian_id: str, patient_id: str) -> bool:
    return any(
        d.get("guardian_id") == guardian_id
        and d.get("patient_id") == patient_id
        and d.get("status", "active") == "active"
        for d in _all_docs(GUARDIAN_LINKS)
    )


def find_link(link_id: str) -> Optional[Dict[str, Any]]:
    for d in _all_docs(GUARDIAN_LINKS):
        if d.get("id") == link_id:
            return d
    return None


def is_participant(link: Optional[Dict[str, Any]], user_id: str) -> bool:
    if not link:
        return False
    return user_id in (link.get("patient_id"), link.get("guardian_id"))


def find_pairing_code(code: str) -> Optional[Dict[str, Any]]:
    target = (code or "").strip().upper()
    for d in _all_docs(PAIRING_CODES):
        if d.get("id") == target or d.get("code") == target:
            return d
    return None


def accessible_patient_ids(user: Any) -> List[str]:
    """Patient ids the user may read: themselves + linked patients."""
    ids: List[str] = [user.user_id]
    for link in get_links_for_guardian(user.user_id):
        pid = link.get("patient_id")
        if pid and pid not in ids:
            ids.append(pid)
    return ids


def assert_patient_access(user: Any, patient_id: str) -> None:
    """Raise 403 unless the user is the patient or a linked guardian."""
    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="patient_id is required."
        )
    if patient_id == user.user_id:
        return
    if is_linked(user.user_id, patient_id):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to access this patient's Guardian data.",
    )


# ---------------------------------------------------------------------------
# Safe zone helpers
# ---------------------------------------------------------------------------
def find_safe_zone(zone_id: str) -> Optional[Dict[str, Any]]:
    for d in _all_docs(SAFE_ZONES):
        if d.get("id") == zone_id:
            return d
    return None


def get_patient_safe_zones(patient_id: str) -> List[Dict[str, Any]]:
    return [d for d in _all_docs(SAFE_ZONES) if d.get("patient_id") == patient_id]


# ---------------------------------------------------------------------------
# Alert helpers
# ---------------------------------------------------------------------------
def find_alert(alert_id: str) -> Optional[Dict[str, Any]]:
    for d in _all_docs(ALERTS):
        if d.get("id") == alert_id:
            return d
    return None


def find_open_alerts(patient_id: str, alert_type: Optional[str] = None) -> List[Dict[str, Any]]:
    results = []
    for d in _all_docs(ALERTS):
        if d.get("patient_id") != patient_id or d.get("resolved"):
            continue
        if alert_type and d.get("type") != alert_type:
            continue
        results.append(d)
    return results


async def create_alert(
    patient_id: str,
    alert_type: str,
    priority: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if alert_type not in ALERT_TYPES:
        raise ValueError(f"Unknown alert type: {alert_type}")
    if priority not in ALERT_PRIORITIES:
        raise ValueError(f"Unknown alert priority: {priority}")

    doc_data = {
        "patient_id": patient_id,
        "type": alert_type,
        "priority": priority,
        "message": message,
        "resolved": False,
        "resolved_at": None,
        "metadata": metadata or {},
    }
    return await db.create_document(ALERTS, user_id=patient_id, data=doc_data)


async def resolve_open_alerts(
    patient_id: str, alert_type: Optional[str] = None, note: Optional[str] = None
) -> int:
    resolved = 0
    for doc in find_open_alerts(patient_id, alert_type):
        updates: Dict[str, Any] = {"resolved": True, "resolved_at": utc_now_iso()}
        if note:
            updates["resolution_note"] = note
        await db.update_document(
            ALERTS, user_id=patient_id, doc_id=doc["id"], updates=updates
        )
        resolved += 1
    return resolved


# ---------------------------------------------------------------------------
# Guardian settings
# ---------------------------------------------------------------------------
def default_settings() -> Dict[str, Any]:
    return dict(DEFAULT_SETTINGS)


async def get_settings(patient_id: str) -> Dict[str, Any]:
    doc = await db.get_document(
        GUARDIAN_SETTINGS, user_id=patient_id, doc_id=f"gs_{patient_id}"
    )
    merged = default_settings()
    if doc:
        for key, value in doc.items():
            if key not in ("id", "user_id", "created_at", "updated_at"):
                merged[key] = value
    return merged


async def save_settings(patient_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    current = await get_settings(patient_id)
    current.update(updates or {})
    payload = {
        k: v
        for k, v in current.items()
        if k not in ("id", "user_id", "created_at", "updated_at")
    }
    await db.create_document(
        GUARDIAN_SETTINGS, user_id=patient_id, data=payload, doc_id=f"gs_{patient_id}"
    )
    return payload


# ---------------------------------------------------------------------------
# Geofence orchestration (uses pure functions from steady_ai.geofence)
# ---------------------------------------------------------------------------
async def process_location_and_geofence(
    patient_id: str, latitude: float, longitude: float
) -> Dict[str, Any]:
    """
    Evaluate a new location against the patient's enabled safe zones and emit
    exactly one aggregate transition alert per state change.
    """
    from steady_ai.geofence import evaluate_safe_zones, determine_transition

    zones = get_patient_safe_zones(patient_id)
    evaluation = evaluate_safe_zones(latitude, longitude, zones)

    settings = await get_settings(patient_id)
    previous_inside = settings.get("geofence_inside")
    current_inside = bool(evaluation["inside"])

    transition = determine_transition(previous_inside, current_inside)
    alerts_created: List[str] = []

    location_meta = {
        "latitude": latitude,
        "longitude": longitude,
        "matched_zone_ids": evaluation["matched_zone_ids"],
        "nearest_distance_m": evaluation["nearest_distance_m"],
    }

    if transition == "EXIT":
        alert = await create_alert(
            patient_id,
            "SAFE_ZONE_BREACH",
            "IMPORTANT",
            "Safe-zone boundary crossed.",
            location_meta,
        )
        alerts_created.append(alert["id"])
    elif transition == "ENTER":
        await create_alert(
            patient_id,
            "SAFE_ZONE_RETURN",
            "INFO",
            "Patient returned to a safe zone.",
            location_meta,
        )
        # A confirmed return resolves the corresponding open breach.
        await resolve_open_alerts(patient_id, "SAFE_ZONE_BREACH", "Returned to safe zone")

    await save_settings(
        patient_id,
        {
            "geofence_inside": current_inside,
            "geofence_last_evaluated_at": utc_now_iso(),
        },
    )

    return {
        "inside": current_inside,
        "transition": transition,
        "matched_zone_ids": evaluation["matched_zone_ids"],
        "nearest_distance_m": evaluation["nearest_distance_m"],
        "alerts_created": alerts_created,
    }


# ---------------------------------------------------------------------------
# Activity, inactivity & night awareness
# ---------------------------------------------------------------------------
async def maybe_create_night_alert(
    patient_id: str, settings: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Emit at most one AWARENESS night-activity alert per night window."""
    settings = settings or await get_settings(patient_id)
    if not settings.get("night_enabled"):
        return None

    now = datetime.now()
    start_str = settings.get("night_start_time", "22:00")
    end_str = settings.get("night_end_time", "07:00")
    if not is_within_night_window(now, start_str, end_str):
        return None

    window_key = _night_window_key(now, start_str, end_str)
    if settings.get("last_night_alert_key") == window_key:
        return None

    alert = await create_alert(
        patient_id,
        "NIGHT_ACTIVITY",
        "AWARENESS",
        "Night activity detected.",
        {"window": window_key, "night_start": start_str, "night_end": end_str},
    )
    await save_settings(
        patient_id,
        {"last_night_alert_key": window_key, "last_night_alert_date": now.date().isoformat()},
    )
    return alert


async def record_activity(
    patient_id: str, significant: bool = False, source: str = "device"
) -> Dict[str, Any]:
    """
    Record a patient/device activity update.

    Always resets the inactivity condition; when ``significant`` the caller
    opts into night-activity evaluation (used as the available activity signal).
    """
    settings = await get_settings(patient_id)
    update: Dict[str, Any] = {"last_activity_at": utc_now_iso()}

    resolved = 0
    if settings.get("inactivity_alert_active"):
        resolved = await resolve_open_alerts(
            patient_id, "PROLONGED_INACTIVITY", "Activity resumed"
        )
        update["inactivity_alert_active"] = False

    await save_settings(patient_id, update)

    night_alert = None
    if significant:
        night_alert = await maybe_create_night_alert(patient_id, settings)

    return {
        "last_activity_at": update["last_activity_at"],
        "source": source,
        "inactivity_reset": resolved > 0,
        "night_alert_id": night_alert["id"] if night_alert else None,
    }


async def evaluate_inactivity(
    patient_id: str, source: str = "scheduled_check"
) -> Dict[str, Any]:
    """
    Evaluate whether the patient has been inactive beyond the configured
    threshold. Creates at most one HIGH alert while the condition stays active.
    """
    settings = await get_settings(patient_id)
    threshold = int(settings.get("inactivity_threshold_min", 180) or 180)

    last_activity = settings.get("last_activity_at")
    if not last_activity:
        pings = await db.query_documents(LOCATION_PINGS, user_id=patient_id, limit=1)
        if pings:
            last_activity = pings[0].get("captured_at") or pings[0].get("created_at")

    if not last_activity:
        return {
            "inactive": False,
            "minutes_inactive": None,
            "threshold_min": threshold,
            "alert_created": False,
            "reason": "No activity reference recorded yet.",
            "source": source,
        }

    try:
        last_dt = datetime.fromisoformat(str(last_activity).replace("Z", "+00:00"))
    except ValueError:
        return {
            "inactive": False,
            "minutes_inactive": None,
            "threshold_min": threshold,
            "alert_created": False,
            "reason": "Unparseable activity timestamp.",
            "source": source,
        }

    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)

    minutes_inactive = (datetime.now(timezone.utc) - last_dt).total_seconds() / 60.0

    if minutes_inactive < threshold:
        return {
            "inactive": False,
            "minutes_inactive": round(minutes_inactive, 1),
            "threshold_min": threshold,
            "alert_created": False,
            "reason": "Within activity threshold.",
            "source": source,
        }

    if settings.get("inactivity_alert_active"):
        return {
            "inactive": True,
            "minutes_inactive": round(minutes_inactive, 1),
            "threshold_min": threshold,
            "alert_created": False,
            "reason": "Inactivity alert already active.",
            "source": source,
        }

    alert = await create_alert(
        patient_id,
        "PROLONGED_INACTIVITY",
        "HIGH",
        "Prolonged inactivity detected. Please check on patient.",
        {"minutes_inactive": round(minutes_inactive, 1), "threshold_min": threshold},
    )
    await save_settings(patient_id, {"inactivity_alert_active": True})

    return {
        "inactive": True,
        "minutes_inactive": round(minutes_inactive, 1),
        "threshold_min": threshold,
        "alert_created": True,
        "alert_id": alert["id"],
        "source": source,
    }