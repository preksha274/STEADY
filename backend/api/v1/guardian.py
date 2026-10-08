"""
STEADY API v1 - Guardian Dashboard & Settings Router
Aggregated, non-diagnostic caregiver overview plus configurable awareness
thresholds (prolonged inactivity + night-awareness window).

The dashboard exposes only caregiver-relevant safety signals for linked
patients: latest location, safe-zone status, recent alerts, unresolved count,
recent activity status and night-awareness status. No unrelated medical data
is returned.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

from .guardian_common import (
    ALERTS,
    LOCATION_PINGS,
    _parse_hhmm,
    assert_patient_access,
    get_links_for_guardian,
    get_patient_safe_zones,
    get_settings,
    is_within_night_window,
    save_settings,
    utc_now_iso,
)

router = APIRouter(prefix="/guardian", tags=["Guardian Dashboard"])


class NightAwareness(BaseModel):
    enabled: bool = False
    start_time: str = Field("22:00", description="HH:MM local time")
    end_time: str = Field("07:00", description="HH:MM local time")


class GuardianSettingsUpdateRequest(BaseModel):
    patient_id: Optional[str] = Field(None, description="Owner patient (defaults to caller)")
    inactivity_threshold_min: Optional[int] = Field(None, ge=15, le=2880)
    night_awareness: Optional[NightAwareness] = None


def _settings_view(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Normalised, client-friendly view of a patient's Guardian settings."""
    return {
        "inactivity_threshold_min": settings.get("inactivity_threshold_min", 180),
        "night_awareness": {
            "enabled": bool(settings.get("night_enabled", False)),
            "start_time": settings.get("night_start_time", "22:00"),
            "end_time": settings.get("night_end_time", "07:00"),
        },
        "last_activity_at": settings.get("last_activity_at"),
    }


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _activity_status(
    settings: Dict[str, Any], latest_ping: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """Recent activity status derived from activity/location updates only."""
    reference = settings.get("last_activity_at") or (
        (latest_ping or {}).get("captured_at") or (latest_ping or {}).get("created_at")
    )
    last_dt = _parse_dt(reference)
    if not last_dt:
        return {
            "last_activity_at": None,
            "minutes_since": None,
            "status": "unknown",
        }

    minutes = round((datetime.now(timezone.utc) - last_dt).total_seconds() / 60.0, 1)
    threshold = int(settings.get("inactivity_threshold_min", 180) or 180)
    if minutes < 60:
        label = "active"
    elif minutes < threshold:
        label = "quiet"
    else:
        label = "inactive"
    return {"last_activity_at": reference, "minutes_since": minutes, "status": label}


@router.get("/dashboard")
async def get_guardian_dashboard(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Guardian overview across all linked patients. A pure patient account with no
    links simply receives an empty list.
    """
    links = get_links_for_guardian(user.user_id)
    now = datetime.now()
    patients: List[Dict[str, Any]] = []

    for link in links:
        pid = link.get("patient_id")
        if not pid:
            continue

        settings = await get_settings(pid)
        zones = get_patient_safe_zones(pid)

        pings = await db.query_documents(LOCATION_PINGS, user_id=pid, limit=1)
        latest_ping = pings[0] if pings else None

        alerts = await db.query_documents(ALERTS, user_id=pid, limit=200)
        unresolved = [a for a in alerts if not a.get("resolved")]
        recent_alerts = sorted(
            alerts, key=lambda x: str(x.get("created_at", "")), reverse=True
        )[:5]

        night = _settings_view(settings)["night_awareness"]
        night_aware_status = {
            **night,
            "within_window": is_within_night_window(
                now, night["start_time"], night["end_time"]
            ),
            "last_night_alert_date": settings.get("last_night_alert_date"),
        }

        patients.append(
            {
                "link_id": link.get("id"),
                "patient_id": pid,
                "patient_label": link.get("patient_label") or pid,
                "linked_at": link.get("created_at"),
                "latest_location": latest_ping,
                "safe_zone_status": {
                    "inside": settings.get("geofence_inside"),
                    "evaluated_at": settings.get("geofence_last_evaluated_at"),
                    "zone_count": len(zones),
                },
                "recent_alerts": recent_alerts,
                "unresolved_alert_count": len(unresolved),
                "recent_activity": _activity_status(settings, latest_ping),
                "night_awareness_status": night_aware_status,
            }
        )

    total_unresolved = sum(p["unresolved_alert_count"] for p in patients)
    return {
        "guardian_id": user.user_id,
        "generated_at": utc_now_iso(),
        "count": len(patients),
        "total_unresolved_alerts": total_unresolved,
        "patients": patients,
    }


@router.get("/settings")
async def get_guardian_settings(
    patient_id: Optional[str] = Query(None, description="Patient (defaults to caller)"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Returns awareness settings for a patient (defaults to the caller). A
    guardian may read settings only for linked patients.
    """
    target = patient_id or user.user_id
    assert_patient_access(user, target)
    settings = await get_settings(target)
    return {"patient_id": target, **_settings_view(settings)}


@router.patch("/settings")
async def update_guardian_settings(
    body: GuardianSettingsUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Updates configurable awareness thresholds for a patient.
    """
    target = body.patient_id or user.user_id
    assert_patient_access(user, target)

    updates: Dict[str, Any] = {}

    if body.inactivity_threshold_min is not None:
        updates["inactivity_threshold_min"] = int(body.inactivity_threshold_min)

    if body.night_awareness is not None:
        start = body.night_awareness.start_time
        end = body.night_awareness.end_time
        if _parse_hhmm(start) is None or _parse_hhmm(end) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="night_awareness start_time/end_time must be HH:MM (24h).",
            )
        updates["night_enabled"] = bool(body.night_awareness.enabled)
        updates["night_start_time"] = start
        updates["night_end_time"] = end

    settings = await save_settings(target, updates)
    return {"patient_id": target, **_settings_view(settings)}


class SafeZoneRequest(BaseModel):
    patient_id: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_m: float = Field(150.0, ge=10, le=5000)
    label: str = Field("Home Safe Zone")
    location_sharing_enabled: Optional[bool] = None


class GuardianLocationRequest(BaseModel):
    patient_id: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location_sharing_enabled: Optional[bool] = None
    is_simulated: Optional[bool] = False


@router.post("/safe-zone")
async def set_guardian_safe_zone(
    body: SafeZoneRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Set patient safe zone (home base + radius) and optional location sharing toggle."""
    target = body.patient_id or user.user_id
    assert_patient_access(user, target)

    from steady_ai.geofence import haversine_m
    from .guardian_common import SAFE_ZONES, get_patient_safe_zones

    # Update or create safe zone
    zone_data = {
        "patient_id": target,
        "name": body.label,
        "latitude": float(body.latitude),
        "longitude": float(body.longitude),
        "radius_m": float(body.radius_m),
        "enabled": True,
        "created_at": utc_now_iso(),
    }
    
    # Store in SAFE_ZONES collection
    existing_zones = get_patient_safe_zones(target)
    if existing_zones:
        doc_id = existing_zones[0]["id"]
        saved_zone = await db.update_document(SAFE_ZONES, user_id=target, doc_id=doc_id, updates=zone_data)
    else:
        saved_zone = await db.create_document(SAFE_ZONES, user_id=target, data=zone_data)

    settings_update: Dict[str, Any] = {
        "safe_zone_lat": float(body.latitude),
        "safe_zone_lng": float(body.longitude),
        "safe_zone_radius_m": float(body.radius_m),
        "safe_zone_label": body.label,
    }
    if body.location_sharing_enabled is not None:
        settings_update["location_sharing_enabled"] = bool(body.location_sharing_enabled)

    await save_settings(target, settings_update)
    return {"status": "ok", "safe_zone": saved_zone}


@router.post("/location")
async def post_guardian_location(
    body: GuardianLocationRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Post patient location ping and evaluate safe zone transitions."""
    target = body.patient_id or user.user_id
    assert_patient_access(user, target)

    from steady_ai.geofence import haversine_m

    settings = await get_settings(target)
    
    if body.location_sharing_enabled is not None:
        await save_settings(target, {"location_sharing_enabled": bool(body.location_sharing_enabled)})
        settings["location_sharing_enabled"] = bool(body.location_sharing_enabled)

    lat = float(body.latitude)
    lng = float(body.longitude)

    # Fetch safe zone center
    zones = get_patient_safe_zones(target)
    safe_lat = zones[0]["latitude"] if zones else settings.get("safe_zone_lat", lat)
    safe_lng = zones[0]["longitude"] if zones else settings.get("safe_zone_lng", lng)
    radius_m = zones[0]["radius_m"] if zones else settings.get("safe_zone_radius_m", 150.0)

    distance_m = round(haversine_m(lat, lng, safe_lat, safe_lng), 1)
    is_inside = distance_m <= radius_m

    # Store location ping
    doc_data = {
        "patient_id": target,
        "latitude": lat,
        "longitude": lng,
        "distance_m": distance_m,
        "is_inside": is_inside,
        "is_simulated": bool(body.is_simulated),
        "captured_at": utc_now_iso(),
        "received_at": utc_now_iso(),
        "source": "guardian_gps",
    }
    await db.create_document(LOCATION_PINGS, user_id=target, data=doc_data)

    # Evaluate transition vs previous geofence_inside state
    prev_inside = settings.get("geofence_inside")
    alert_triggered = False

    if prev_inside is not None and prev_inside is True and not is_inside:
        # Transition OUTSIDE safe zone -> Create Breach Alert
        await create_alert(
            target,
            "SAFE_ZONE_BREACH",
            "IMPORTANT",
            f"Patient left safe zone ({distance_m}m from home base).",
            {
                "latitude": lat,
                "longitude": lng,
                "distance_m": distance_m,
                "radius_m": radius_m,
                "is_simulated": bool(body.is_simulated),
            },
        )
        alert_triggered = True
    elif prev_inside is not None and prev_inside is False and is_inside:
        # Transition INSIDE safe zone -> Create Return Alert & resolve breach
        await create_alert(
            target,
            "SAFE_ZONE_RETURN",
            "INFO",
            "Patient returned to safe zone.",
            {
                "latitude": lat,
                "longitude": lng,
                "distance_m": distance_m,
                "radius_m": radius_m,
            },
        )
        await resolve_open_alerts(target, "SAFE_ZONE_BREACH", "Returned to safe zone")
        alert_triggered = True

    await save_settings(
        target,
        {
            "geofence_inside": is_inside,
            "geofence_last_distance_m": distance_m,
            "geofence_last_evaluated_at": utc_now_iso(),
            "last_activity_at": utc_now_iso(),
        },
    )

    return {
        "status": "ok",
        "inside": is_inside,
        "distance_m": distance_m,
        "sharing_enabled": bool(settings.get("location_sharing_enabled", False)),
        "alert_triggered": alert_triggered,
        "captured_at": doc_data["captured_at"],
    }


@router.get("/status")
async def get_guardian_status(
    patient_id: Optional[str] = Query(None, description="Target patient ID"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Get live Guardian status for caregiver / patient view.
    Respects consent: Returns latest_location = None if location_sharing_enabled is False.
    """
    target = patient_id or user.user_id
    assert_patient_access(user, target)

    settings = await get_settings(target)
    zones = get_patient_safe_zones(target)

    sharing_enabled = bool(settings.get("location_sharing_enabled", False))

    # Safe zone representation
    if zones:
        safe_zone = {
            "latitude": zones[0]["latitude"],
            "longitude": zones[0]["longitude"],
            "radius_m": zones[0]["radius_m"],
            "label": zones[0].get("name", "Home Safe Zone"),
        }
    else:
        safe_zone = {
            "latitude": settings.get("safe_zone_lat", 37.7749),
            "longitude": settings.get("safe_zone_lng", -122.4194),
            "radius_m": settings.get("safe_zone_radius_m", 150.0),
            "label": settings.get("safe_zone_label", "Home Safe Zone"),
        }

    # Latest location ping
    pings = await db.query_documents(LOCATION_PINGS, user_id=target, limit=1)
    latest_ping = pings[0] if pings else None

    # Compute current inside state & distance
    inside = settings.get("geofence_inside", True)
    distance_m = settings.get("geofence_last_distance_m", 0.0)

    # Alerts history
    alerts = await db.query_documents(ALERTS, user_id=target, limit=100)
    sorted_alerts = sorted(alerts, key=lambda x: str(x.get("created_at", "")), reverse=True)[:15]

    return {
        "patient_id": target,
        "sharing_enabled": sharing_enabled,
        "latest_location": latest_ping if sharing_enabled else None,
        "safe_zone": safe_zone,
        "inside": inside if sharing_enabled else True,
        "distance_m": distance_m if sharing_enabled else 0.0,
        "alerts": sorted_alerts,
        "evaluated_at": settings.get("geofence_last_evaluated_at") or utc_now_iso(),
    }