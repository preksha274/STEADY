"""
Comprehensive Test Suite for STEADY AI & Signal Processing Modules
Validates:
1. Motion Feature Extraction (TremorScope & Gait)
2. EEG Band-Power & Data-Quality Artifacts
3. Pose Estimation & Move Coach Live Rules
4. Confidence & Data-Quality Scoring
5. Personal Response Curve & Day Forecast (with thin data handling)
6. Live Cue Designer Adaptation Loop & Fatigue Detection
7. Severity Meter Scoring ("Compared to your usual")
8. Freeze Index (Experimental power ratio)
9. Voice Loudness & Non-Motor Check
10. Benchmark Datasets (2025 Gait, Oxford Voice, NEMAR EEG)
"""

import math
import numpy as np
import pandas as pd


from steady_ai import (
    ConfidenceTier,
    QualityIssue,
    SymptomSeverityTier,
    CueType,
    MoveCoachFeedbackCode,
    extract_motion_features,
    extract_eeg_features,
    extract_pose_gait_features,
    evaluate_move_coach_rules,
    process_pose_stream_frame,
    score_motion_confidence,
    score_eeg_confidence,
    score_camera_confidence,
    generate_day_forecast,
    adapt_cue_tempo_step,
    compute_symptom_severity,
    compute_freeze_index,
    analyze_voice_sustained_vowel,
    compute_nonmotor_check,
    generate_gait_assessment_sample,
    generate_oxford_voice_sample,
    generate_nemar_eeg_sample,
    LandmarkPoint,
    PoseFrame,
    DerivedGaitFeatures
)


# ==========================================
# 1. Motion Feature Extraction (TremorScope)
# ==========================================

def test_motion_feature_extraction_tremor():
    df_tremor = generate_gait_assessment_sample(condition="pd_tremor", duration_s=10.0, sample_rate_hz=100.0)
    result = extract_motion_features(df_tremor, baseline_amplitude=0.20)

    # 4.8 Hz tremor check
    assert 4.5 <= result.metrics.tremor_frequency_hz <= 5.1
    assert result.metrics.tremor_amplitude > 0.10
    assert result.quality.duration_s >= 9.9
    assert result.confidence.tier in [ConfidenceTier.HIGH, ConfidenceTier.MEDIUM]
    assert result.baseline_deviation_pct is not None
    assert result.label == "Compared to your usual"
    print(f"Motion Tremor test passed: {result.metrics.tremor_frequency_hz} Hz, Amp: {result.metrics.tremor_amplitude}")


def test_motion_feature_extraction_healthy_gait():
    df_gait = generate_gait_assessment_sample(condition="healthy_control", duration_s=10.0, sample_rate_hz=100.0)
    result = extract_motion_features(df_gait)

    assert result.metrics.step_cadence_spm is not None
    # 1.8 Hz * 60 = ~108 SPM
    assert 95.0 <= result.metrics.step_cadence_spm <= 120.0
    assert result.metrics.step_regularity is not None and result.metrics.step_regularity > 0.70
    assert result.confidence.tier == ConfidenceTier.HIGH
    print(f"Motion Gait test passed: Cadence {result.metrics.step_cadence_spm} SPM, Regularity: {result.metrics.step_regularity}")


# ==========================================
# 2. EEG Band-Power & Artifact Extraction
# ==========================================

def test_eeg_clean_resting_state():
    df_eeg = generate_nemar_eeg_sample(condition="resting_state", duration_s=10.0, sample_rate_hz=250.0)
    result = extract_eeg_features(df_eeg)

    assert result.channel_count == 4
    assert result.band_powers.alpha.relative > 0.05
    assert result.band_powers.beta.relative > 0.05
    assert result.beta_band_power > 0
    assert not result.quality.line_noise_present
    assert result.confidence.tier == ConfidenceTier.HIGH
    print(f"EEG Clean test passed: Beta rel {result.band_powers.beta.relative}, Alpha rel {result.band_powers.alpha.relative}")


def test_eeg_mains_line_noise_detection():
    df_noisy = generate_nemar_eeg_sample(condition="noisy_mains", duration_s=10.0, sample_rate_hz=250.0)
    result = extract_eeg_features(df_noisy)

    assert result.quality.line_noise_present is True
    assert result.confidence.tier in [ConfidenceTier.MEDIUM, ConfidenceTier.LOW]
    print(f"EEG Line Noise test passed: Flagged line noise successfully with tier {result.confidence.tier}")


# ==========================================
# 3. Pose Estimation & Move Coach Rules
# ==========================================

def test_move_coach_rules_stand_taller():
    # Simulate slumped posture (trunk inclination = 18 deg)
    features = DerivedGaitFeatures(
        trunk_inclination_deg=18.5,
        left_arm_swing_deg=25.0,
        right_arm_swing_deg=24.0,
        arm_swing_asymmetry_pct=4.0,
        left_knee_flexion_deg=150.0,
        right_knee_flexion_deg=150.0,
        step_width_norm=0.25,
        movement_speed_norm=1.0
    )
    prompts = evaluate_move_coach_rules(features, target_tempo_bpm=88)
    codes = [p.code for p in prompts]
    assert MoveCoachFeedbackCode.STAND_TALLER in codes
    print(f"Pose Move Coach stand taller test passed: {codes}")


