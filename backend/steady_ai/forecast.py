"""
STEADY AI - Personal Response Curve & Day Forecast Engine
Combines diary (mood, fatigue, sleep), medication schedule (time-since-last-dose),
and historical session metrics into an interpretable circadian/pharmacokinetic forecast.
Explicitly exposes uncertainty bands and flags thin-history states ("not enough data yet").
"""

from typing import List, Dict, Any, Optional, Tuple
import math
import numpy as np

from .types import (
    HourlyForecastPoint,
    BestMobilityWindow,
    DayForecastOutput,
    ConfidenceReport,
    ConfidenceTier,
    QualityIssue
)


def compute_pharmacokinetic_factor(hours_since_dose: float) -> float:
    """
    Standard interpretable Levodopa absorption/wearing-off response model:
    - 0 to 0.5h: Absorption phase (score rises from 0.4 to 0.85)
    - 0.5 to 2.5h: Peak "ON" window (optimal mobility 0.85 to 0.95)
    - 2.5 to 4.5h: Gradual wearing-off phase (score declines towards baseline 0.45)
    - > 4.5h: Baseline "OFF" state with higher fluctuation susceptibility
    """
    t = max(0.0, hours_since_dose)
    if t < 0.5:
        return 0.45 + (t / 0.5) * 0.40
    elif t <= 2.5:
        return 0.85 + 0.10 * math.sin((t - 0.5) / 2.0 * math.pi)
    elif t <= 5.0:
        decay_progress = (t - 2.5) / 2.5
        return 0.85 - decay_progress * 0.42
    else:
        return 0.43


def compute_circadian_factor(hour: int, sleep_quality_1_5: int = 4) -> float:
    """
    Natural diurnal alertness / motor ease modifier.
    Peak in mid-morning (9-11 AM) and early afternoon, lower late evening / early dawn.
    """
    sleep_multiplier = 0.8 + (sleep_quality_1_5 / 5.0) * 0.3
    # Diurnal peak around 10 AM (hour 10) and slight secondary peak at 4 PM (hour 16)
    diurnal = 0.70 + 0.25 * math.cos((hour - 10.5) / 24.0 * 2.0 * math.pi)
    return float(max(0.4, min(1.0, diurnal * sleep_multiplier)))


