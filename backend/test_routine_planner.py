"""
Unit & Integration Test Suite for Move Coach Rule-Based Routine Planner
Tests:
1. Good Day (High Energy + ON Window) -> High-Amplitude Standing Routine
2. Bad Day (High Fatigue + OFF Window) -> Seated Gentle Mobility Routine
3. Missing / Unlogged Diary -> Baseline Standard Routine with Explicit Rationale
4. Pacing tempo linkage directly from Live Cue Designer winning cue
"""

from steady_ai import (
    generate_today_session_plan,
    CueType,
    SymptomSeverityTier,
    PostureMode
)

def test_routine_planner_synthetic_states():
    print("\n--- TESTING CUSTOMIZED DAILY ROUTINE GENERATOR ---")

    # 1. Good Day / High Energy / ON Window
    plan_good = generate_today_session_plan(
        winning_cue_type=CueType.AUDIO_BEAT,
        winning_tempo_bpm=92,
        energy_level="high",
        fatigue_level="mild",
        mood="great",
        sleep_quality="rested",
        response_curve_window="ON_OPTIMAL",
        severity_tier=SymptomSeverityTier.MILD
    )
    assert plan_good.routine_id == "standing_amplitude"
    assert plan_good.posture_mode == PostureMode.STANDING
    assert plan_good.target_reps_per_exercise >= 15
    assert plan_good.pacing_tempo_bpm == 92
    assert "LSVT BIG" in plan_good.rationale
    print("[PASSED] Good Day / High Energy -> High-Amplitude Standing Routine (LSVT BIG, 92 BPM)")

    # 2. Bad Day / Severe Fatigue / OFF Window
    plan_bad = generate_today_session_plan(
        winning_cue_type=CueType.VIBRATION_PULSE,
        winning_tempo_bpm=88,
        energy_level="low",
        fatigue_level="severe",
        mood="tough",
        sleep_quality="poor",
        response_curve_window="OFF_WINDOW",
        severity_tier=SymptomSeverityTier.HIGH
    )
    assert plan_bad.routine_id == "seated_gentle"
    assert plan_bad.posture_mode == PostureMode.SEATED
    assert plan_bad.target_reps_per_exercise == 8
    assert plan_bad.pacing_tempo_bpm == 84  # -4 BPM gentle pacing
    assert "Seated gentle routine" in plan_bad.rationale
    print("[PASSED] Bad Day / Severe Fatigue -> Seated Gentle Routine (8 reps, 84 BPM)")

    # 3. Unlogged Diary Fallback State
    plan_unlogged = generate_today_session_plan(
        winning_cue_type=CueType.VISUAL_FLASH,
        winning_tempo_bpm=80,
        energy_level=None,
        fatigue_level=None,
        mood=None,
        sleep_quality=None,
        response_curve_window="STEADY",
        severity_tier=SymptomSeverityTier.MILD
    )
    assert plan_unlogged.routine_id == "baseline_standard"
    assert plan_unlogged.diary_logged is False
    assert "Daily diary not yet logged today" in plan_unlogged.rationale
    assert plan_unlogged.pacing_tempo_bpm == 80
    print("[PASSED] Unlogged Diary -> Baseline Standard with explicit rationale")

    # 4. Moderate Midday Routine
    plan_mid = generate_today_session_plan(
        winning_cue_type=CueType.AUDIO_BEAT,
        winning_tempo_bpm=88,
        energy_level="medium",
        fatigue_level="moderate",
        mood="okay",
        sleep_quality="interrupted",
        response_curve_window="STEADY",
        severity_tier=SymptomSeverityTier.MODERATE
    )
    assert plan_mid.routine_id == "balanced_mobility"
    assert plan_mid.pacing_tempo_bpm == 88
    print("[PASSED] Moderate Day -> Daily Balanced Mobility Routine (88 BPM)")

    print("\nALL ROUTINE PLANNER SYNTHETIC STATE TESTS PASSED!\n")

if __name__ == "__main__":
    test_routine_planner_synthetic_states()