def test_move_coach_rules_bigger_reach():
    # Simulate reduced left arm swing (bradykinesia / hypometria)
    features = DerivedGaitFeatures(
        trunk_inclination_deg=6.0,
        left_arm_swing_deg=12.0,
        right_arm_swing_deg=32.0,
        arm_swing_asymmetry_pct=62.5,
        left_knee_flexion_deg=145.0,
        right_knee_flexion_deg=145.0,
        step_width_norm=0.25,
        movement_speed_norm=1.0
    )
    prompts = evaluate_move_coach_rules(features, target_tempo_bpm=88)
    codes = [p.code for p in prompts]
    assert MoveCoachFeedbackCode.BIGGER_REACH in codes
    assert MoveCoachFeedbackCode.SYMMETRIC_ARM_SWING in codes
    print(f"Pose Move Coach reach & symmetry test passed: {codes}")


def test_pose_frame_stream_processing():
    landmarks = [
        LandmarkPoint(id=11, name="LEFT_SHOULDER", x=0.45, y=0.30, z=0.0, visibility=0.95),
        LandmarkPoint(id=12, name="RIGHT_SHOULDER", x=0.55, y=0.30, z=0.0, visibility=0.95),
        LandmarkPoint(id=23, name="LEFT_HIP", x=0.46, y=0.60, z=0.0, visibility=0.95),
        LandmarkPoint(id=24, name="RIGHT_HIP", x=0.54, y=0.60, z=0.0, visibility=0.95),
    ]
    frame = PoseFrame(timestamp_s=1.5, landmarks=landmarks)
    output = process_pose_stream_frame(frame, target_tempo_bpm=88, measured_cadence_spm=88.0, current_rep=5)
    assert output.rep_count == 5
    assert output.beat_sync_pct == 100.0
    assert output.confidence.tier == ConfidenceTier.HIGH
    print(f"Pose stream frame test passed: sync {output.beat_sync_pct}%")


# ==========================================
# 4. Confidence & Data-Quality Scoring
# ==========================================

def test_confidence_scoring_tiers():
    # Motion
    c_motion_good = score_motion_confidence(duration_s=15.0, variability=0.8, missing_samples_pct=0.5)
    assert c_motion_good.tier == ConfidenceTier.HIGH
    c_motion_short = score_motion_confidence(duration_s=3.0, variability=0.8)
    assert c_motion_short.tier == ConfidenceTier.LOW
    assert c_motion_short.primary_issue == QualityIssue.SHORT_DURATION

    # Camera
    c_cam_good = score_camera_confidence(mean_landmark_visibility=0.90, occluded_frame_pct=2.0, fps=30.0, total_frames=60)
    assert c_cam_good.tier == ConfidenceTier.HIGH
    c_cam_bad = score_camera_confidence(mean_landmark_visibility=0.35, occluded_frame_pct=50.0, fps=25.0, total_frames=60)
    assert c_cam_bad.tier == ConfidenceTier.LOW
    assert c_cam_bad.primary_issue == QualityIssue.LOW_VISIBILITY_OR_OCCLUSION
    print("Confidence scoring tiers test passed")


# ==========================================
# 5. Personal Response Curve & Day Forecast
# ==========================================

def test_day_forecast_thin_data_handling():
    # < 3 sessions -> explicit not enough data state
    output = generate_day_forecast(
        historical_sessions_count=1,
        medication_doses_today=[8.0, 13.0, 18.0]
    )
    assert output.has_sufficient_data is False
    assert output.best_window is None
    assert output.confidence.tier == ConfidenceTier.LOW
    assert output.confidence.primary_issue == QualityIssue.INSUFFICIENT_HISTORY
    print("Forecast thin-data test passed: Correctly blocked silent guessing")


def test_day_forecast_with_history():
    # 12 sessions -> full 24h prediction with tight uncertainty bounds
    output = generate_day_forecast(
        historical_sessions_count=12,
        medication_doses_today=[7.5, 12.5, 17.5],
        current_hour=9.0,
        mood_rating_1_5=4,
        fatigue_rating_1_5=2,
        sleep_rating_1_5=4
    )
    assert output.has_sufficient_data is True
    assert output.best_window is not None
    assert len(output.timeline) == 15  # 7 AM to 9 PM
    assert output.confidence.tier == ConfidenceTier.HIGH
    # All timeline points must have uncertainty bands
    for p in output.timeline:
        assert p.uncertainty_lower <= p.predicted_mobility_score <= p.uncertainty_upper
    print(f"Forecast full history test passed: Best window {output.best_window.window_label}")


