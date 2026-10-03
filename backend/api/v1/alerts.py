"""
STEADY API v1 - Guardian Alerts Router
In-app caregiver alerts: safe-zone transitions, SOS, prolonged inactivity,
night activity and freeze assistance.

This is an awareness layer only. It does not contact emergency services and
makes no medical claims (no fall / sleep / emergency detection).

Notification mechanism for this phase: the Guardian dashboard alert list.
No SMS / email / push providers are used.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

from .guardian_common import (
    ALERTS,
    ALERT_PRIORITIES,
    ALERT_TYPES,
    LOCATION_PINGS,
    accessible_patient_ids,
    assert_patient_access,
    create_alert,
    evaluate_inactivity,
    find_alert,
    find_open_alerts,
    record_activity,
    utc_now_iso,
)

router = APIRouter(prefix="/alerts", tags=["Guardian Alerts"])


class AlertCreateRequest(BaseModel):
    patient_id: Optional[str] = Field(None, description="Owner patient (defaults to caller)")
    type: str = Field(..., description=f"One of {', '.join(ALERT_TYPES)}")
    priority: str = Field("AWARENESS", description=f"One of {', '.join(ALERT_PRIORITIES)}")
    message: str = Field(..., min_length=1, max_length=280)
    metadata: Optional[Dict[str, Any]] = None


class ResolveAlertRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=280)


class FreezeAssistRequest(BaseModel):
    patient_id: Optional[str] = Field(None, description="Owner patient (defaults to caller)")
    duration_s: Optional[float] = Field(None, ge=0, description="Optional logged freeze duration")
    location_label: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=280)


class ActivityRequest(BaseModel):
    significant: bool = Field(
        False, description="Mark as significant activity (enables night-awareness evaluation)"
    )
    source: str = Field("device", max_length=60)


@router.get("")
async def list_alerts(
    patient_id: Optional[str] = Query(None, description="Restrict to a single patient"),
    resolved: Optional[bool] = Query(None, description="Filter by resolved state"),
    limit: int = Query(50, ge=1, le=200),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Lists alerts. A patient sees their own alerts; a guardian sees alerts only
    for their linked patients (aggregated when no patient_id is given).
    """
    if patient_id:
        assert_patient_access(user, patient_id)
        patient_ids = [patient_id]
    else:
        patient_ids = accessible_patient_ids(user)

    collected: List[Dict[str, Any]] = []
    for pid in patient_ids:
        collected.extend(await db.query_documents(ALERTS, user_id=pid, limit=limit))

    if resolved is not None:
        collected = [a for a in collected if bool(a.get("resolved")) == resolved]

    collected.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    unresolved_count = sum(1 for a in collected if not a.get("resolved"))

    return {
        "count": len(collected[:limit]),
        "unresolved_count": unresolved_count,
        "patient_ids": patient_ids,
        "alerts": collected[:limit],
    }


@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    alert = find_alert(alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found."
        )
    assert_patient_access(user, alert.get("patient_id"))
    return alert


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_manual_alert(
    body: AlertCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Creates an alert for an accessible patient (the patient themselves or a
    linked guardian acting on their behalf).
    """
    if body.type not in ALERT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown alert type. Allowed: {list(ALERT_TYPES)}",
        )
    if body.priority not in ALERT_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown alert priority. Allowed: {list(ALERT_PRIORITIES)}",
        )

    owner = body.patient_id or user.user_id
    assert_patient_access(user, owner)

    return await create_alert(
        owner, body.type, body.priority, body.message, body.metadata
    )


@router.patch("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    body: Optional[ResolveAlertRequest] = None,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Resolves an alert. Only the patient or a linked guardian may resolve it.
    """
    alert = find_alert(alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found."
        )
    assert_patient_access(user, alert.get("patient_id"))

    if alert.get("resolved"):
        return alert

    updates: Dict[str, Any] = {"resolved": True, "resolved_at": utc_now_iso()}
    if body and body.note:
        updates["resolution_note"] = body.note

    updated = await db.update_document(
        ALERTS, user_id=alert.get("patient_id"), doc_id=alert_id, updates=updates
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found."
        )
    return updated


@router.post("/sos", status_code=status.HTTP_201_CREATED)
async def trigger_sos(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Patient-triggered SOS. Creates a CRITICAL alert, attaches the latest known
    location if available, and makes it visible to linked guardians.

    Emergency services are NOT contacted automatically.
    """
    patient_id = user.user_id

    pings = await db.query_documents(LOCATION_PINGS, user_id=patient_id, limit=1)
    latest = pings[0] if pings else None
    location = (
        {
            "latitude": latest.get("latitude"),
            "longitude": latest.get("longitude"),
            "accuracy_m": latest.get("accuracy_m"),
            "captured_at": latest.get("captured_at"),
        }
        if latest
        else None
    )

    alert = await create_alert(
        patient_id,
        "SOS",
        "CRITICAL",
        "SOS requested by patient.",
        {"location": location, "triggered_at": utc_now_iso()},
    )

    # An SOS is an explicit activity signal.
    await record_activity(patient_id, significant=False, source="sos_button")

    return {
        "alert": alert,
        "location_attached": location is not None,
        "guardian_notification_mode": "in_app_dashboard",
    }


@router.post("/freeze-assist", status_code=status.HTTP_201_CREATED)
async def report_freeze_assist(
    body: FreezeAssistRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Safe integration point for the existing Freeze Assist feature.

    An *explicitly reported* significant freeze episode can optionally create a
    HIGH ``FREEZE_ASSIST`` guardian alert. Merely opening the Freeze Assist UI
    must NOT call this endpoint. Duplicate alerts are suppressed within a
    cooldown window while an unresolved freeze alert already exists.
    """
    owner = body.patient_id or user.user_id
    assert_patient_access(user, owner)

    if find_open_alerts(owner, "FREEZE_ASSIST"):
        return {
            "created": False,
            "reason": "An unresolved freeze-assist alert already exists.",
            "existing_open_count": len(find_open_alerts(owner, "FREEZE_ASSIST")),
        }

    pings = await db.query_documents(LOCATION_PINGS, user_id=owner, limit=1)
    latest = pings[0] if pings else None

    metadata: Dict[str, Any] = {
        "duration_s": body.duration_s,
        "location_label": body.location_label,
        "notes": body.notes,
        "reported_by": user.user_id,
    }
    if latest:
        metadata["latitude"] = latest.get("latitude")
        metadata["longitude"] = latest.get("longitude")

    alert = await create_alert(
        owner,
        "FREEZE_ASSIST",
        "HIGH",
        "Freeze assistance may be required.",
        metadata,
    )
    return {"created": True, "alert": alert}


@router.post("/activity")
async def register_activity(
    body: ActivityRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Patient/device activity update. Resets the prolonged-inactivity condition
    and, when ``significant`` and night-awareness is enabled within the
    configured window, may raise a single night-activity alert.
    """
    result = await record_activity(
        user.user_id, significant=body.significant, source=body.source
    )
    return result


@router.post("/inactivity-check", status_code=status.HTTP_200_OK)
async def check_inactivity(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Evaluates prolonged-inactivity awareness for the caller using the
    configurable threshold. Modular by design so it can later consume real
    phone-sensor activity. Creates at most one HIGH alert while the condition
    remains active, and resets once activity resumes (via /alerts/activity).
    """
    return await evaluate_inactivity(user.user_id, source="scheduled_check")