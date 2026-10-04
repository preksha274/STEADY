"""
STEADY API v1 - Guardian Location Pings Router
Receives patient GPS pings, evaluates them against safe zones, and exposes
latest / recent history to the patient and their linked guardians.

Data is stored in the ``location_pings`` collection (bounded on query via the
DataStore ``limit``), never accumulated in process memory.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

from .guardian_common import (
    LOCATION_PINGS,
    assert_patient_access,
    process_location_and_geofence,
    save_settings,
    utc_now_iso,
)

router = APIRouter(prefix="/location-pings", tags=["Location Pings"])


class LocationPingRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = Field(None, ge=0)
    captured_at: Optional[str] = Field(
        None, description="Device capture time (ISO). Server time is used for received_at."
    )
    source: str = Field("browser_geolocation", description="Signal source label")


def _resolve_access(user: AuthenticatedUser, patient_id: Optional[str]) -> str:
    target = patient_id or user.user_id
    assert_patient_access(user, target)
    return target


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_location_ping(
    body: LocationPingRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Patient submits a location ping. The server evaluates safe-zone state and
    may emit a single aggregate transition alert.
    """
    patient_id = user.user_id
    captured_at = body.captured_at or utc_now_iso()

    doc_data: Dict[str, Any] = {
        "patient_id": patient_id,
        "latitude": float(body.latitude),
        "longitude": float(body.longitude),
        "accuracy_m": body.accuracy_m,
        "captured_at": captured_at,
        "received_at": utc_now_iso(),
        "source": body.source,
    }
    saved = await db.create_document(LOCATION_PINGS, user_id=patient_id, data=doc_data)

    # A location ping is treated as an activity signal (resets inactivity).
    await save_settings(patient_id, {"last_activity_at": saved["received_at"]})

    geofence = await process_location_and_geofence(
        patient_id, float(body.latitude), float(body.longitude)
    )

    return {"ping": saved, "geofence": geofence}


@router.get("/latest")
async def get_latest_location(
    patient_id: Optional[str] = Query(None, description="Patient (defaults to caller)"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Latest known location for a patient. Guardians may only read linked patients.
    """
    target = _resolve_access(user, patient_id)
    pings = await db.query_documents(LOCATION_PINGS, user_id=target, limit=1)
    latest = pings[0] if pings else None
    return {"patient_id": target, "latest": latest}


@router.get("/history")
async def get_location_history(
    patient_id: Optional[str] = Query(None, description="Patient (defaults to caller)"),
    limit: int = Query(50, ge=1, le=500),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Recent location history for a patient (most recent first).
    """
    target = _resolve_access(user, patient_id)
    pings = await db.query_documents(LOCATION_PINGS, user_id=target, limit=limit)
    return {"patient_id": target, "count": len(pings), "pings": pings}