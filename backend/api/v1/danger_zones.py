"""
STEADY API v1 - Danger Zones Router
CRUD management for home rooms and tagged freezing hazard spots.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

router = APIRouter(prefix="/danger-zones", tags=["Danger Zones"])


class DangerZoneCreateRequest(BaseModel):
    room_name: str
    spot_name: str
    risk_level: str = "medium"  # "low", "medium", "high"
    hazard_trigger: Optional[str] = "Narrow doorway / turn"
    freeze_count: int = 0
    recommended_cue: Optional[str] = "Audio Beat (88 BPM)"


class DangerZoneUpdateRequest(BaseModel):
    room_name: Optional[str] = None
    spot_name: Optional[str] = None
    risk_level: Optional[str] = None
    hazard_trigger: Optional[str] = None
    freeze_count: Optional[int] = None
    recommended_cue: Optional[str] = None


@router.get("")
async def list_danger_zones(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns all registered danger zones & hazard spots for the user.
    """
    zones = await db.query_documents("danger_zones", user_id=user.user_id, limit=50)
    if not zones:
        # Prepopulate standard default home spots for demonstration
        default_spots = [
            {"room_name": "Hallway", "spot_name": "Narrow Turn to Bedroom", "risk_level": "high", "freeze_count": 5, "hazard_trigger": "90° doorway turn", "recommended_cue": "Visual Floor Grid / 88 BPM Audio"},
            {"room_name": "Bathroom", "spot_name": "Tile Threshold Transition", "risk_level": "medium", "freeze_count": 3, "hazard_trigger": "Surface texture change", "recommended_cue": "Vibration Pulse"},
            {"room_name": "Kitchen", "spot_name": "Refrigerator Pivot Area", "risk_level": "low", "freeze_count": 1, "hazard_trigger": "Dual-tasking while reaching", "recommended_cue": "Audio Beat"}
        ]
        created = []
        for s in default_spots:
            c = await db.create_document("danger_zones", user_id=user.user_id, data=s)
            created.append(c)
        return {"count": len(created), "danger_zones": created}

    return {"count": len(zones), "danger_zones": zones}


@router.post("")
async def create_danger_zone(
    body: DangerZoneCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Creates a new danger zone hazard spot.
    """
    saved = await db.create_document("danger_zones", user_id=user.user_id, data=body.model_dump())
    return saved


@router.patch("/{zone_id}")
async def update_danger_zone(
    zone_id: str,
    body: DangerZoneUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Updates a danger zone spot details or increments freeze count.
    """
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await db.update_document("danger_zones", user_id=user.user_id, doc_id=zone_id, updates=updates)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Danger zone not found.")
    return updated


@router.delete("/{zone_id}")
async def delete_danger_zone(
    zone_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Removes a danger zone spot.
    """
    success = await db.delete_document("danger_zones", user_id=user.user_id, doc_id=zone_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Danger zone not found.")
    return {"status": "deleted", "id": zone_id}
