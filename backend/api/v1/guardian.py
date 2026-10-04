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