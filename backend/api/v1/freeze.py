"""
STEADY API v1 - Freeze Episodes Router
Logs freezing-of-gait (FOG) episodes triggered via the 'I\'m frozen' button
or live sensor detection, optionally linked to a danger zone.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

router = APIRouter(prefix="/freeze-episodes", tags=["Freeze Episodes"])


class FreezeEpisodeLogRequest(BaseModel):
    danger_zone_id: Optional[str] = None
    location_label: Optional[str] = "Hallway doorway"
    duration_s: Optional[float] = 15.0
    effective_unfreeze_strategy: Optional[str] = "High-contrast visual metronome pulse"
    trigger_type: str = "manual_button"  # "manual_button" | "sensor_detected"
    resolved_safely: bool = True
    notes: Optional[str] = None


@router.post("")
async def log_freeze_episode(
    body: FreezeEpisodeLogRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Records a freeze episode and updates associated danger zone freeze count if linked.
    """
    doc_data = body.model_dump()
    saved = await db.create_document("freeze_episodes", user_id=user.user_id, data=doc_data)

    # Increment danger zone count if linked
    if body.danger_zone_id:
        zone = await db.get_document("danger_zones", user_id=user.user_id, doc_id=body.danger_zone_id)
        if zone:
            current_count = zone.get("freeze_count", 0)
            await db.update_document(
                "danger_zones",
                user_id=user.user_id,
                doc_id=body.danger_zone_id,
                updates={"freeze_count": current_count + 1}
            )

    return saved


@router.get("")
async def get_freeze_episodes(
    limit: int = 30,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Returns history of logged freeze episodes.
    """
    episodes = await db.query_documents("freeze_episodes", user_id=user.user_id, limit=limit)
    return {
        "count": len(episodes),
        "episodes": episodes
    }
