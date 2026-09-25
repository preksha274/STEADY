"""
STEADY API v1 - Forecast Router
Generates today's 24-hour mobility forecast and best mobility window
by synthesizing user history, medication schedule, and diary check-in.
"""

from fastapi import APIRouter, Depends
from datetime import datetime
from api.auth import AuthenticatedUser, get_current_user
from db.store import db
from steady_ai import generate_day_forecast, DayForecastOutput

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.get("/today", response_model=DayForecastOutput)
async def get_today_forecast(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Computes today's personalized circadian & pharmacokinetic forecast curve.
    """
    # 1. Fetch historical session count
    sessions = await db.query_documents("sessions", user_id=user.user_id, limit=50)
    history_count = len(sessions)

    # 2. Fetch today's medication dose logs
    dose_logs = await db.query_documents("dose_logs", user_id=user.user_id, limit=10)
    dose_hours = []
    for d in dose_logs:
        if "dose_hour" in d:
            dose_hours.append(float(d["dose_hour"]))
    if not dose_hours:
        dose_hours = [7.5, 12.5, 17.5]  # Standard typical daily schedule fallback

    # 3. Fetch latest diary check-in
    diary_entries = await db.query_documents("diary_entries", user_id=user.user_id, limit=1)
    mood = 4
    fatigue = 2
    sleep = 4
    if diary_entries:
        latest_diary = diary_entries[0]
        mood = latest_diary.get("mood_score_1_5", 4)
        fatigue = latest_diary.get("fatigue_score_1_5", 2)
        sleep = latest_diary.get("sleep_score_1_5", 4)

    # 4. Current hour
    current_hour = float(datetime.now().hour) + float(datetime.now().minute) / 60.0

    # 5. Generate AI forecast
    forecast_output = generate_day_forecast(
        historical_sessions_count=history_count,
        medication_doses_today=dose_hours,
        current_hour=current_hour,
        mood_rating_1_5=mood,
        fatigue_rating_1_5=fatigue,
        sleep_rating_1_5=sleep,
        min_sessions_threshold=3
    )

    # Persist in forecasts collection
    await db.create_document(
        "forecasts",
        user_id=user.user_id,
        data=forecast_output.model_dump(),
        doc_id=f"forecast_today_{user.user_id}"
    )

    return forecast_output
