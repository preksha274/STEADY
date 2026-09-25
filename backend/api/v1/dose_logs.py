"""
STEADY API v1 - Medication Dose Logs Router
One-tap Levodopa / medication logging with ON/OFF motor state tagging.
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

router = APIRouter(prefix="/dose-logs", tags=["Dose Logs"])


class LogDoseRequest(BaseModel):
    medication_name: str = "Levodopa / Carbidopa"
    dosage_mg: int = 100
    state_at_dose: str = Field("Wearing Off", description="'ON', 'OFF', 'Wearing Off', 'Optimal'")
    dose_hour: Optional[float] = None
    notes: Optional[str] = None


@router.post("")
async def log_medication_dose(
    body: LogDoseRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Logs a single medication dose.
    """
    now = datetime.now()
    hour_val = body.dose_hour if body.dose_hour is not None else (float(now.hour) + float(now.minute) / 60.0)

    doc_data = {
        "medication_name": body.medication_name,
        "dosage_mg": body.dosage_mg,
        "state_at_dose": body.state_at_dose,
        "dose_hour": round(hour_val, 2),
        "notes": body.notes,
        "timestamp_str": now.strftime("%I:%M %p")
    }

    saved = await db.create_document("dose_logs", user_id=user.user_id, data=doc_data)
    return saved


@router.get("")
async def get_dose_logs(
    limit: int = 30,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Returns history of medication dose logs for the authenticated user.
    """
    doses = await db.query_documents("dose_logs", user_id=user.user_id, limit=limit)
    return {
        "count": len(doses),
        "doses": doses
    }
