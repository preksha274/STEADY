"""
STEADY Validation Suite - Step 1: Synthetic Signal Frequency Recovery (TremorScope)
Tests the frequency extraction algorithm against synthetic ground-truth sine waves
across multiple tremor frequencies (3.0–8.0 Hz), out-of-band frequencies,
sampling rates (50, 100, 200 Hz), and noise levels.

DISCLAIMER: Algorithm verification against synthetic ground-truth. Does not constitute clinical validation.
"""

import os
import sys
import numpy as np
import pandas as pd

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from steady_ai import extract_motion_features


def generate_synthetic_tremor_wave(
    target_freq_hz: float,
    amplitude: float = 0.65,
    sample_rate_hz: float = 100.0,
    duration_s: float = 15.0,
    noise_std: float = 0.05,
    seed: int = 42
) -> pd.DataFrame:
    np.random.seed(seed)
    n_samples = int(duration_s * sample_rate_hz)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)

    # Base gravity offset (9.81 m/s^2) on ax + sinusoidal oscillation at target_freq
    ax = 9.81 + amplitude * np.sin(2 * np.pi * target_freq_hz * t) + np.random.normal(0, noise_std, n_samples)
    ay = 0.15 * np.cos(2 * np.pi * target_freq_hz * t) + np.random.normal(0, noise_std, n_samples)
    az = 0.10 * np.sin(2 * np.pi * target_freq_hz * t) + np.random.normal(0, noise_std, n_samples)

    return pd.DataFrame({
        "time": np.round(t, 4),
        "ax": np.round(ax, 5),
        "ay": np.round(ay, 5),
        "az": np.round(az, 5)
    })


def run_synthetic_tremor_validation():
    print("=========================================================================")
    print("STEADY VALIDATION - STEP 1: Synthetic Signal Frequency Recovery (TremorScope)")
    print("=========================================================================")

    # Test matrix
    in_band_frequencies = [3.5, 4.2, 4.8, 5.5, 6.2, 7.0]
    out_of_band_frequencies = [1.8, 10.5]
    sample_rates = [50.0, 100.0, 200.0]
    noise_levels = [0.02, 0.08, 0.15]  # low, medium, high noise

    total_tests = 0
    passed_tests = 0
    tolerance_hz = 0.30

    print("\n--- In-Band Tremor Frequency Tests (3-8 Hz, target tolerance: +/-0.30 Hz) ---")
    for fs in sample_rates:
        for noise in noise_levels:
            for f_true in in_band_frequencies:
                total_tests += 1
                df = generate_synthetic_tremor_wave(
                    target_freq_hz=f_true,
                    sample_rate_hz=fs,
                    noise_std=noise,
                    duration_s=15.0
                )
                res = extract_motion_features(df, sample_rate_hz=fs)
                f_detected = res.metrics.tremor_frequency_hz
                err = abs(f_detected - f_true)

                is_pass = err <= tolerance_hz
                if is_pass:
                    passed_tests += 1
                    status_str = "[PASS]"
                else:
                    status_str = "[FAIL]"

                print(f" {status_str} Target: {f_true:4.1f} Hz | Detected: {f_detected:4.2f} Hz (Err: {err:4.2f} Hz) | Fs: {fs:3.0f} Hz | Noise std: {noise:4.2f}")

    print("\n--- Out-of-Band Frequency Rejection Tests (<3 Hz or >8 Hz) ---")
    for f_out in out_of_band_frequencies:
        df_out = generate_synthetic_tremor_wave(target_freq_hz=f_out, sample_rate_hz=100.0, noise_std=0.05)
        res_out = extract_motion_features(df_out, sample_rate_hz=100.0)
        # For out-of-band, tremor amplitude should remain low and peak within 3-8Hz band should not reflect out-of-band energy
        print(f" [INFO] Out-of-Band {f_out:4.1f} Hz -> In-Band Detected Peak: {res_out.metrics.tremor_frequency_hz:4.2f} Hz | Tremor Amp: {res_out.metrics.tremor_amplitude:5.4f} (Severity: {res_out.metrics.intensity.value})")

    pass_rate = (passed_tests / total_tests) * 100.0
    print("\n-------------------------------------------------------------------------")
    print(f"SUMMARY: Recovered tremor frequency within +/-{tolerance_hz}Hz across {passed_tests}/{total_tests} ({pass_rate:.1f}%) synthetic conditions.")
    print("-------------------------------------------------------------------------\n")


    assert pass_rate >= 95.0, f"Expected pass rate >= 95%, got {pass_rate:.1f}%"
    return passed_tests, total_tests


if __name__ == "__main__":
    run_synthetic_tremor_validation()
