"""
STEADY API v1 - Sessions Endpoint Router
Handles IMU / EEG raw file uploads, MirrorMotion video/pose analysis,
session persistence, and timeline history queries.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
import numpy as np

from api.auth import AuthenticatedUser, get_current_user
from db.store import db, storage_service
from steady_ai import (
    extract_motion_features,
    extract_eeg_features,
    TremorScopeSessionOutput,
    EEGSessionOutput,
    DerivedGaitFeatures,
    ConfidenceReport
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])


MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB limit


async def update_user_baseline(user_id: str):
    """
    Recomputes personal baseline metrics across user's historical sessions.
    """
    sessions = await db.query_documents("sessions", user_id=user_id, limit=30)
    if not sessions:
        return

    tremor_amps = [s["metrics"]["tremor_amplitude"] for s in sessions if s.get("metrics") and "tremor_amplitude" in s["metrics"]]
    tremor_freqs = [s["metrics"]["tremor_frequency_hz"] for s in sessions if s.get("metrics") and "tremor_frequency_hz" in s["metrics"]]

    avg_amp = float(np.mean(tremor_amps)) if tremor_amps else 0.15
    avg_freq = float(np.mean(tremor_freqs)) if tremor_freqs else 4.8

    baseline_data = {
        "average_tremor_amplitude": round(avg_amp, 4),
        "average_tremor_frequency_hz": round(avg_freq, 2),
        "total_sessions_count": len(sessions),
        "last_session_id": sessions[0]["id"] if sessions else None
    }

    # Store in baselines collection
    await db.create_document("baselines", user_id=user_id, data=baseline_data, doc_id=f"base_{user_id}")


@router.post("/upload")
async def upload_session(
    imu_file: UploadFile = File(...),
    eeg_file: Optional[UploadFile] = File(None),
    baseline_amplitude: Optional[float] = Form(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Uploads raw accelerometer/gyroscope CSV + optional EEG file.
    Validates file format, persists raw files to Storage, extracts AI features,
    stores session document in Firestore, and updates user's baseline.
    """
    # 1. Validate IMU file format
    if not imu_file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IMU file format. Please upload a CSV file with accelerometer columns (ax, ay, az)."
        )

    imu_content = await imu_file.read()
    if len(imu_content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded IMU file is empty.")
    if len(imu_content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IMU file exceeds 50MB size limit.")

    # 2. Store raw IMU file reference in Storage
    imu_storage_ref = await storage_service.save_file(
        user_id=user.user_id,
        filename=imu_file.filename,
        content=imu_content,
        category="imu"
    )

    # 3. Call AI Motion Feature Extraction
    try:
        motion_output: TremorScopeSessionOutput = extract_motion_features(
            data=imu_content,
            baseline_amplitude=baseline_amplitude
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"IMU analysis failed: {str(e)}"
        )

    # 4. Process optional EEG file
    eeg_storage_ref = None
    eeg_data = None
    if eeg_file is not None and eeg_file.filename:
        eeg_content = await eeg_file.read()
        if len(eeg_content) > 0:
            eeg_storage_ref = await storage_service.save_file(
                user_id=user.user_id,
                filename=eeg_file.filename,
                content=eeg_content,
                category="eeg"
            )
            try:
                eeg_output: EEGSessionOutput = extract_eeg_features(eeg_content)
                eeg_data = {
                    "channel_count": eeg_output.channel_count,
                    "band_powers": eeg_output.band_powers.model_dump(),
                    "quality": eeg_output.quality.model_dump(),
                    "confidence": eeg_output.confidence.model_dump(),
                    "beta_band_power": eeg_output.beta_band_power,
                    "beta_relative_ratio": eeg_output.beta_relative_ratio
                }
            except Exception as e:
                # Still store session if IMU succeeded, log EEG error
                eeg_data = {"error": f"EEG processing warning: {str(e)}"}

    # 5. Build and Persist Session Document
    session_data = {
        "type": "movement_checkin",
        "imu_file_ref": imu_storage_ref,
        "eeg_file_ref": eeg_storage_ref,
        "metrics": motion_output.metrics.model_dump(),
        "quality": motion_output.quality.model_dump(),
        "confidence": motion_output.confidence.model_dump(),
        "baseline_deviation_pct": motion_output.baseline_deviation_pct,
        "label": motion_output.label,
        "chart_data": {
            "signal": [p.model_dump() for p in motion_output.chart_signal],
            "psd": [p.model_dump() for p in motion_output.chart_psd],
        },
        "eeg": eeg_data
    }

    saved_session = await db.create_document("sessions", user_id=user.user_id, data=session_data)

    # 6. Recompute and update user baseline
    await update_user_baseline(user.user_id)

    return saved_session


@router.post("/{session_id}/video")
async def upload_session_video(
    session_id: str,
    video_file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Uploads MirrorMotion video, stores reference in Storage, extracts pose/gait features,
    and links to existing session.
    """
    session = await db.get_document("sessions", user_id=user.user_id, doc_id=session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    content = await video_file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded video file is empty.")

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Video file exceeds size limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
        )

    # Validate video format
    allowed_extensions = (".mp4", ".mov", ".webm", ".avi", ".mkv")
    if not video_file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported video format. Allowed formats: {', '.join(allowed_extensions)}"
        )

    video_storage_ref = await storage_service.save_file(
        user_id=user.user_id,
        filename=video_file.filename,
        content=content,
        category="video"
    )

    # Derived gait features from video pose stream
    try:
        from steady_ai.pose import process_video_gait_analysis
        gait_features, confidence_report, gait_summary = process_video_gait_analysis(
            video_content=content,
            filename=video_file.filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process video gait features: {str(e)}"
        )

    updated = await db.update_document(
        "sessions",
        user_id=user.user_id,
        doc_id=session_id,
        updates={
            "video_file_ref": video_storage_ref,
            "gait_features": gait_features.model_dump(),
            "gait_summary": gait_summary,
            "confidence_report": confidence_report.model_dump()
        }
    )
    return updated


@router.get("")
async def get_sessions(
    range: str = Query("all", description="Filter range: 7d, 30d, all"),
    limit: int = Query(50, ge=1, le=200),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Fetches historical session timeline for the authenticated user.
    """
    sessions = await db.query_documents("sessions", user_id=user.user_id, limit=limit)
    return {
        "count": len(sessions),
        "range": range,
        "sessions": sessions
    }


@router.get("/{session_id}")
async def get_session_by_id(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Retrieves a single session with complete metrics and chart series.
    """
    session = await db.get_document("sessions", user_id=user.user_id, doc_id=session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return session
