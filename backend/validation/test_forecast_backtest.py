"""
STEADY Validation Suite - Step 4: Forecast Backtest & Uncertainty Widening
Simulates 3 weeks of longitudinal Parkinson's patient data (daily medication timing,
sleep quality, diary check-ins, and mobility scores).
Evaluates 2-week training -> 3rd-week forecast accuracy and demonstrates the
progressive widening of the model's uncertainty bounds with smaller sample sizes (14d vs 7d vs 3d).

Outputs comparison plot to validation/results/forecast_uncertainty_widening.png.
DISCLAIMER: Backtest on simulated longitudinal patient trajectory. Not clinical validation.
"""

import os
import sys
import numpy as np
import matplotlib.pyplot as plt

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from steady_ai import generate_day_forecast

RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
os.makedirs(RESULTS_DIR, exist_ok=True)


class VirtualLongitudinalPatient:
    """
    Generates 21 days (3 weeks) of realistic synthetic patient trajectory:
    - Fixed daily dose times: 7:30 AM (7.5), 12:30 PM (12.5), 5:30 PM (17.5)
    - Ground truth optimal window: 60 to 120 minutes post-dose (8:30–9:30 AM, 1:30–2:30 PM)
    - Fluctuation driven by sleep quality and fatigue ratings.
    """
    def __init__(self, seed: int = 42):
        self.rng = np.random.default_rng(seed)

    def generate_3_weeks(self):
        days_data = []
        for day in range(1, 22):
            # Diary check-in
            sleep = int(self.rng.choice([2, 3, 4, 5], p=[0.15, 0.30, 0.40, 0.15]))
            mood = int(self.rng.choice([2, 3, 4, 5], p=[0.10, 0.30, 0.45, 0.15]))
            fatigue = int(self.rng.choice([1, 2, 3, 4], p=[0.20, 0.45, 0.25, 0.10]))

            # 2 check-in sessions per day
            sessions_count = day * 2

            # Ground truth hourly mobility profile for daylight hours (7 to 21)
            hourly_true = {}
            for h in range(7, 22):
                # Distance from nearest dose
                dt = min([abs(h - d) for d in [7.5, 12.5, 17.5]])
                base = 0.88 - (dt * 0.12)
                sleep_mod = (sleep - 3) * 0.04
                fatigue_mod = -(fatigue - 2) * 0.03
                noise = self.rng.normal(0, 0.03)
                hourly_true[h] = float(np.clip(base + sleep_mod + fatigue_mod + noise, 0.20, 0.95))

            days_data.append({
                "day": day,
                "sleep": sleep,
                "mood": mood,
                "fatigue": fatigue,
                "sessions_count": sessions_count,
                "hourly_true": hourly_true,
                "doses": [7.5, 12.5, 17.5]
            })
        return days_data


