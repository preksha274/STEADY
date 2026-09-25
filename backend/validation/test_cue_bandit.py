"""
STEADY Validation Suite - Step 3: Virtual-Patient Bandit Validation (Live Cue Designer)
Simulates a virtual Parkinson's patient with a ground-truth optimal sensory cue (modality + cadence)
and validates that the 1D hill-climbing adaptation loop converges faster than random exploration.

Outputs convergence & cumulative regret plots to validation/results/cue_adaptation_convergence.png.
DISCLAIMER: Algorithmic convergence validation on simulated patient model. Not a clinical trial.
"""

import os
import sys
import numpy as np
import matplotlib.pyplot as plt

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from steady_ai import CueType, adapt_cue_tempo_step, compute_cue_benefit_score

RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
os.makedirs(RESULTS_DIR, exist_ok=True)


class VirtualPatientSimulator:
    """
    Simulates a patient's movement response to different rhythmic cues.
    True optimal: Visual Flash at 110 BPM (yields peak synchronization ~95%).
    Responses fall off with distance from optimal tempo and sub-optimal modality.
    """
    def __init__(self, optimal_cue: CueType = CueType.VISUAL_FLASH, optimal_tempo: int = 110, seed: int = 42):
        self.optimal_cue = optimal_cue
        self.optimal_tempo = optimal_tempo
        self.rng = np.random.default_rng(seed)

    def evaluate_response(self, cue_type: CueType, tempo_bpm: int) -> tuple[float, float, float]:
        # Modality penalty
        modality_penalty = 0.0 if cue_type == self.optimal_cue else 12.0

        # Tempo distance penalty (bell curve around optimal tempo)
        tempo_diff = abs(tempo_bpm - self.optimal_tempo)
        tempo_penalty = (tempo_diff / 4.0) ** 1.8

        # Base synchronization (0 to 100%)
        mean_sync = max(35.0, 95.0 - modality_penalty - tempo_penalty)
        noisy_sync = float(np.clip(mean_sync + self.rng.normal(0, 2.5), 20.0, 99.0))

        # Stride smoothness (0 to 1.0)
        mean_smooth = max(0.3, 0.95 - (tempo_diff * 0.02) - (modality_penalty * 0.015))
        noisy_smooth = float(np.clip(mean_smooth + self.rng.normal(0, 0.03), 0.2, 1.0))

        # Measured natural cadence influenced by metronome cue
        measured_cadence = float(self.optimal_tempo + 0.3 * (tempo_bpm - self.optimal_tempo) + self.rng.normal(0, 1.5))

        return noisy_sync, noisy_smooth, measured_cadence


