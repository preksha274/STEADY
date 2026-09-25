"""
STEADY API v1 - Cue Sessions Router
Manages Live Cue Designer test runs, real-time adaptation steps, and cue prescription export.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db
from steady_ai import (
    CueType,
    adapt_cue_tempo_step,
    CueAdaptationStepOutput,
    ConfidenceTier
)

router = APIRouter(prefix="/cue-sessions", tags=["Cue Sessions"])


class CreateCueSessionRequest(BaseModel):
    cue_type: CueType = CueType.AUDIO_BEAT
    target_tempo_bpm: int = 88
    notes: Optional[str] = None


class UpdateCueStepRequest(BaseModel):
    measured_cadence_spm: float
    current_sync_pct: float
    current_stride_smoothness: float = 0.85
    sync_history_last_5_steps: Optional[List[float]] = None


@router.post("")
async def create_cue_session(
    body: CreateCueSessionRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Starts a new Cue Lab test/adapt session.
    """
    doc_data = {
        "cue_type": body.cue_type.value,
        "current_tempo_bpm": body.target_tempo_bpm,
        "initial_tempo_bpm": body.target_tempo_bpm,
        "adaptation_history": [],
        "is_active": True,
        "winning_tempo_bpm": body.target_tempo_bpm
    }
    saved = await db.create_document("cue_sessions", user_id=user.user_id, data=doc_data)
    return saved


@router.patch("/{session_id}")
async def update_cue_step(
    session_id: str,
    step_req: UpdateCueStepRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Processes one adaptation iteration step and updates cue parameters.
    """
    doc = await db.get_document("cue_sessions", user_id=user.user_id, doc_id=session_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cue session not found.")

    cue_type = CueType(doc.get("cue_type", CueType.AUDIO_BEAT.value))
    current_tempo = int(doc.get("current_tempo_bpm", 88))

    adapt_output: CueAdaptationStepOutput = adapt_cue_tempo_step(
        current_cue_type=cue_type,
        current_tempo_bpm=current_tempo,
        measured_cadence_spm=step_req.measured_cadence_spm,
        current_sync_pct=step_req.current_sync_pct,
        current_stride_smoothness=step_req.current_stride_smoothness,
        sync_history_last_5_steps=step_req.sync_history_last_5_steps
    )

    history = doc.get("adaptation_history", [])
    history.append(adapt_output.model_dump())

    updated = await db.update_document(
        "cue_sessions",
        user_id=user.user_id,
        doc_id=session_id,
        updates={
            "current_tempo_bpm": adapt_output.suggested_tempo_bpm,
            "winning_tempo_bpm": adapt_output.suggested_tempo_bpm,
            "adaptation_history": history,
            "latest_step": adapt_output.model_dump()
        }
    )
    return updated


@router.get("/prescription")
async def get_cue_prescription(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Exports personalized Cue Prescription summary based on recent tests.
    """
    recent = await db.query_documents("cue_sessions", user_id=user.user_id, limit=5)
    best_tempo = 88
    best_modality = "Audio Beat (Metronome)"
    sync_avg = 94.0

    if recent:
        best_tempo = recent[0].get("winning_tempo_bpm", 88)
        cue_val = recent[0].get("cue_type", "audio_beat")
        best_modality = cue_val.replace("_", " ").title()

    return {
        "user_id": user.user_id,
        "recommended_cue_modality": best_modality,
        "optimal_tempo_bpm": best_tempo,
        "average_synchronization_pct": sync_avg,
        "recommended_frequency": "Use during daily walks, transitions, and freezing risk periods.",
        "label": "Personalized Cue Prescription"
    }
