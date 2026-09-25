"""
STEADY AI & Signal Processing - Core Data Types & Schemas
All data structures are typed Pydantic models / Dataclasses ensuring pure function signatures.
Strictly non-diagnostic framing and standardized confidence tiers.
"""

from enum import Enum
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field


# ==========================================
# Standardized Confidence & Quality Enums
# ==========================================

class ConfidenceTier(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class QualityIssue(str, Enum):
    CLEAN_SIGNAL = "clean_signal"
    SHORT_DURATION = "short_duration"
    HIGH_NOISE_OR_MOTION_ARTIFACT = "high_noise_or_motion_artifact"
    FLAT_CHANNEL = "flat_channel"
    CHANNEL_ARTIFACT_OR_DRIFT = "channel_artifact_or_drift"
    MAINS_LINE_NOISE = "mains_line_noise"
    LOW_VISIBILITY_OR_OCCLUSION = "low_visibility_or_occlusion"
    SUBOPTIMAL_LIGHTING = "suboptimal_lighting"
    MISSING_SAMPLES_OR_JITTER = "missing_samples_or_jitter"
    SENSOR_DISCONNECTED = "sensor_disconnected"
    INSUFFICIENT_HISTORY = "insufficient_history"


class SymptomSeverityTier(str, Enum):
    MILD = "mild"
    MODERATE = "moderate"
    HIGH = "high"


class CueType(str, Enum):
    AUDIO_BEAT = "audio_beat"
    VIBRATION_PULSE = "vibration_pulse"
    VISUAL_FLASH = "visual_flash"


class MoveCoachFeedbackCode(str, Enum):
    EXCELLENT_RHYTHM = "excellent_rhythm"
    BIGGER_REACH = "bigger_reach"
    STAND_TALLER = "stand_taller"
    SLOW_DOWN = "slow_down"
    STEADY_PACE = "steady_pace"
    MATCH_THE_BEAT = "match_the_beat"
    INCREASE_STEP_HEIGHT = "increase_step_height"
    SYMMETRIC_ARM_SWING = "symmetric_arm_swing"


# ==========================================
# 1. Motion / TremorScope Models
# ==========================================

class SignalQuality(BaseModel):
    duration_s: float
    sample_rate_hz: float
    missing_samples_pct: float = 0.0
    is_short: bool = False
    is_noisy: bool = False
    details: str = "Signal validated"


class ConfidenceReport(BaseModel):
    tier: ConfidenceTier
    primary_issue: QualityIssue
    reason: str
    numeric_score: float = Field(default=1.0, ge=0.0, le=1.0)


class ChartPoint(BaseModel):
    time_s: float
    raw_magnitude: float
    filtered_magnitude: float


class PSDPoint(BaseModel):
    freq_hz: float
    power: float


class TremorMetrics(BaseModel):
    tremor_frequency_hz: float
    tremor_amplitude: float
    intensity: SymptomSeverityTier
    signal_magnitude: float
    variability: float
    gyro_rms: Optional[float] = None
    step_cadence_spm: Optional[float] = None
    step_regularity: Optional[float] = None
    asymmetry_index: Optional[float] = None


class TremorScopeSessionOutput(BaseModel):
    session_id: Optional[str] = None
    metrics: TremorMetrics
    quality: SignalQuality
    confidence: ConfidenceReport
    chart_signal: List[ChartPoint] = Field(default_factory=list)
    chart_psd: List[PSDPoint] = Field(default_factory=list)
    baseline_deviation_pct: Optional[float] = None
    label: str = "Compared to your usual"


# ==========================================
# 2. EEG Band-Power Models
# ==========================================

class BandPowerDetail(BaseModel):
    absolute: float
    relative: float
    band_hz: Tuple[float, float]


class EEGBandPowers(BaseModel):
    delta: BandPowerDetail
    theta: BandPowerDetail
    alpha: BandPowerDetail
    beta: BandPowerDetail
    gamma: Optional[BandPowerDetail] = None
    total_power_0_5_45hz: float


class EEGQualityReport(BaseModel):
    duration_s: float
    sample_rate_hz: float
    channel_count: int
    flat_channels: List[str] = Field(default_factory=list)
    artifact_channels: List[str] = Field(default_factory=list)
    line_noise_present: bool = False
    blink_or_muscle_artifact: bool = False
    is_short: bool = False


class EEGSessionOutput(BaseModel):
    session_id: Optional[str] = None
    channel_count: int
    channels: List[str]
    band_powers: EEGBandPowers
    quality: EEGQualityReport
    confidence: ConfidenceReport
    chart_psd: List[PSDPoint] = Field(default_factory=list)
    beta_band_power: float
    beta_relative_ratio: float


# ==========================================
# 3. Pose & Move Coach Models
# ==========================================

class LandmarkPoint(BaseModel):
    id: int
    name: str
    x: float
    y: float
    z: float = 0.0
    visibility: float = 1.0


class PoseFrame(BaseModel):
    timestamp_s: float
    landmarks: List[LandmarkPoint]


class DerivedGaitFeatures(BaseModel):
    trunk_inclination_deg: float
    left_arm_swing_deg: float
    right_arm_swing_deg: float
    arm_swing_asymmetry_pct: float
    left_knee_flexion_deg: float
    right_knee_flexion_deg: float
    step_width_norm: float
    movement_speed_norm: float


class MoveCoachPrompt(BaseModel):
    code: MoveCoachFeedbackCode
    prompt_text: str
    severity: str = "info"  # "info" | "warning" | "praise"
    triggered_metric: str
    metric_value: float
    target_threshold: float


class MoveCoachFeedbackOutput(BaseModel):
    timestamp_s: float
    features: DerivedGaitFeatures
    prompts: List[MoveCoachPrompt]
    beat_sync_pct: float
    rep_count: int
    confidence: ConfidenceReport


# ==========================================
# 4. Personal Response Curve & Forecast Models
# ==========================================

class HourlyForecastPoint(BaseModel):
    hour: int  # 0 - 23
    hour_label: str  # "9 AM"
    predicted_mobility_score: float  # 0.0 (difficult) to 1.0 (optimal)
    uncertainty_lower: float
    uncertainty_upper: float
    is_optimal_window: bool
    state_label: str  # "Good Window", "Steady Window", "Wearing Off Risk"


class BestMobilityWindow(BaseModel):
    start_hour: int
    end_hour: int
    window_label: str  # "9 AM - 10 AM"
    confidence_tier: ConfidenceTier
    recommendation: str


class DayForecastOutput(BaseModel):
    has_sufficient_data: bool
    status_message: str
    best_window: Optional[BestMobilityWindow] = None
    timeline: List[HourlyForecastPoint] = Field(default_factory=list)
    confidence: ConfidenceReport
    hours_since_last_dose: Optional[float] = None
    next_dose_time_str: Optional[str] = None


# ==========================================
# 5. Live Cue Adaptation Models
# ==========================================

class CueCandidateState(BaseModel):
    cue_type: CueType
    tempo_bpm: int
    synchronization_pct: float
    stride_smoothness: float
    is_winning: bool = False


class CueAdaptationStepOutput(BaseModel):
    current_cue_type: CueType
    current_tempo_bpm: int
    suggested_tempo_bpm: int
    synchronization_pct: float
    stride_smoothness: float
    cue_fatigue_detected: bool
    recommended_rotation: Optional[CueType] = None
    adaptation_reason: str
    confidence: ConfidenceReport


# ==========================================
# 6. Severity Meter Models
# ==========================================

class SymptomSeverityResult(BaseModel):
    symptom_name: str
    patient_rating_1_5: int
    baseline_deviation_pct: float
    computed_tier: SymptomSeverityTier
    tier_label: str  # "Mild", "Moderate", "High"
    comparison_text: str = "Compared to your usual"
    confidence: ConfidenceReport


# ==========================================
# 7. Freeze Index (Experimental) Models
# ==========================================

class FreezeIndexResult(BaseModel):
    freeze_index_ratio: float
    locomotion_power: float
    freeze_power: float
    freeze_risk_tier: SymptomSeverityTier
    is_experimental: bool = True
    disclaimer: str = "Experimental indicator. The 'I'm frozen' button is the primary and reliable safety path."
    confidence: ConfidenceReport


# ==========================================
# 8. Voice Loudness & Non-Motor Check Models
# ==========================================

class VoiceLoudnessResult(BaseModel):
    duration_s: float
    rms_dbfs: float
    pitch_stability_pct: float
    vocal_effort_tier: SymptomSeverityTier
    disclaimer: str = "Loudness & vocal sustain measurement. Not a diagnostic clinical biomarker."
    confidence: ConfidenceReport


class NonMotorCheckResult(BaseModel):
    pain_score: int
    fatigue_score: int
    anxiety_score: int
    sleep_score: Optional[int] = None
    composite_nonmotor_index: float
    comparison_text: str = "Compared to your usual"
    confidence: ConfidenceReport
