"""
STEADY AI - Data Quality & Confidence Scoring Module
Pure functions returning standardized confidence tiers (High/Medium/Low)
and specific root causes directly consumable by UI ConfidenceBadges.
"""

from typing import Optional, List, Dict, Any
import numpy as np
from .types import ConfidenceTier, QualityIssue, ConfidenceReport


def score_motion_confidence(
    duration_s: float,
    variability: float,
    missing_samples_pct: float = 0.0,
    sample_rate_hz: float = 100.0,
    is_clipped: bool = False
) -> ConfidenceReport:
    """
    Computes confidence tier and quality reason for phone/wearable IMU motion streams.
    Rules:
    - Low: Duration < 5.0s, or missing > 10%, or extreme variability > 5.0 (device shaking/dropping), or clipped.
    - Medium: Duration between 5.0s and 10.0s, or missing between 2% and 10%, or slight noise.
    - High: Duration >= 10.0s, missing < 2%, clean steady baseline.
    """
    if is_clipped:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.HIGH_NOISE_OR_MOTION_ARTIFACT,
            reason="Sensor saturated or clipped during motion capture",
            numeric_score=0.25
        )

    if duration_s < 4.8:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.SHORT_DURATION,
            reason=f"Recording duration ({duration_s:.1f}s) is too short (< 5s required)",
            numeric_score=0.35
        )

    if missing_samples_pct > 10.0:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.MISSING_SAMPLES_OR_JITTER,
            reason=f"High rate of dropped sensor samples ({missing_samples_pct:.1f}%)",
            numeric_score=0.40
        )

    if variability > 4.5:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.HIGH_NOISE_OR_MOTION_ARTIFACT,
            reason="High extraneous motion artifact or erratic device handling",
            numeric_score=0.45
        )

    if duration_s < 9.5 or missing_samples_pct > 3.0 or variability > 3.0:
        issue = QualityIssue.SHORT_DURATION if duration_s < 9.5 else QualityIssue.HIGH_NOISE_OR_MOTION_ARTIFACT
        return ConfidenceReport(
            tier=ConfidenceTier.MEDIUM,
            primary_issue=issue,
            reason=f"Acceptable signal ({duration_s:.1f}s) with slight motion noise or short duration",
            numeric_score=0.75
        )


    return ConfidenceReport(
        tier=ConfidenceTier.HIGH,
        primary_issue=QualityIssue.CLEAN_SIGNAL,
        reason=f"Sufficient duration ({duration_s:.1f}s) with steady baseline and low noise",
        numeric_score=0.95
    )


def score_eeg_confidence(
    duration_s: float,
    channel_count: int,
    flat_channels: List[str],
    artifact_channels: List[str],
    line_noise_present: bool,
    blink_or_muscle_present: bool = False
) -> ConfidenceReport:
    """
    Computes confidence tier and quality reason for EEG streams.
    """
    if channel_count == 0:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.SENSOR_DISCONNECTED,
            reason="No active EEG channels detected",
            numeric_score=0.0
        )

    total_bad = len(flat_channels) + len(artifact_channels)
    bad_ratio = total_bad / max(1, channel_count)

    if flat_channels and bad_ratio >= 0.5:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.FLAT_CHANNEL,
            reason=f"Majority flatline channels ({', '.join(flat_channels)})",
            numeric_score=0.2
        )

    if duration_s < 3.0 or bad_ratio > 0.4:
        issue = QualityIssue.SHORT_DURATION if duration_s < 3.0 else QualityIssue.CHANNEL_ARTIFACT_OR_DRIFT
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=issue,
            reason=f"Short duration ({duration_s:.1f}s) or high channel artifact ratio",
            numeric_score=0.35
        )

    if line_noise_present and bad_ratio > 0.2:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.MAINS_LINE_NOISE,
            reason="Strong 50/60Hz line interference and noisy electrode contacts",
            numeric_score=0.45
        )

    if total_bad > 0 or line_noise_present or blink_or_muscle_present or duration_s < 8.0:
        issue = QualityIssue.MAINS_LINE_NOISE if line_noise_present else (
            QualityIssue.CHANNEL_ARTIFACT_OR_DRIFT if total_bad > 0 else QualityIssue.SHORT_DURATION
        )
        return ConfidenceReport(
            tier=ConfidenceTier.MEDIUM,
            primary_issue=issue,
            reason=f"Good EEG recording ({duration_s:.1f}s) with minor artifacts or 1 noisy channel",
            numeric_score=0.72
        )

    return ConfidenceReport(
        tier=ConfidenceTier.HIGH,
        primary_issue=QualityIssue.CLEAN_SIGNAL,
        reason=f"Clean multi-channel EEG ({duration_s:.1f}s) across all {channel_count} channels",
        numeric_score=0.96
    )


def score_camera_confidence(
    mean_landmark_visibility: float,
    occluded_frame_pct: float,
    fps: float,
    total_frames: int
) -> ConfidenceReport:
    """
    Computes confidence tier and quality reason for camera pose estimation streams.
    """
    if total_frames < 15 or fps < 10.0:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.SHORT_DURATION,
            reason="Insufficient frame capture rate or very short camera clip",
            numeric_score=0.30
        )

    if mean_landmark_visibility < 0.5 or occluded_frame_pct > 35.0:
        return ConfidenceReport(
            tier=ConfidenceTier.LOW,
            primary_issue=QualityIssue.LOW_VISIBILITY_OR_OCCLUSION,
            reason="Subject partially occluded or out of camera frame",
            numeric_score=0.40
        )

    if mean_landmark_visibility < 0.75 or occluded_frame_pct > 15.0 or fps < 20.0:
        return ConfidenceReport(
            tier=ConfidenceTier.MEDIUM,
            primary_issue=QualityIssue.SUBOPTIMAL_LIGHTING if mean_landmark_visibility < 0.75 else QualityIssue.LOW_VISIBILITY_OR_OCCLUSION,
            reason="Adequate pose tracking with occasional occlusion or low contrast lighting",
            numeric_score=0.75
        )

    return ConfidenceReport(
        tier=ConfidenceTier.HIGH,
        primary_issue=QualityIssue.CLEAN_SIGNAL,
        reason="Full body landmarks tracked with high visibility (>80%) at steady frame rate",
        numeric_score=0.95
    )