def run_cue_bandit_simulation(num_trials: int = 50, num_runs: int = 30):
    print("=========================================================================")
    print("STEADY VALIDATION - STEP 3: Virtual-Patient Bandit Convergence Test")
    print("=========================================================================")

    all_adaptive_pct_best = []
    all_random_pct_best = []
    all_adaptive_regrets = []
    all_random_regrets = []

    for run_idx in range(num_runs):
        sim = VirtualPatientSimulator(optimal_cue=CueType.VISUAL_FLASH, optimal_tempo=110, seed=run_idx + 100)
        optimal_max_score = compute_cue_benefit_score(95.0, 0.95)

        # 1. Adaptive Algorithm Agent
        all_cues = [CueType.AUDIO_BEAT, CueType.VIBRATION_PULSE, CueType.VISUAL_FLASH]
        modality_scores = {}
        curr_cue = CueType.AUDIO_BEAT
        curr_tempo = 80
        prev_tempo = None
        prev_benefit = None
        history_sync = []

        adaptive_is_best = []
        adaptive_regret = []
        cum_regret_ad = 0.0

        for t in range(num_trials):
            # Exploration phase on first 3 trials (test each modality once)
            if t < len(all_cues):
                curr_cue = all_cues[t]
                curr_tempo = 80

            sync, smooth, cadence = sim.evaluate_response(curr_cue, curr_tempo)
            history_sync.append(sync)
            current_benefit = compute_cue_benefit_score(sync, smooth)

            if t < len(all_cues):
                modality_scores[curr_cue] = current_benefit
                if t == len(all_cues) - 1:
                    # Pick winning candidate modality from initial test
                    curr_cue = max(modality_scores.keys(), key=lambda k: modality_scores[k])

            # Regret = max possible benefit - actual benefit
            regret = max(0.0, optimal_max_score - current_benefit)
            cum_regret_ad += regret
            adaptive_regret.append(cum_regret_ad)

            # Check if within +/- 4 BPM of optimal tempo & matching cue modality
            is_optimal = (curr_cue == sim.optimal_cue) and (abs(curr_tempo - sim.optimal_tempo) <= 4)
            adaptive_is_best.append(1.0 if is_optimal else 0.0)

            # Adapt step (starting after initial exploration)
            if t >= len(all_cues) - 1:
                step_out = adapt_cue_tempo_step(
                    current_cue_type=curr_cue,
                    current_tempo_bpm=curr_tempo,
                    measured_cadence_spm=cadence,
                    current_sync_pct=sync,
                    current_stride_smoothness=smooth,
                    prev_tempo_bpm=prev_tempo,
                    prev_benefit_score=prev_benefit,
                    sync_history_last_5_steps=history_sync[-5:]
                )

                prev_tempo = curr_tempo
                prev_benefit = current_benefit
                curr_tempo = step_out.suggested_tempo_bpm

                if step_out.cue_fatigue_detected and step_out.recommended_rotation:
                    curr_cue = step_out.recommended_rotation

        all_adaptive_pct_best.append(adaptive_is_best)
        all_adaptive_regrets.append(adaptive_regret)


        # 2. Random Baseline Agent
        random_is_best = []
        random_regret = []
        cum_regret_rand = 0.0
        all_cues = [CueType.AUDIO_BEAT, CueType.VIBRATION_PULSE, CueType.VISUAL_FLASH]

        for t in range(num_trials):
            rand_cue = sim.rng.choice(all_cues)
            rand_tempo = int(sim.rng.integers(60, 121))

            sync_r, smooth_r, _ = sim.evaluate_response(rand_cue, rand_tempo)
            score_r = compute_cue_benefit_score(sync_r, smooth_r)

            regret_r = max(0.0, optimal_max_score - score_r)
            cum_regret_rand += regret_r
            random_regret.append(cum_regret_rand)

            is_optimal_r = (rand_cue == sim.optimal_cue) and (abs(rand_tempo - sim.optimal_tempo) <= 4)
            random_is_best.append(1.0 if is_optimal_r else 0.0)

        all_random_pct_best.append(random_is_best)
        all_random_regrets.append(random_regret)

    # Average metrics across runs
    mean_ad_pct = np.mean(all_adaptive_pct_best, axis=0) * 100.0
    mean_rand_pct = np.mean(all_random_pct_best, axis=0) * 100.0
    mean_ad_regret = np.mean(all_adaptive_regrets, axis=0)
    mean_rand_regret = np.mean(all_random_regrets, axis=0)

    final_ad_pct = mean_ad_pct[-1]
    final_rand_pct = mean_rand_pct[-1]
    print(f" Trials Converged on Optimal Cue (Final 10 trials average):")
    print(f"  - STEADY Adaptive Hill-Climbing Loop: {np.mean(mean_ad_pct[-10:]):.1f}%")
    print(f"  - Random Selection Baseline:          {np.mean(mean_rand_pct[-10:]):.1f}%")
    print(f" Cumulative Regret Reduction: {(1.0 - mean_ad_regret[-1]/mean_rand_regret[-1])*100.0:.1f}% vs random baseline")

    # Generate Deliverable Comparison Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)

    trials = np.arange(1, num_trials + 1)

    # Plot 1: % of Trials on Optimal Cue
    ax1.plot(trials, mean_ad_pct, label="STEADY 1D Hill-Climb Loop", color="#2563EB", linewidth=2.5)
    ax1.plot(trials, mean_rand_pct, label="Random Exploration Baseline", color="#94A3B8", linestyle="--", linewidth=1.8)
    ax1.set_xlabel("Adaptation Trials / Iterations", fontsize=10, fontweight="bold", color="#172554")
    ax1.set_ylabel("% Probability on Optimal Cue Window", fontsize=10, fontweight="bold", color="#172554")
    ax1.set_title("Cue Convergence Rate over Trials", fontsize=11, fontweight="bold", color="#172554")
    ax1.legend(loc="lower right", frameon=True)
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.set_ylim(-2, 105)

    # Plot 2: Cumulative Regret
    ax2.plot(trials, mean_ad_regret, label="STEADY Adaptive Loop", color="#10B981", linewidth=2.5)
    ax2.plot(trials, mean_rand_regret, label="Random Exploration Baseline", color="#EF4444", linestyle="--", linewidth=1.8)
    ax2.set_xlabel("Adaptation Trials / Iterations", fontsize=10, fontweight="bold", color="#172554")
    ax2.set_ylabel("Cumulative Sub-optimality (Regret)", fontsize=10, fontweight="bold", color="#172554")
    ax2.set_title("Cumulative Regret Minimization", fontsize=11, fontweight="bold", color="#172554")
    ax2.legend(loc="upper left", frameon=True)
    ax2.grid(True, linestyle="--", alpha=0.5)

    plt.suptitle("Live Cue Designer Adaptation Loop vs. Random Baseline (N=30 Virtual Patients)\n(Validated on simulated ground-truth patient response)", fontsize=12, fontweight="bold", color="#172554", y=1.02)
    plt.tight_layout()

    plot_path = os.path.join(RESULTS_DIR, "cue_adaptation_convergence.png")
    plt.savefig(plot_path, bbox_inches="tight")
    plt.close()
    print(f" Saved convergence plot to: {plot_path}")

    assert mean_ad_regret[-1] < mean_rand_regret[-1], "Adaptive loop should achieve lower cumulative regret than random"
    return mean_ad_pct, mean_rand_pct


if __name__ == "__main__":
    run_cue_bandit_simulation()
