"""
STEADY API v1 - Wearable Summary & Series Endpoints
Provides aggregated wearable movement metrics and historical timeseries.
"""

from fastapi import APIRouter, Query, HTTPException, status
from typing import Dict, Any, List, Optional
from steady_ai.wearable_storage import wearable_storage

router = APIRouter(prefix="/wearable", tags=["Wearable"])


@router.get("/summary")
def get_wearable_summary(
    range: str = Query("day", description="Time range: day, week, month, all")
) -> Dict[str, Any]:
    """
    Returns high-level summary KPIs for wearable kinematics across the requested range.
    """
    valid_ranges = {"day", "week", "month", "all"}
    if range not in valid_ranges:
        range = "day"
    return wearable_storage.get_summary(time_range=range)


@router.get("/series")
def get_wearable_series(
    range: str = Query("day", description="Time range: day, week, month, all")
) -> List[Dict[str, Any]]:
    """
    Returns per-minute aggregated time-series data points for charts.
    """
    valid_ranges = {"day", "week", "month", "all"}
    if range not in valid_ranges:
        range = "day"
    return wearable_storage.get_series(time_range=range)


@router.get("/status")
def get_wearable_status() -> Dict[str, Any]:
    """
    Returns active session metadata, total processed samples, and bad line counts.
    """
    return {
        "active_session_id": wearable_storage.active_session_id,
        "session_started_at_utc": wearable_storage.session_started_at_utc,
        "total_processed_samples": wearable_storage.total_processed_samples,
        "bad_lines_count": wearable_storage.bad_lines_count,
    }


@router.post("/session/renew")
def renew_wearable_session() -> Dict[str, Any]:
    """
    Rotates the active session identifier.
    """
    new_id = wearable_storage.renew_session()
    return {
        "status": "renewed",
        "new_session_id": new_id,
        "session_started_at_utc": wearable_storage.session_started_at_utc,
    }


@router.get("/config")
def get_wearable_config() -> Dict[str, Any]:
    """
    Returns the unified movement severity configuration.
    """
    from steady_ai.severity_engine import load_severity_config
    return load_severity_config()


