"""
STEADY API v1 - Baseline Router
Retrieves the user's current recomputed personal movement baseline.
"""

from fastapi import APIRouter, Depends
from api.auth import AuthenticatedUser, get_current_user
from db.store import db

router = APIRouter(prefix="/baseline", tags=["Baseline"])


@router.get("")
async def get_baseline(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns current personal baseline for the authenticated user.
    """
    baseline_doc = await db.get_document("baselines", user_id=user.user_id, doc_id=f"base_{user.user_id}")
    if not baseline_doc:
        # Default baseline if new user
        return {
            "user_id": user.user_id,
            "average_tremor_amplitude": 0.18,
            "average_tremor_frequency_hz": 4.8,
            "average_gait_speed_mps": 0.95,
            "beta_band_power": 0.28,
            "total_sessions_count": 0,
            "is_calibrated": False,
            "label": "Baseline establishing (3 sessions required)"
        }

    return {
        **baseline_doc,
        "is_calibrated": baseline_doc.get("total_sessions_count", 0) >= 3,
        "label": "Personal baseline active"
    }