# ==========================================
# 6. Live Cue Designer Adaptation Loop
# ==========================================

def test_cue_adaptation_tempo_hill_climb():
    # User is walking at 92 SPM with metronome at 88 BPM -> nudge up by +2 BPM
    step_out = adapt_cue_tempo_step(
        current_cue_type=CueType.AUDIO_BEAT,
        current_tempo_bpm=88,
        measured_cadence_spm=92.0,
        current_sync_pct=82.0,
        current_stride_smoothness=0.88
    )
    assert step_out.suggested_tempo_bpm == 90
    assert step_out.cue_fatigue_detected is False
    print(f"Cue adaptation hill-climb test passed: Nudged from 88 to {step_out.suggested_tempo_bpm} BPM")


def test_cue_fatigue_detection_and_rotation():
    # Sync dropped severely across consecutive steps
    step_out = adapt_cue_tempo_step(
        current_cue_type=CueType.AUDIO_BEAT,
        current_tempo_bpm=88,
        measured_cadence_spm=88.0,
        current_sync_pct=64.0,
        current_stride_smoothness=0.50,
        sync_history_last_5_steps=[92.0, 88.0, 79.0]
    )
    assert step_out.cue_fatigue_detected is True
    assert step_out.recommended_rotation == CueType.VIBRATION_PULSE
    print(f"Cue fatigue test passed: Flagged habituation, recommended rotation to {step_out.recommended_rotation}")


# ==========================================
# 7. Severity Meter Scoring
# ==========================================

def test_severity_meter_scoring():
    # Resting Tremor: patient rated 2, deviation is +5% -> Mild/Moderate
    res = compute_symptom_severity(
        symptom_name="Resting Tremor",
        patient_rating_1_5=2,
        current_metric_value=0.21,
        baseline_metric_value=0.20
    )
    assert res.comparison_text == "Compared to your usual"
    assert res.computed_tier in [SymptomSeverityTier.MILD, SymptomSeverityTier.MODERATE]
    assert res.baseline_deviation_pct == 5.0
    print(f"Severity meter test passed: {res.symptom_name} -> {res.tier_label}")


# ==========================================
# 8. Freeze Index (Experimental)
# ==========================================

def test_freeze_index_calculation():
    # PD freeze sample with high 3-8Hz power
    df_freeze = generate_gait_assessment_sample(condition="pd_freeze", duration_s=8.0)
    res = compute_freeze_index(df_freeze)

    assert res.is_experimental is True
    assert "experimental" in res.disclaimer.lower()
    assert "i'm frozen" in res.disclaimer.lower()
    assert res.freeze_index_ratio > 0
    print(f"Freeze Index test passed: FI={res.freeze_index_ratio}, Risk={res.freeze_risk_tier.value}")


# ==========================================
# 9. Voice Loudness & Non-Motor Check
# ==========================================

def test_voice_loudness_analysis():
    audio_sample = generate_oxford_voice_sample(is_hypophonia=False, duration_s=3.0)
    res = analyze_voice_sustained_vowel(audio_sample, sample_rate_hz=44100)

    assert -30.0 <= res.rms_dbfs <= 0.0
    assert res.duration_s >= 2.9
    assert res.pitch_stability_pct > 70.0
    assert "not a diagnostic" in res.disclaimer.lower()
    assert res.confidence.tier == ConfidenceTier.HIGH
    print(f"Voice loudness test passed: {res.rms_dbfs} dBFS, Stability {res.pitch_stability_pct}%")


def test_nonmotor_check_aggregation():
    res = compute_nonmotor_check(
        pain_score_1_5=2,
        fatigue_score_1_5=3,
        anxiety_score_1_5=2,
        sleep_score_1_5=4
    )
    assert res.comparison_text == "Compared to your usual"
    assert 1.0 <= res.composite_nonmotor_index <= 5.0
    assert res.confidence.tier == ConfidenceTier.HIGH
    print(f"Non-motor check test passed: Composite index {res.composite_nonmotor_index}")


if __name__ == "__main__":
    print("\n--- RUNNING STEADY AI TEST SUITE ---")
    test_motion_feature_extraction_tremor()
    test_motion_feature_extraction_healthy_gait()
    test_eeg_clean_resting_state()
    test_eeg_mains_line_noise_detection()
    test_move_coach_rules_stand_taller()
    test_move_coach_rules_bigger_reach()
    test_pose_frame_stream_processing()
    test_confidence_scoring_tiers()
    test_day_forecast_thin_data_handling()
    test_day_forecast_with_history()
    test_cue_adaptation_tempo_hill_climb()
    test_cue_fatigue_detection_and_rotation()
    test_severity_meter_scoring()
    test_freeze_index_calculation()
    test_voice_loudness_analysis()
    test_nonmotor_check_aggregation()
    print("\n==========================================")
    print("ALL 10 STEADY AI MODULES & TESTS PASSED!")
    print("==========================================")
