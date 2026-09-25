"""
STEADY AI - Live Cue Adaptation Engine & Fatigue Detection
Implements transparent 1D hill-climbing tempo optimization and habituation/fatigue
detection to nudge rhythmic auditory/visual/haptic cues toward the user's optimal cadence.
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from .types import (
    CueType,
    CueCandidateState,
    CueAdaptationStepOutput,
    ConfidenceReport,
    ConfidenceTier,
    QualityIssue
)


def compute_cue_benefit_score(synchronization_pct: float, stride_smoothness: float) -> float:
    """
    Composite objective function (0.0 to 1.0):
    65% weight on beat synchronization accuracy + 35% on stride smoothness/fluidity.
    """
    norm_sync = max(0.0, min(1.0, synchronization_pct / 100.0))
    norm_smooth = max(0.0, min(1.0, stride_smoothness))
    return 0.65 * norm_sync + 0.35 * norm_smooth


def adapt_cue_tempo_step(
    current_cue_type: CueType,
    current_tempo_bpm: int,
    measured_cadence_spm: float,
    current_sync_pct: float,
    current_stride_smoothness: float,
    prev_tempo_bpm: Optional[int] = None,
    prev_benefit_score: Optional[float] = None,
    sync_history_last_5_steps: Optional[List[float]] = None,
    min_tempo_bpm: int = 60,
    max_tempo_bpm: int = 120,
    tempo_step_bpm: int = 2
) -> CueAdaptationStepOutput:
    """
    Transparent 1D Hill-Climbing Adaptive Update Rule:
    1. Evaluates current benefit score vs prior step.
    2. Nudges tempo towards measured natural cadence with bounded step size.
    3. Detects cue fatigue/habituation if synchronization degrades across consecutive steps.
    """
    current_benefit = compute_cue_benefit_score(current_sync_pct, current_stride_smoothness)

    # 1. Cue fatigue detection
    cue_fatigue_detected = False
    rotation_rec: Optional[CueType] = None
    reason_parts = []

    if sync_history_last_5_steps and len(sync_history_last_5_steps) >= 3:
        # Check if drop > 12% from peak in recent history
        peak_sync = max(sync_history_last_5_steps)
        if (peak_sync - current_sync_pct) >= 12.0 and current_sync_pct < 75.0:
            cue_fatigue_detected = True
            # Recommend rotating to an alternate modality
            rotation_map = {
                CueType.AUDIO_BEAT: CueType.VIBRATION_PULSE,
                CueType.VIBRATION_PULSE: CueType.VISUAL_FLASH,
                CueType.VISUAL_FLASH: CueType.AUDIO_BEAT
            }
            rotation_rec = rotation_map.get(current_cue_type, CueType.AUDIO_BEAT)
            reason_parts.append(f"Cue fatigue detected (sync dropped from {peak_sync:.0f}% to {current_sync_pct:.0f}%). Suggest rotating to {rotation_rec.value}.")

    # 2. 1D Hill-Climbing Adaptation
    suggested_tempo = current_tempo_bpm

    if not cue_fatigue_detected:
        cadence_delta = measured_cadence_spm - current_tempo_bpm

        if prev_tempo_bpm is not None and prev_benefit_score is not None:
            # If benefit improved, keep nudging in that direction
            score_delta = current_benefit - prev_benefit_score
            step_dir = 1 if current_tempo_bpm >= prev_tempo_bpm else -1

            if score_delta >= 0:
                # Keep moving in same direction towards natural cadence
                direction = 1 if cadence_delta > 0 else -1
            else:
                # Reverse direction
                direction = -step_dir
        else:
            # First step: nudge in direction of measured cadence
            direction = 1 if cadence_delta > 0 else -1

        # Apply bounded step
        if abs(cadence_delta) > 1.0:
            suggested_tempo = current_tempo_bpm + (direction * tempo_step_bpm)
        else:
            suggested_tempo = current_tempo_bpm

        suggested_tempo = max(min_tempo_bpm, min(max_tempo_bpm, suggested_tempo))

        if suggested_tempo != current_tempo_bpm:
            reason_parts.append(f"Adjusted tempo by {suggested_tempo - current_tempo_bpm:+d} BPM towards target cadence {measured_cadence_spm:.0f} SPM.")
        else:
            reason_parts.append(f"Optimal cadence locked at {current_tempo_bpm} BPM.")

    adaptation_reason = " ".join(reason_parts) if reason_parts else "Steady tempo maintained."

    conf_tier = ConfidenceTier.HIGH if current_sync_pct >= 80.0 else (
        ConfidenceTier.MEDIUM if current_sync_pct >= 60.0 else ConfidenceTier.LOW
    )

    conf_report = ConfidenceReport(
        tier=conf_tier,
        primary_issue=QualityIssue.CLEAN_SIGNAL if conf_tier != ConfidenceTier.LOW else QualityIssue.MISSING_SAMPLES_OR_JITTER,
        reason=f"Beat sync at {current_sync_pct:.1f}% with smoothness score {current_stride_smoothness:.2f}",
        numeric_score=current_benefit
    )

    return CueAdaptationStepOutput(
        current_cue_type=current_cue_type,
        current_tempo_bpm=current_tempo_bpm,
        suggested_tempo_bpm=suggested_tempo,
        synchronization_pct=round(current_sync_pct, 1),
        stride_smoothness=round(current_stride_smoothness, 2),
        cue_fatigue_detected=cue_fatigue_detected,
        recommended_rotation=rotation_rec,
        adaptation_reason=adaptation_reason,
        confidence=conf_report
    )