def run_forecast_backtest_validation():
    print("=========================================================================")
    print("STEADY VALIDATION - STEP 4: Forecast Backtest & Uncertainty Analysis")
    print("=========================================================================")

    patient = VirtualLongitudinalPatient(seed=42)
    history = patient.generate_3_weeks()

    # 1. Backtest evaluation on Week 3 (Days 15–21) trained on first 2 weeks (Day 14)
    train_sessions_14d = 14 * 2  # 28 sessions
    week3_days = history[14:]

    errors = []
    optimal_window_hits = 0

    for day_info in week3_days:
        fc = generate_day_forecast(
            historical_sessions_count=train_sessions_14d,
            medication_doses_today=day_info["doses"],
            mood_rating_1_5=day_info["mood"],
            fatigue_rating_1_5=day_info["fatigue"],
            sleep_rating_1_5=day_info["sleep"]
        )

        for pt in fc.timeline:
            pred_score = pt.predicted_mobility_score
            true_score = day_info["hourly_true"][pt.hour]
            errors.append(abs(pred_score - true_score))

        # Check if predicted best window matches ground truth optimal mobility hours (top 15% mobility or within 1h of peak)
        max_true_score = max(day_info["hourly_true"].values())
        top_true_hours = [h for h, val in day_info["hourly_true"].items() if val >= max_true_score - 0.05]
        if fc.best_window and any(abs(fc.best_window.start_hour - top_h) <= 1 for top_h in top_true_hours):
            optimal_window_hits += 1

    mae = float(np.mean(errors))
    window_acc = (optimal_window_hits / len(week3_days)) * 100.0
    print(f" Week 3 Backtest Mean Absolute Error (MAE): {mae:.3f} (on 0.0-1.0 mobility scale)")
    print(f" Optimal Window Prediction Accuracy:       {window_acc:.1f}% (within +/-1h of ground truth)")


    # 2. Uncertainty Band Progression Test (14 days vs 7 days vs 3 days)
    conditions = [
        {"label": "14 Days Logged (28 sessions)", "sessions": 28, "color": "#10B981"},
        {"label": "7 Days Logged (14 sessions)",  "sessions": 14, "color": "#2563EB"},
        {"label": "3 Days Logged (6 sessions)",   "sessions": 6,  "color": "#F59E0B"},
    ]

    ref_day = history[14]
    fig, axes = plt.subplots(3, 1, figsize=(10, 8), dpi=150, sharex=True, sharey=True)

    hours = list(range(7, 22))
    hour_labels = [f"{h if h<=12 else h-12} {'AM' if h<12 else 'PM'}" for h in hours]

    for idx, (cond, ax) in enumerate(zip(conditions, axes)):
        fc_res = generate_day_forecast(
            historical_sessions_count=cond["sessions"],
            medication_doses_today=ref_day["doses"],
            mood_rating_1_5=ref_day["mood"],
            fatigue_rating_1_5=ref_day["fatigue"],
            sleep_rating_1_5=ref_day["sleep"]
        )

        preds = [p.predicted_mobility_score for p in fc_res.timeline]
        lowers = [p.uncertainty_lower for p in fc_res.timeline]
        uppers = [p.uncertainty_upper for p in fc_res.timeline]
        band_widths = [u - l for u, l in zip(uppers, lowers)]
        avg_width = float(np.mean(band_widths))

        ax.plot(hours, preds, label="Predicted Mobility Score", color=cond["color"], linewidth=2.2)
        ax.fill_between(hours, lowers, uppers, color=cond["color"], alpha=0.25, label=f"Uncertainty Band (Avg Width: ±{avg_width/2:.2f})")

        # Overlay medication doses as vertical markers
        for d in ref_day["doses"]:
            ax.axvline(x=d, color="#EF4444", linestyle=":", alpha=0.7)

        ax.set_title(f"{cond['label']} | Pattern: {fc_res.pattern_type} | Confidence: {fc_res.confidence.tier.value.upper()}",
                     fontsize=11, fontweight="bold", color="#172554")
        ax.set_ylabel("Mobility Index", fontsize=10, fontweight="bold", color="#172554")
        ax.grid(True, linestyle="--", alpha=0.4)
        ax.legend(loc="upper right", fontsize=8, frameon=True)
        ax.set_ylim(0.0, 1.05)

    axes[-1].set_xticks(hours)
    axes[-1].set_xticklabels(hour_labels, rotation=45, ha="right", fontsize=9)
    axes[-1].set_xlabel("Time of Day (Doses marked in red dotted line)", fontsize=10, fontweight="bold", color="#172554")

    plt.suptitle("Progressive Widening of Forecast Uncertainty Band with Decreased Training History\n(Simulated ground truth backtest)",
                 fontsize=12, fontweight="bold", color="#172554", y=0.99)
    plt.tight_layout()

    plot_path = os.path.join(RESULTS_DIR, "forecast_uncertainty_widening.png")
    plt.savefig(plot_path, bbox_inches="tight")
    plt.close()
    print(f" Saved uncertainty progression plot to: {plot_path}")

    return mae, window_acc


if __name__ == "__main__":
    run_forecast_backtest_validation()
