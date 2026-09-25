"""
STEADY AI - Customized Daily Exercise Routine Generator (Rule-Based Engine)
Generates an explainable, transparent "Today's Session Plan" for Move Coach
grounded in Parkinson's disease therapeutic principles (LSVT BIG amplitude & rhythmic cueing).

Deterministic, transparent rule table — zero black-box ML.
Clinician reviewable framing.
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field

from .types import CueType, SymptomSeverityTier


class PostureMode(str, Enum):
    STANDING = "standing"
    SEATED = "seated"
    MIXED = "mixed"


class PlannedExercise(BaseModel):
    id: str
    name: str
    category: str
    target_benefit: str
    description: str
    posture: PostureMode
    target_reps: int


class TodaySessionPlan(BaseModel):
    routine_id: str
    routine_title: str
    posture_mode: PostureMode
    selected_exercises: List[PlannedExercise]
    target_reps_per_exercise: int
    target_rounds: int
    pacing_tempo_bpm: int
    pacing_cue_type: CueType
    rationale: str
    diary_logged: bool
    input_summary: Dict[str, Any]
    fatigue_shrink_threshold_pct: float = 25.0  # Stop if amplitude shrinks > 25%


# ==============================================================================
# CORE 5 EXERCISE LIBRARY DEFINITIONS (PD-APPROPRIATE PRINCIPLES)
# ==============================================================================

EXERCISE_LIBRARY: Dict[str, PlannedExercise] = {
    "big_reach": PlannedExercise(
        id="big_reach",
        name="Big Overhead & Lateral Reach",
        category="Amplitude (LSVT BIG)",
        target_benefit="Bradykinesia & Micro-movement reduction",
        description="Extend both arms as high and wide as possible on the metronome beat.",
        posture=PostureMode.STANDING,
        target_reps=15
    ),
    "high_knees": PlannedExercise(
        id="high_knees",
        name="High Marching & Step Clearance",
        category="Gait & Stride",
        target_benefit="Freezing of Gait (FOG) prevention",
        description="March in place lifting each knee toward hip level to ensure foot clearance.",
        posture=PostureMode.STANDING,
        target_reps=20
    ),
    "torso_twist": PlannedExercise(
        id="torso_twist",
        name="Axial Torso & Trunk Rotation",
        category="Axial Mobility",
        target_benefit="Reduces core rigidity & helps turning",
        description="Seated or standing, rotate your shoulders and head smoothly side-to-side.",
        posture=PostureMode.SEATED,
        target_reps=16
    ),
    "sit_to_stand": PlannedExercise(
        id="sit_to_stand",
        name="Sit-to-Stand Chair Transfers",
        category="Functional Strength",
        target_benefit="Safe chair transfers & leg power",
        description="Push through heels to rise to full standing posture, then lower with control.",
        posture=PostureMode.MIXED,
        target_reps=10
    ),
    "heel_toe_rock": PlannedExercise(
        id="heel_toe_rock",
        name="Heel-to-Toe Rocking Balance",
        category="Dynamic Balance",
        target_benefit="Ankle flexibility & center-of-mass control",
        description="Rock smoothly from heels to toes in sync with the sensory cue pulse.",
        posture=PostureMode.STANDING,
        target_reps=18
    ),
    "posture_reset": PlannedExercise(
        id="posture_reset",
        name="Posture Reset & Scapular Squeeze",
        category="Postural Stability",
        target_benefit="Corrects forward stoop (camptocormia)",
        description="Draw shoulder blades back and down while aligning chin over breastbone.",
        posture=PostureMode.SEATED,
        target_reps=12
    ),
    "lateral_step": PlannedExercise(
        id="lateral_step",
        name="Lateral Clock Stepping",
        category="Agility & Stepping",
        target_benefit="Multi-directional stepping & fall protection",
        description="Step out wide to 3 o'clock and 9 o'clock positions and return to center.",
        posture=PostureMode.STANDING,
        target_reps=14
    ),
}


# ==============================================================================
# RULE TABLE: INPUT THRESHOLDS & DETERMINISTIC SELECTION LOGIC
# ==============================================================================
# | Condition                        | Routine Type       | Reps | Tempo Delta | Posture  |
# |----------------------------------|--------------------|------|-------------|----------|
# | High fatigue / Low energy / OFF  | Seated Gentle      | 8–10 | -4 BPM      | Seated   |
# | High energy / Low fatigue / ON   | Standing Amplitude | 18–20| 0 BPM (As-Is| Standing |
# | Moderate energy / Steady window  | Balanced Mobility  | 12–14| 0 BPM       | Mixed    |
# | Missing Diary (Not logged yet)   | Baseline Standard  | 12   | 0 BPM       | Mixed    |
# ==============================================================================

def generate_today_session_plan(
    winning_cue_type: CueType = CueType.AUDIO_BEAT,
    winning_tempo_bpm: int = 88,
    energy_level: Optional[str] = None,       # "low" | "medium" | "high" | None
    fatigue_level: Optional[str] = None,      # "mild" | "moderate" | "severe" | None
    mood: Optional[str] = None,               # "great" | "okay" | "tough" | None
    sleep_quality: Optional[str] = None,      # "rested" | "interrupted" | "poor" | None
    response_curve_window: str = "STEADY",    # "ON_OPTIMAL" | "STEADY" | "WEARING_OFF" | "OFF_WINDOW"
    severity_tier: SymptomSeverityTier = SymptomSeverityTier.MILD
) -> TodaySessionPlan:
    """
    Evaluates transparent rule table and produces today's customized session plan.
    """
    diary_logged = any(v is not None for v in [energy_level, fatigue_level, mood, sleep_quality])

    input_summary = {
        "energy_level": energy_level or "unreported",
        "fatigue_level": fatigue_level or "unreported",
        "mood": mood or "unreported",
        "sleep_quality": sleep_quality or "unreported",
        "response_curve_window": response_curve_window,
        "severity_tier": severity_tier.value,
        "winning_cue_type": winning_cue_type.value,
        "winning_tempo_bpm": winning_tempo_bpm,
    }

    # Normalize inputs
    is_low_energy = energy_level == "low"
    is_high_energy = energy_level == "high"
    is_severe_fatigue = fatigue_level in ["severe", "high"]
    is_mild_fatigue = fatigue_level in ["mild", "none", "low"]
    is_off_window = response_curve_window in ["WEARING_OFF", "OFF_WINDOW"]
    is_on_optimal = response_curve_window == "ON_OPTIMAL"
    is_high_severity = severity_tier == SymptomSeverityTier.HIGH

    # -------------------------------------------------------------------------
    # RULE 1: BAD-DAY / HIGH FATIGUE / WEARING-OFF AUTO-SWITCH TO SEATED GENTLE
    # -------------------------------------------------------------------------
    if (is_severe_fatigue or is_low_energy or is_high_severity) and (is_off_window or is_low_energy):
        selected = [
            EXERCISE_LIBRARY["torso_twist"],
            EXERCISE_LIBRARY["posture_reset"],
            EXERCISE_LIBRARY["sit_to_stand"]
        ]
        target_reps = 8
        target_rounds = 1
        adjusted_tempo = max(60, winning_tempo_bpm - 4)
        
        rationale = (
            f"Seated gentle routine auto-selected: reported {fatigue_level or 'high'} fatigue "
            f"and current {response_curve_window.replace('_', ' ').lower()} window. "
            f"Preserves energy while maintaining axial spinal mobility and posture."
        )

        return TodaySessionPlan(
            routine_id="seated_gentle",
            routine_title="Seated Gentle Mobility Routine",
            posture_mode=PostureMode.SEATED,
            selected_exercises=selected,
            target_reps_per_exercise=target_reps,
            target_rounds=target_rounds,
            pacing_tempo_bpm=adjusted_tempo,
            pacing_cue_type=winning_cue_type,
            rationale=rationale,
            diary_logged=diary_logged,
            input_summary=input_summary,
            fatigue_shrink_threshold_pct=20.0
        )

    # -------------------------------------------------------------------------
    # RULE 2: GOOD-DAY / HIGH ENERGY / ON-OPTIMAL FULL STANDING AMPLITUDE
    # -------------------------------------------------------------------------
    if (is_high_energy or is_on_optimal) and not is_severe_fatigue and not is_high_severity:
        selected = [
            EXERCISE_LIBRARY["big_reach"],
            EXERCISE_LIBRARY["high_knees"],
            EXERCISE_LIBRARY["lateral_step"],
            EXERCISE_LIBRARY["sit_to_stand"]
        ]
        target_reps = 18
        target_rounds = 2

        rationale = (
            f"Full standing amplitude routine (LSVT BIG principles) selected during your "
            f"optimal ON medication window. High energy allows maximal reach span and stride height."
        )

        return TodaySessionPlan(
            routine_id="standing_amplitude",
            routine_title="High-Amplitude Standing Routine (LSVT BIG)",
            posture_mode=PostureMode.STANDING,
            selected_exercises=selected,
            target_reps_per_exercise=target_reps,
            target_rounds=target_rounds,
            pacing_tempo_bpm=winning_tempo_bpm,
            pacing_cue_type=winning_cue_type,
            rationale=rationale,
            diary_logged=diary_logged,
            input_summary=input_summary,
            fatigue_shrink_threshold_pct=25.0
        )

    # -------------------------------------------------------------------------
    # RULE 3: UNLOGGED DIARY FALLBACK (EXPLICIT TRANSPARENT STATE)
    # -------------------------------------------------------------------------
    if not diary_logged:
        selected = [
            EXERCISE_LIBRARY["big_reach"],
            EXERCISE_LIBRARY["high_knees"],
            EXERCISE_LIBRARY["sit_to_stand"],
            EXERCISE_LIBRARY["torso_twist"]
        ]
        target_reps = 12
        target_rounds = 1

        rationale = (
            f"Standard balanced routine calibrated to your {winning_tempo_bpm} BPM {winning_cue_type.value} cue. "
            f"(Daily diary not yet logged today — using safe default baseline)."
        )

        return TodaySessionPlan(
            routine_id="baseline_standard",
            routine_title="Balanced Movement Baseline",
            posture_mode=PostureMode.MIXED,
            selected_exercises=selected,
            target_reps_per_exercise=target_reps,
            target_rounds=target_rounds,
            pacing_tempo_bpm=winning_tempo_bpm,
            pacing_cue_type=winning_cue_type,
            rationale=rationale,
            diary_logged=False,
            input_summary=input_summary,
            fatigue_shrink_threshold_pct=25.0
        )

    # -------------------------------------------------------------------------
    # RULE 4: MODERATE / BALANCED MIDDAY MOBILITY ROUTINE
    # -------------------------------------------------------------------------
    selected = [
        EXERCISE_LIBRARY["big_reach"],
        EXERCISE_LIBRARY["high_knees"],
        EXERCISE_LIBRARY["sit_to_stand"],
        EXERCISE_LIBRARY["posture_reset"]
    ]
    target_reps = 12
    target_rounds = 1

    rationale = (
        f"Balanced mobility routine matched to your steady midday state and "
        f"{winning_tempo_bpm} BPM {winning_cue_type.value} rhythm."
    )

    return TodaySessionPlan(
        routine_id="balanced_mobility",
        routine_title="Daily Balanced Mobility Routine",
        posture_mode=PostureMode.MIXED,
        selected_exercises=selected,
        target_reps_per_exercise=target_reps,
        target_rounds=target_rounds,
        pacing_tempo_bpm=winning_tempo_bpm,
        pacing_cue_type=winning_cue_type,
        rationale=rationale,
        diary_logged=True,
        input_summary=input_summary,
        fatigue_shrink_threshold_pct=25.0
    )
