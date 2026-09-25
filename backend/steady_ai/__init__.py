"""
STEADY AI & Signal Processing Package
Isolated, typed algorithms for Parkinson's movement companion analysis.

Modules:
- motion: TremorScope & Gait feature extraction
- eeg: Multi-channel band powers & artifact diagnostics
- pose: MirrorMotion landmark features & Move Coach rule-based feedback
- confidence: Tiered confidence & quality scoring
- forecast: Personal response curves & daylight mobility forecast
- cue_adaptation: 1D hill-climbing adaptive tempo & habituation detection
- severity: Severity meter scoring ("Compared to your usual")
- freeze_index: Experimental freezing-of-gait spectral ratio
- voice_nonmotor: Voice loudness & non-motor check-in aggregator
- datasets: Research dataset loaders & validation generators
"""

from .types import (
    ConfidenceTier,
    QualityIssue,
    SymptomSeverityTier,
    CueType,
    MoveCoachFeedbackCode,
    SignalQuality,
    ConfidenceReport,
    ChartPoint,
    PSDPoint,
    TremorMetrics,
    TremorScopeSessionOutput,
    BandPowerDetail,
    EEGBandPowers,
    EEGQualityReport,
    EEGSessionOutput,
    LandmarkPoint,
    PoseFrame,
    DerivedGaitFeatures,
    MoveCoachPrompt,
    MoveCoachFeedbackOutput,
    HourlyForecastPoint,
    BestMobilityWindow,
    DayForecastOutput,
    CueCandidateState,
    CueAdaptationStepOutput,
    SymptomSeverityResult,
    FreezeIndexResult,
    VoiceLoudnessResult,
    NonMotorCheckResult
)

from .motion import extract_motion_features
from .eeg import extract_eeg_features
from .pose import extract_pose_gait_features, evaluate_move_coach_rules, process_pose_stream_frame
from .confidence import score_motion_confidence, score_eeg_confidence, score_camera_confidence
from .forecast import generate_day_forecast
from .cue_adaptation import adapt_cue_tempo_step, compute_cue_benefit_score
from .severity import compute_symptom_severity
from .freeze_index import compute_freeze_index
from .voice_nonmotor import analyze_voice_sustained_vowel, compute_nonmotor_check
from .datasets import (
    generate_gait_assessment_sample,
    generate_oxford_voice_sample,
    generate_nemar_eeg_sample
)

__all__ = [
    # Types
    "ConfidenceTier",
    "QualityIssue",
    "SymptomSeverityTier",
    "CueType",
    "MoveCoachFeedbackCode",
    "SignalQuality",
    "ConfidenceReport",
    "ChartPoint",
    "PSDPoint",
    "TremorMetrics",
    "TremorScopeSessionOutput",
    "BandPowerDetail",
    "EEGBandPowers",
    "EEGQualityReport",
    "EEGSessionOutput",
    "LandmarkPoint",
    "PoseFrame",
    "DerivedGaitFeatures",
    "MoveCoachPrompt",
    "MoveCoachFeedbackOutput",
    "HourlyForecastPoint",
    "BestMobilityWindow",
    "DayForecastOutput",
    "CueCandidateState",
    "CueAdaptationStepOutput",
    "SymptomSeverityResult",
    "FreezeIndexResult",
    "VoiceLoudnessResult",
    "NonMotorCheckResult",
    # Functions
    "extract_motion_features",
    "extract_eeg_features",
    "extract_pose_gait_features",
    "evaluate_move_coach_rules",
    "process_pose_stream_frame",
    "score_motion_confidence",
    "score_eeg_confidence",
    "score_camera_confidence",
    "generate_day_forecast",
    "adapt_cue_tempo_step",
    "compute_cue_benefit_score",
    "compute_symptom_severity",
    "compute_freeze_index",
    "analyze_voice_sustained_vowel",
    "compute_nonmotor_check",
    "generate_gait_assessment_sample",
    "generate_oxford_voice_sample",
    "generate_nemar_eeg_sample"
]
