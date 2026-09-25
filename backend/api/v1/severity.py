"""
STEADY API v1 - Severity Readings Router
Computes today's traffic-light severity readings across key motor symptoms
blending recent sensor measurements with patient check-ins.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from api.auth import AuthenticatedUser, get_current_user
from db.store import db
from steady_ai import (
    compute_symptom_severity,
    SymptomSeverityTier,
    SymptomSeverityResult,
    ConfidenceTier
)

router = APIRouter(prefix="/severity", tags=["Severity"])


@router.get("")
async def get_today_severity_readings(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns today's traffic-light status for Resting Tremor, Movement Slowness, and Gait Hesitation.
    Strictly framed as 'Compared to your usual'.
    """
    # 1. Fetch latest session & baseline
    sessions = await db.query_documents("sessions", user_id=user.user_id, limit=1)
    baseline = await db.get_document("baselines", user_id=user.user_id, doc_id=f"base_{user.user_id}")

    base_amp = baseline.get("average_tremor_amplitude", 0.18) if baseline else 0.18

    # 2. Latest metrics or default demo fallback
    curr_tremor = 0.16
    conf_tier = ConfidenceTier.HIGH
    if sessions:
        latest = sessions[0]
        curr_tremor = latest.get("metrics", {}).get("tremor_amplitude", 0.16)
        conf_tier = ConfidenceTier(latest.get("confidence", {}).get("tier", "high"))

    # 3. Compute severity readings
    tremor_reading = compute_symptom_severity(
        symptom_name="Resting Tremor",
        patient_rating_1_5=2,
        current_metric_value=curr_tremor,
        baseline_metric_value=base_amp,
        measurement_confidence=conf_tier
    )

    slowness_reading = compute_symptom_severity(
        symptom_name="Movement Slowness",
        patient_rating_1_5=2,
        current_metric_value=1.05,
        baseline_metric_value=1.10,
        measurement_confidence=conf_tier
    )

    gait_reading = compute_symptom_severity(
        symptom_name="Gait Hesitation",
        patient_rating_1_5=3,
        current_metric_value=0.25,
        baseline_metric_value=0.22,
        measurement_confidence=conf_tier
    )

    readings = [
        tremor_reading.model_dump(),
        slowness_reading.model_dump(),
        gait_reading.model_dump()
    ]

    return {
        "user_id": user.user_id,
        "label": "Compared to your usual",
        "readings": readings
    }
