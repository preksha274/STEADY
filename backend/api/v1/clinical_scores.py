"""
STEADY API v1 - Clinical Scores Resource
Manual entry of clinician/doctor-assessed MDS-UPDRS scores.
Purely optional record-keeping. The app NEVER administers or interprets this scale,
and the AI layer never reads or factors this into predictions.
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from db.store import db

router = APIRouter(prefix="/clinical-scores", tags=["Clinical Scores"])


class ClinicalScoreCreateRequest(BaseModel):
    patient_id: str = Field(..., description="Target patient user ID")
    author_user_id: Optional[str] = Field(None, description="User ID of submitter (defaults to patient_id)")
    author_role: str = Field("patient", description="Role: 'patient' or 'family'")
    scale: str = Field("MDS-UPDRS", description="Clinical instrument scale name")
    part: str = Field(..., description="MDS-UPDRS Part: 'I', 'II', 'III', or 'IV'")
    score: float = Field(..., description="Assessed score reported by clinician")
    max_score: float = Field(..., description="Max score for the specified part (Part I: 52, II: 52, III: 132, IV: 24)")
    clinician_name: Optional[str] = Field(None, description="Optional name of the evaluating neurologist or clinician")
    date_recorded: str = Field(..., description="Date score was assessed (YYYY-MM-DD)")
    notes: Optional[str] = Field(None, description="Optional notes or context from the appointment")


class ClinicalScoreResponse(BaseModel):
    id: str
    patient_id: str
    author_user_id: str
    author_role: str
    scale: str
    part: str
    score: float
    max_score: float
    clinician_name: Optional[str] = None
    date_recorded: str
    notes: Optional[str] = None
    created_at: str


@router.post("", response_model=ClinicalScoreResponse, status_code=status.HTTP_201_CREATED)
async def create_clinical_score(payload: ClinicalScoreCreateRequest):
    """
    Log a doctor-reported MDS-UPDRS score.
    Strictly non-interpreted record keeping.
    """
    valid_parts = {"I", "II", "III", "IV"}
    clean_part = payload.part.strip().upper()
    if clean_part not in valid_parts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid MDS-UPDRS part '{payload.part}'. Must be one of: {list(valid_parts)}"
        )

    if payload.score < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Score cannot be negative."
        )

    if payload.score > payload.max_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Score ({payload.score}) exceeds maximum part score ({payload.max_score})."
        )

    author_id = payload.author_user_id or payload.patient_id

    doc_data = {
        "patient_id": payload.patient_id,
        "author_user_id": author_id,
        "author_role": payload.author_role,
        "scale": payload.scale,
        "part": clean_part,
        "score": payload.score,
        "max_score": payload.max_score,
        "clinician_name": payload.clinician_name,
        "date_recorded": payload.date_recorded,
        "notes": payload.notes,
    }

    doc = await db.create_document(
        collection_name="clinical_scores",
        user_id=payload.patient_id,
        data=doc_data
    )

    return ClinicalScoreResponse(**doc)


@router.get("", response_model=List[ClinicalScoreResponse])
async def list_clinical_scores(
    patient_id: Optional[str] = Query(None, description="Patient user ID filter")
):
    """
    List logged clinical scores for a patient.
    """
    target_id = patient_id or "default_user"
    docs = await db.query_documents(
        collection_name="clinical_scores",
        user_id=target_id,
        limit=100
    )

    # Sort chronologically by date_recorded descending
    sorted_docs = sorted(
        docs,
        key=lambda x: x.get("date_recorded", x.get("created_at", "")),
        reverse=True
    )

    return [ClinicalScoreResponse(**d) for d in sorted_docs]