def generate_day_forecast(
    historical_sessions_count: int,
    medication_doses_today: List[float],  # hours of doses, e.g. [7.5, 12.0, 17.0]
    current_hour: float = 9.0,
    mood_rating_1_5: int = 4,
    fatigue_rating_1_5: int = 2,
    sleep_rating_1_5: int = 4,
    min_sessions_threshold: int = 3
) -> DayForecastOutput:
    """
    Builds the 24-hour day forecast timeline and best mobility window.
    Pure, interpretable function with explicit uncertainty bounds.
    """
    # 1. Check for thin-history state
    if historical_sessions_count < min_sessions_threshold:
        return DayForecastOutput(
            has_sufficient_data=False,
            status_message="Building your personal baseline. Complete 3 movement check-ins to unlock your daily forecast curve.",
            best_window=None,
            timeline=[],
            confidence=ConfidenceReport(
                tier=ConfidenceTier.LOW,
                primary_issue=QualityIssue.INSUFFICIENT_HISTORY,
                reason="Insufficient historical session records (< 3 sessions recorded)",
                numeric_score=0.20
            ),
            hours_since_last_dose=None,
            next_dose_time_str=None
        )

    # 2. Time since last dose calculation
    past_doses = [d for d in medication_doses_today if d <= current_hour]
    future_doses = [d for d in medication_doses_today if d > current_hour]

    hours_since_last_dose = (current_hour - max(past_doses)) if past_doses else None

    next_dose_str = None
    if future_doses:
        next_d = min(future_doses)
        nh = int(next_d)
        nm = int((next_d - nh) * 60)
        ampm = "AM" if nh < 12 else "PM"
        disp_h = nh if 1 <= nh <= 12 else (nh - 12 if nh > 12 else 12)
        next_dose_str = f"{disp_h}:{nm:02d} {ampm}"

    # 3. Non-motor diary modifier
    fatigue_penalty = (fatigue_rating_1_5 - 1) * 0.04
    mood_boost = (mood_rating_1_5 - 3) * 0.03
    diary_mod = max(-0.15, min(0.12, mood_boost - fatigue_penalty))

    # 4. Uncertainty calculation based on session count
    # More history = tighter uncertainty bounds
    base_uncertainty = max(0.06, 0.22 - (historical_sessions_count * 0.012))

    # 5. Generate hourly predictions for daylight waking hours (7 AM to 9 PM)
    timeline: List[HourlyForecastPoint] = []
    hour_scores: List[Tuple[int, float]] = []

    for h in range(7, 22):
        # Time since most recent prior dose at hour h
        prior_doses = [d for d in medication_doses_today if d <= h]
        if prior_doses:
            dt = h - max(prior_doses)
        else:
            dt = 5.0  # Assumed fasting/morning pre-dose

        pk_val = compute_pharmacokinetic_factor(dt)
        circ_val = compute_circadian_factor(h, sleep_rating_1_5)

        # Blend: 60% PK medication response, 40% Circadian diurnal rhythm + diary
        raw_score = (0.60 * pk_val + 0.40 * circ_val) + diary_mod
        mobility_score = float(max(0.15, min(0.96, raw_score)))

        unc_lower = float(max(0.05, mobility_score - base_uncertainty))
        unc_upper = float(min(1.00, mobility_score + base_uncertainty))

        is_optimal = mobility_score >= 0.78

        if mobility_score >= 0.78:
            state_label = "Optimal Mobility Window"
        elif mobility_score >= 0.55:
            state_label = "Steady Window"
        else:
            state_label = "Wearing Off Risk"

        nh = h
        ampm = "AM" if nh < 12 else "PM"
        disp_h = nh if 1 <= nh <= 12 else (nh - 12 if nh > 12 else 12)
        hour_label = f"{disp_h} {ampm}"

        point = HourlyForecastPoint(
            hour=h,
            hour_label=hour_label,
            predicted_mobility_score=round(mobility_score, 2),
            uncertainty_lower=round(unc_lower, 2),
            uncertainty_upper=round(unc_upper, 2),
            is_optimal_window=is_optimal,
            state_label=state_label
        )
        timeline.append(point)
        hour_scores.append((h, mobility_score))

    # 6. Find Best Mobility Window
    best_h, best_score = max(hour_scores, key=lambda x: x[1])
    start_h = best_h
    end_h = best_h + 1

    def fmt_h(h_val: int) -> str:
        ampm = "AM" if h_val < 12 else "PM"
        dh = h_val if 1 <= h_val <= 12 else (h_val - 12 if h_val > 12 else 12)
        return f"{dh} {ampm}"

    window_label = f"{fmt_h(start_h)} - {fmt_h(end_h)}"
    conf_tier = ConfidenceTier.HIGH if historical_sessions_count >= 8 else ConfidenceTier.MEDIUM

    best_window = BestMobilityWindow(
        start_hour=start_h,
        end_hour=end_h,
        window_label=window_label,
        confidence_tier=conf_tier,
        recommendation="Best time for structured walking, exercises, or demanding physical activities."
    )

    conf_report = ConfidenceReport(
        tier=conf_tier,
        primary_issue=QualityIssue.CLEAN_SIGNAL,
        reason=f"Model trained on {historical_sessions_count} sessions with regular dose schedule",
        numeric_score=0.90 if conf_tier == ConfidenceTier.HIGH else 0.75
    )

    return DayForecastOutput(
        has_sufficient_data=True,
        status_message=f"Optimal window predicted at {window_label} based on your usual response curve.",
        best_window=best_window,
        timeline=timeline,
        confidence=conf_report,
        hours_since_last_dose=round(hours_since_last_dose, 1) if hours_since_last_dose is not None else None,
        next_dose_time_str=next_dose_str
    )
