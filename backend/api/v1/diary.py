"""
STEADY API v1 - Diary Router
Quick-tap daily symptom, mood, fatigue, and sleep check-ins.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Body, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db
from steady_ai import compute_nonmotor_check

router = APIRouter(prefix="/diary", tags=["Diary"])


class DiaryEntryRequest(BaseModel):
    mood: str = Field("Okay", description="Great, Okay, Tough")
    mood_score_1_5: int = Field(3, ge=1, le=5)
    fatigue_score_1_5: int = Field(2, ge=1, le=5)
    pain_score_1_5: int = Field(1, ge=1, le=5)
    anxiety_score_1_5: int = Field(2, ge=1, le=5)
    sleep_score_1_5: Optional[int] = Field(4, ge=1, le=5)
    notes: Optional[str] = None


@router.post("")
async def create_diary_entry(
    entry: DiaryEntryRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Records a daily quick-tap check-in with aggregated non-motor burden score.
    """
    nonmotor_res = compute_nonmotor_check(
        pain_score_1_5=entry.pain_score_1_5,
        fatigue_score_1_5=entry.fatigue_score_1_5,
        anxiety_score_1_5=entry.anxiety_score_1_5,
        sleep_score_1_5=entry.sleep_score_1_5
    )

    doc_data = {
        "mood": entry.mood,
        "mood_score_1_5": entry.mood_score_1_5,
        "fatigue_score_1_5": entry.fatigue_score_1_5,
        "pain_score_1_5": entry.pain_score_1_5,
        "anxiety_score_1_5": entry.anxiety_score_1_5,
        "sleep_score_1_5": entry.sleep_score_1_5,
        "notes": entry.notes,
        "composite_nonmotor_index": nonmotor_res.composite_nonmotor_index,
        "confidence": nonmotor_res.confidence.model_dump(),
        "comparison_text": nonmotor_res.comparison_text
    }

    saved = await db.create_document("diary_entries", user_id=user.user_id, data=doc_data)
    return saved


@router.get("")
async def get_diary_entries(
    limit: int = 30,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Fetches historical diary entries for the authenticated user.
    """
    entries = await db.query_documents("diary_entries", user_id=user.user_id, limit=limit)
    return {
        "count": len(entries),
        "entries": entries
    }
