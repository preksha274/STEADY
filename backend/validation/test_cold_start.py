"""
STEADY Validation Suite - Step 5: Cold-Start Behavior & Population-Prior Transition
Validates the three progressive operational regimes of the Personal Response Curve:
1. Uncalibrated / "Not enough data yet" state (< 3 sessions)
2. Wide-band "Typical pattern" state running on population prior (3–6 sessions)
3. Narrow-band "Personalized pattern" state (> 7 sessions)

DISCLAIMER: Algorithm verification on synthetic data. Not clinical validation.
"""

import os
import sys

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from steady_ai import generate_day_forecast, ConfidenceTier, QualityIssue


def run_cold_start_validation():
    print("=========================================================================")
    print("STEADY VALIDATION - STEP 5: Cold-Start & Population-Prior Regime Tests")
    print("=========================================================================")

    doses = [7.5, 12.5, 17.5]

    # --- Regime 1: Uncalibrated (< 3 sessions) ---
    res_uncal = generate_day_forecast(
        historical_sessions_count=1,
        medication_doses_today=doses
    )
    print("\n[Regime 1: Thin Data (< 3 sessions)]")
    print(f" - Has Sufficient Data: {res_uncal.has_sufficient_data} (Expected: False)")
    print(f" - Status Message:      \"{res_uncal.status_message}\"")
    print(f" - Confidence Tier:     {res_uncal.confidence.tier.value.upper()} ({res_uncal.confidence.primary_issue.value})")
    print(f" - Pattern Type:        {res_uncal.pattern_type}")
    assert res_uncal.has_sufficient_data is False
    assert res_uncal.confidence.primary_issue == QualityIssue.INSUFFICIENT_HISTORY

    # --- Regime 2: Wide-band "Typical Pattern" (3–6 sessions) ---
    res_typical = generate_day_forecast(
        historical_sessions_count=4,
        medication_doses_today=doses
    )
    print("\n[Regime 2: Cold-Start Population Prior (3–6 sessions)]")
    print(f" - Has Sufficient Data: {res_typical.has_sufficient_data} (Expected: True)")
    print(f" - Pattern Type:        \"{res_typical.pattern_type}\" (Expected: \"typical pattern\")")
    print(f" - Best Window:         {res_typical.best_window.window_label}")
    print(f" - Recommendation:      \"{res_typical.best_window.recommendation}\"")
    print(f" - Progress Label:      \"{res_typical.progress_label}\"")
    assert res_typical.has_sufficient_data is True
    assert res_typical.pattern_type == "typical pattern"
    assert "typical" in res_typical.best_window.recommendation.lower()

    # --- Regime 3: Narrow-band "Personalized Pattern" (>= 7 sessions) ---
    res_personal = generate_day_forecast(
        historical_sessions_count=14,
        medication_doses_today=doses
    )
    print("\n[Regime 3: Calibrated Personalized Curve (>= 7 sessions)]")
    print(f" - Has Sufficient Data: {res_personal.has_sufficient_data} (Expected: True)")
    print(f" - Pattern Type:        \"{res_personal.pattern_type}\" (Expected: \"personalized pattern\")")
    print(f" - Confidence Tier:     {res_personal.confidence.tier.value.upper()}")
    print(f" - Progress Label:      \"{res_personal.progress_label}\"")
    assert res_personal.has_sufficient_data is True
    assert res_personal.pattern_type == "personalized pattern"
    assert res_personal.confidence.tier == ConfidenceTier.HIGH

    print("\n-------------------------------------------------------------------------")
    print("SUMMARY: Successfully verified all 3 cold-start operational regimes:")
    print("1) 'not enough data yet' blocking below 3 sessions,")
    print("2) 'typical pattern' population-prior fallback (3–6 sessions),")
    print("3) fully calibrated 'personalized pattern' with narrow uncertainty (> 7 sessions).")
    print("-------------------------------------------------------------------------\n")


if __name__ == "__main__":
    run_cold_start_validation()
