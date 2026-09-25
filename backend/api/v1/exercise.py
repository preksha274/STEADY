"""
STEADY API v1 - Exercise Sessions Router
Manages Move Coach camera exercise sessions (start, log reps/form, complete).
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

from steady_ai import (
    generate_today_session_plan,
    TodaySessionPlan,
    CueType,
    SymptomSeverityTier
)

router = APIRouter(prefix="/exercise-sessions", tags=["Exercise Sessions"])


class GeneratePlanRequest(BaseModel):
    winning_cue_type: str = "audio_beat"
    winning_tempo_bpm: int = 88
    energy_level: Optional[str] = None
    fatigue_level: Optional[str] = None
    mood: Optional[str] = None
    sleep_quality: Optional[str] = None
    response_curve_window: str = "STEADY"
    severity_tier: str = "mild"


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


@router.get("/today-plan", response_model=TodaySessionPlan)
async def get_today_session_plan(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Computes today's customized rule-based session plan based on latest diary & forecast.
    """
    # 1. Fetch latest diary entry
    diary_entries = await db.query_documents("diary_entries", user_id=user.user_id, limit=1)
    diary = diary_entries[0] if diary_entries else None

    # 2. Fetch winning cue
    cue_history = await db.query_documents("cue_sessions", user_id=user.user_id, limit=1)
    winning_type = CueType.AUDIO_BEAT
    winning_bpm = 88
    if cue_history:
        winning_type = CueType(cue_history[0].get("selected_type", "audio_beat"))
        winning_bpm = cue_history[0].get("winning_tempo_bpm", 88)

    energy = diary.get("energy_level") if diary else None
    fatigue = diary.get("fatigue") if diary else None
    mood = diary.get("mood") if diary else None
    sleep = diary.get("sleep_quality") if diary else None

    plan = generate_today_session_plan(
        winning_cue_type=winning_type,
        winning_tempo_bpm=winning_bpm,
        energy_level=energy,
        fatigue_level=fatigue,
        mood=mood,
        sleep_quality=sleep,
        response_curve_window="ON_OPTIMAL" if energy == "high" else "STEADY",
        severity_tier=SymptomSeverityTier.MILD
    )
    return plan


@router.post("/generate-plan", response_model=TodaySessionPlan)
async def custom_generate_plan(body: GeneratePlanRequest):
    """
    Direct endpoint for testing/generating customized routine with explicit inputs.
    """
    cue_type = CueType.AUDIO_BEAT
    try:
        cue_type = CueType(body.winning_cue_type.lower())
    except Exception:
        pass

    sev_tier = SymptomSeverityTier.MILD
    try:
        sev_tier = SymptomSeverityTier(body.severity_tier.lower())
    except Exception:
        pass

    return generate_today_session_plan(
        winning_cue_type=cue_type,
        winning_tempo_bpm=body.winning_tempo_bpm,
        energy_level=body.energy_level,
        fatigue_level=body.fatigue_level,
        mood=body.mood,
        sleep_quality=body.sleep_quality,
        response_curve_window=body.response_curve_window,
        severity_tier=sev_tier
    )


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
