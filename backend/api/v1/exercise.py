"""
STEADY API v1 - Exercise Sessions Router
Manages Move Coach camera exercise sessions (start, log reps/form, complete).
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

router = APIRouter(prefix="/exercise-sessions", tags=["Exercise Sessions"])


class ExerciseSessionCreateRequest(BaseModel):
    exercise_name: str = "Big Reach & Step"
    target_reps: int = 20
    target_tempo_bpm: int = 88


class ExerciseSessionCompleteRequest(BaseModel):
    session_id: str
    completed_reps: int
    average_sync_pct: float
    total_duration_s: float
    form_notes: Optional[str] = None


@router.post("")
async def start_or_log_exercise_session(
    body: ExerciseSessionCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Starts a new Move Coach exercise session.
    """
    doc_data = {
        "exercise_name": body.exercise_name,
        "target_reps": body.target_reps,
        "target_tempo_bpm": body.target_tempo_bpm,
        "status": "in_progress",
        "completed_reps": 0,
        "average_sync_pct": 0.0
    }
    saved = await db.create_document("exercise_sessions", user_id=user.user_id, data=doc_data)
    return saved


@router.post("/complete")
async def complete_exercise_session(
    body: ExerciseSessionCompleteRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Logs completion of a Move Coach session with final stats.
    """
    doc = await db.get_document("exercise_sessions", user_id=user.user_id, doc_id=body.session_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise session not found.")

    updated = await db.update_document(
        "exercise_sessions",
        user_id=user.user_id,
        doc_id=body.session_id,
        updates={
            "status": "completed",
            "completed_reps": body.completed_reps,
            "average_sync_pct": body.average_sync_pct,
            "total_duration_s": body.total_duration_s,
            "form_notes": body.form_notes
        }
    )
    return updated
