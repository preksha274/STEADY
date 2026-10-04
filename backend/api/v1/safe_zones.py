"""
STEADY API v1 - Guardian Safe Zones Router
Geographic (GPS) circular safe zones used for the Guardian geofence layer.

NOTE: This is intentionally distinct from the existing room-based
``/danger-zones`` feature (home hazard spots). The two are not merged.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

from .guardian_common import (
    SAFE_ZONES,
    assert_patient_access,
    find_safe_zone,
    get_patient_safe_zones,
    utc_now_iso,
)

router = APIRouter(prefix="/safe-zones", tags=["Safe Zones"])

# Reasonable maximum radius (5 km) to guard against accidental huge zones.
MAX_RADIUS_M = 5000.0


class SafeZoneCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_m: float = Field(150.0, gt=0, le=MAX_RADIUS_M)
    enabled: bool = True
    patient_id: Optional[str] = Field(None, description="Owner patient (defaults to caller)")


class SafeZoneUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_m: Optional[float] = Field(None, gt=0, le=MAX_RADIUS_M)
    enabled: Optional[bool] = None


def _resolve_owner(user: AuthenticatedUser, patient_id: Optional[str]) -> str:
    owner = patient_id or user.user_id
    assert_patient_access(user, owner)
    return owner


@router.get("")
async def list_safe_zones(
    patient_id: Optional[str] = Query(None, description="Patient whose zones to list"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Lists safe zones for a patient (defaults to the caller). A guardian may
    list zones only for patients they are linked to.
    """
    owner = _resolve_owner(user, patient_id)
    zones = get_patient_safe_zones(owner)
    zones.sort(key=lambda z: str(z.get("created_at", "")), reverse=True)
    return {"count": len(zones), "patient_id": owner, "safe_zones": zones}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_safe_zone(
    body: SafeZoneCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Creates a geographic safe zone. The patient (or a linked guardian) may
    create zones for the patient.
    """
    owner = _resolve_owner(user, body.patient_id)
    doc_data = {
        "patient_id": owner,
        "name": body.name.strip(),
        "latitude": float(body.latitude),
        "longitude": float(body.longitude),
        "radius_m": float(body.radius_m),
        "enabled": bool(body.enabled),
        "created_by": user.user_id,
    }
    return await db.create_document(SAFE_ZONES, user_id=owner, data=doc_data)


@router.get("/{safe_zone_id}")
async def get_safe_zone(
    safe_zone_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    zone = find_safe_zone(safe_zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Safe zone not found."
        )
    assert_patient_access(user, zone.get("patient_id"))
    return zone


@router.patch("/{safe_zone_id}")
async def update_safe_zone(
    safe_zone_id: str,
    body: SafeZoneUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    zone = find_safe_zone(safe_zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Safe zone not found."
        )
    assert_patient_access(user, zone.get("patient_id"))

    updates: Dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if "name" in updates:
        updates["name"] = str(updates["name"]).strip()
    if not updates:
        return zone

    updated = await db.update_document(
        SAFE_ZONES, user_id=zone.get("patient_id"), doc_id=safe_zone_id, updates=updates
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Safe zone not found."
        )
    return updated


@router.delete("/{safe_zone_id}")
async def delete_safe_zone(
    safe_zone_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    zone = find_safe_zone(safe_zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Safe zone not found."
        )
    assert_patient_access(user, zone.get("patient_id"))

    deleted = await db.delete_document(
        SAFE_ZONES, user_id=zone.get("patient_id"), doc_id=safe_zone_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Safe zone not found."
        )
    return {"status": "deleted", "id": safe_zone_id, "deleted_at": utc_now_iso()}