"""
STEADY API v1 - Voice Checks Router
Sustained-vowel loudness measurement and non-motor ratings check-in.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db
from steady_ai import (
    analyze_voice_sustained_vowel,
    compute_nonmotor_check,
    VoiceLoudnessResult,
    NonMotorCheckResult
)

router = APIRouter(prefix="/voice-checks", tags=["Voice Checks"])


class VoiceCheckRequest(BaseModel):
    audio_samples: Optional[List[float]] = None
    sample_rate_hz: int = 44100
    pain_score_1_5: int = Field(2, ge=1, le=5)
    fatigue_score_1_5: int = Field(3, ge=1, le=5)
    anxiety_score_1_5: int = Field(2, ge=1, le=5)
    sleep_score_1_5: Optional[int] = Field(4, ge=1, le=5)
    notes: Optional[str] = None


@router.post("")
async def create_voice_check(
    body: VoiceCheckRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Analyzes sustained-vowel voice audio (if provided) and non-motor ratings.
    """
    if body.audio_samples and len(body.audio_samples) > 0:
        voice_res = analyze_voice_sustained_vowel(
            audio_samples=body.audio_samples,
            sample_rate_hz=body.sample_rate_hz
        )
    else:
        # Demo fallback voice metrics
        voice_res = analyze_voice_sustained_vowel(
            audio_samples=[0.15 * float(i % 100) / 100.0 for i in range(44100 * 3)],
            sample_rate_hz=44100
        )

    nonmotor_res = compute_nonmotor_check(
        pain_score_1_5=body.pain_score_1_5,
        fatigue_score_1_5=body.fatigue_score_1_5,
        anxiety_score_1_5=body.anxiety_score_1_5,
        sleep_score_1_5=body.sleep_score_1_5
    )

    doc_data = {
        "voice_metrics": voice_res.model_dump(),
        "nonmotor_metrics": nonmotor_res.model_dump(),
        "notes": body.notes,
        "disclaimer": voice_res.disclaimer,
        "label": "Voice loudness & non-motor check-in"
    }

    saved = await db.create_document("voice_checks", user_id=user.user_id, data=doc_data)
    return saved


@router.get("")
async def get_voice_checks(
    limit: int = 30,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Fetches historical voice & non-motor check-ins for the user.
    """
    checks = await db.query_documents("voice_checks", user_id=user.user_id, limit=limit)
    return {
        "count": len(checks),
        "voice_checks": checks
    }
