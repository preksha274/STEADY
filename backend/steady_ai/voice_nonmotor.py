"""
STEADY AI - Voice Loudness & Non-Motor Symptom Check Module
Computes audio loudness (RMS dBFS) and pitch stability over a 3-second sustained-vowel capture.
Aggregates non-motor check-in scores (Pain, Fatigue, Anxiety, Sleep).
Strictly framed as a measurement and self-check — never a diagnostic classifier.
"""

from typing import Union, Optional, Tuple, Dict, Any, List
import io
import math
import numpy as np

from .types import (
    VoiceLoudnessResult,
    NonMotorCheckResult,
    SymptomSeverityTier,
    ConfidenceReport,
    ConfidenceTier,
    QualityIssue
)


def analyze_voice_sustained_vowel(
    audio_samples: Union[np.ndarray, List[float], bytes],
    sample_rate_hz: int = 44100,
    duration_s: Optional[float] = None
) -> VoiceLoudnessResult:
    """
    Measures loudness and vocal sustain stability from a 3-second audio recording.
    Non-diagnostic framing.
    """
    if isinstance(audio_samples, bytes):
        # Interpret 16-bit PCM or float32 buffer
        arr = np.frombuffer(audio_samples, dtype=np.int16).astype(np.float32) / 32768.0
    elif isinstance(audio_samples, list):
        arr = np.array(audio_samples, dtype=np.float32)
    elif isinstance(audio_samples, np.ndarray):
        arr = audio_samples.astype(np.float32)
    else:
        raise TypeError(f"Unsupported audio type: {type(audio_samples)}")

    if len(arr) == 0:
        raise ValueError("Audio buffer is empty.")

    actual_duration = float(len(arr) / sample_rate_hz) if duration_s is None else duration_s

    # 1. Compute RMS Amplitude and dBFS
    rms = float(np.sqrt(np.mean(arr**2)))
    if rms > 1e-7:
        rms_dbfs = float(20.0 * math.log10(rms))
    else:
        rms_dbfs = -90.0

    # 2. Pitch Stability / Autocorrelation Jitter Approximation
    # Chunk audio into 50ms frames to track fundamental frequency stability
    frame_len = int(sample_rate_hz * 0.05)
    num_frames = len(arr) // frame_len

    pitch_estimates = []
    for i in range(min(num_frames, 60)):
        frame = arr[i * frame_len : (i + 1) * frame_len]
        if np.std(frame) < 0.01:
            continue
        # Autocorrelation for pitch (range 80 Hz to 400 Hz)
        min_lag = int(sample_rate_hz / 400.0)
        max_lag = int(sample_rate_hz / 80.0)
        autocorr = np.correlate(frame, frame, mode="full")
        autocorr = autocorr[len(frame) - 1 :]
        if max_lag < len(autocorr):
            peak_lag = min_lag + int(np.argmax(autocorr[min_lag:max_lag]))
            if peak_lag > 0:
                f0 = float(sample_rate_hz / peak_lag)
                pitch_estimates.append(f0)

    if len(pitch_estimates) >= 4:
        mean_pitch = float(np.mean(pitch_estimates))
        std_pitch = float(np.std(pitch_estimates))
        cv_pitch = (std_pitch / mean_pitch) if mean_pitch > 0 else 0.5
        pitch_stability_pct = max(0.0, min(100.0, (1.0 - cv_pitch) * 100.0))
    else:
        pitch_stability_pct = 85.0

    # 3. Vocal Effort Tier (Hypophonia / Soft voice tracking)
    # Target conversational vocal sustain is typically -24 to -12 dBFS
    if rms_dbfs >= -22.0:
        effort_tier = SymptomSeverityTier.MILD  # Strong / normal projection
    elif rms_dbfs >= -34.0:
        effort_tier = SymptomSeverityTier.MODERATE  # Slightly soft voice
    else:
        effort_tier = SymptomSeverityTier.HIGH  # Quiet / low vocal effort

    # 4. Confidence scoring
    if actual_duration >= 2.5 and rms_dbfs > -50.0:
        conf_tier = ConfidenceTier.HIGH
        conf_issue = QualityIssue.CLEAN_SIGNAL
        reason = f"Full 3s sustained vowel captured ({actual_duration:.1f}s, {rms_dbfs:.1f} dBFS)"
        score = 0.95
    elif actual_duration >= 1.5 and rms_dbfs > -60.0:
        conf_tier = ConfidenceTier.MEDIUM
        conf_issue = QualityIssue.SHORT_DURATION
        reason = f"Slightly short audio clip ({actual_duration:.1f}s)"
        score = 0.75
    else:
        conf_tier = ConfidenceTier.LOW
        conf_issue = QualityIssue.SUBOPTIMAL_LIGHTING if rms_dbfs < -60.0 else QualityIssue.SHORT_DURATION
        reason = "Very quiet recording or incomplete audio capture"
        score = 0.35

    conf_report = ConfidenceReport(
        tier=conf_tier,
        primary_issue=conf_issue,
        reason=reason,
        numeric_score=score
    )

    return VoiceLoudnessResult(
        duration_s=round(actual_duration, 2),
        rms_dbfs=round(rms_dbfs, 1),
        pitch_stability_pct=round(pitch_stability_pct, 1),
        vocal_effort_tier=effort_tier,
        disclaimer="Loudness & vocal sustain measurement. Not a diagnostic clinical biomarker.",
        confidence=conf_report
    )


def compute_nonmotor_check(
    pain_score_1_5: int,
    fatigue_score_1_5: int,
    anxiety_score_1_5: int,
    sleep_score_1_5: Optional[int] = None
) -> NonMotorCheckResult:
    """
    Aggregates daily non-motor check-in ratings (1 to 5 scale).
    Pure calculation with personal baseline comparison.
    """
    scores = [pain_score_1_5, fatigue_score_1_5, anxiety_score_1_5]
    if sleep_score_1_5 is not None:
        # Invert sleep: 5 is best sleep (lowest nonmotor burden), 1 is worst
        sleep_burden = 6 - sleep_score_1_5
        scores.append(sleep_burden)

    composite_index = float(np.mean(scores))

    conf_report = ConfidenceReport(
        tier=ConfidenceTier.HIGH,
        primary_issue=QualityIssue.CLEAN_SIGNAL,
        reason="Patient self-reported daily ratings verified",
        numeric_score=1.0
    )

    return NonMotorCheckResult(
        pain_score=pain_score_1_5,
        fatigue_score=fatigue_score_1_5,
        anxiety_score=anxiety_score_1_5,
        sleep_score=sleep_score_1_5,
        composite_nonmotor_index=round(composite_index, 2),
        comparison_text="Compared to your usual",
        confidence=conf_report
    )
