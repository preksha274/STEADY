"""
STEADY AI - Research & Demo Datasets Validation Module
Provides structured data loaders and high-fidelity benchmark generators for:
1. 2025 Gait Assessment Dataset (PD + healthy controls IMU accel/gyro)
2. Oxford Parkinson's Voice Biomarker Dataset (UCI format, research/demo validation)
3. PD-EEG Resting-State & Walking EEG (NEMAR format, multi-channel subset)

Outputs are strictly framed for technical validation and algorithm benchmarking,
never implying clinical diagnosis.
"""

from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd


def generate_gait_assessment_sample(
    condition: str = "pd_tremor",  # "pd_tremor", "pd_freeze", "healthy_control"
    duration_s: float = 12.0,
    sample_rate_hz: float = 100.0,
    seed: int = 42
) -> pd.DataFrame:
    """
    Generates synthetic sample in exact schema of 2025 Gait Assessment Dataset.
    Columns: time, ax, ay, az, gx, gy, gz
    """
    np.random.seed(seed)
    n_samples = int(duration_s * sample_rate_hz)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)

    # Base gravity vector aligned primarily with ax/ay (phone holding orientation)
    if condition == "pd_tremor":
        # 4.8 Hz resting tremor component on ax (with 9.81 m/s^2 DC offset) + minor orthogonal axes
        tremor_freq = 4.8
        tremor_amp = 0.65
        slow_drift = 0.2 * np.sin(2 * np.pi * 0.1 * t)
        noise_ax = np.random.normal(0, 0.05, n_samples)
        ax = 9.81 + tremor_amp * np.sin(2 * np.pi * tremor_freq * t) + slow_drift + noise_ax
        ay = 0.2 * np.cos(2 * np.pi * tremor_freq * t) + np.random.normal(0, 0.04, n_samples)
        az = 0.15 * np.sin(2 * np.pi * tremor_freq * t) + np.random.normal(0, 0.04, n_samples)
        gx = 15.0 * np.sin(2 * np.pi * tremor_freq * t) + np.random.normal(0, 1.0, n_samples)
        gy = 8.0 * np.cos(2 * np.pi * tremor_freq * t) + np.random.normal(0, 1.0, n_samples)
        gz = 12.0 * np.sin(2 * np.pi * tremor_freq * t) + np.random.normal(0, 1.0, n_samples)

    elif condition == "pd_freeze":
        # Locomotion (1.5 Hz) transitions to high-frequency trembling (5.5 Hz)
        half = n_samples // 2
        ax = np.full(n_samples, 9.81)
        ay = np.zeros(n_samples)
        az = np.zeros(n_samples)
        # Locomotion phase
        ax[:half] += 1.5 * np.sin(2 * np.pi * 1.5 * t[:half])
        ay[:half] += 0.8 * np.sin(2 * np.pi * 3.0 * t[:half])
        # Freeze phase: high 3-8Hz trembling, low locomotion
        ax[half:] += 0.9 * np.sin(2 * np.pi * 5.5 * t[half:])
        ay[half:] += 0.4 * np.sin(2 * np.pi * 6.0 * t[half:])
        gx = np.random.normal(0, 2.0, n_samples)
        gy = np.random.normal(0, 2.0, n_samples)
        gz = np.random.normal(0, 2.0, n_samples)

    elif condition == "healthy_control":
        # Clean rhythmic walking at 1.8 Hz (108 steps/min)
        cadence_freq = 1.8
        ax = 9.81 + 1.8 * np.sin(2 * np.pi * cadence_freq * t) + np.random.normal(0, 0.04, n_samples)
        ay = 0.9 * np.sin(2 * np.pi * (2 * cadence_freq) * t) + np.random.normal(0, 0.04, n_samples)
        az = 0.4 * np.cos(2 * np.pi * cadence_freq * t) + np.random.normal(0, 0.04, n_samples)
        gx = 35.0 * np.sin(2 * np.pi * cadence_freq * t)
        gy = 20.0 * np.cos(2 * np.pi * cadence_freq * t)
        gz = 45.0 * np.sin(2 * np.pi * cadence_freq * t)


    return pd.DataFrame({
        "time": np.round(t, 4),
        "ax": np.round(ax, 5),
        "ay": np.round(ay, 5),
        "az": np.round(az, 5),
        "gx": np.round(gx, 4),
        "gy": np.round(gy, 4),
        "gz": np.round(gz, 4)
    })


def generate_oxford_voice_sample(
    is_hypophonia: bool = True,
    sample_rate_hz: int = 44100,
    duration_s: float = 3.0,
    seed: int = 42
) -> np.ndarray:
    """
    Synthesizes 3-second audio waveform matching Oxford Parkinson's dataset acoustic properties.
    For technical audio validation only.
    """
    np.random.seed(seed)
    n_samples = int(duration_s * sample_rate_hz)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)

    f0 = 135.0  # Fundamental frequency (Hz)
    # Add subtle jitter and shimmer
    if is_hypophonia:
        amplitude = 0.08  # Soft voice (-22 dBFS)
        jitter = 0.03 * np.sin(2 * np.pi * 5.0 * t)
        harmonics = [1.0, 0.5, 0.25, 0.1]
    else:
        amplitude = 0.35  # Strong clear voice (-9 dBFS)
        jitter = 0.005 * np.sin(2 * np.pi * 3.0 * t)
        harmonics = [1.0, 0.7, 0.4, 0.2]

    wave = np.zeros(n_samples, dtype=np.float32)
    for h_idx, h_weight in enumerate(harmonics, start=1):
        freq = f0 * h_idx
        wave += h_weight * np.sin(2 * np.pi * (freq + jitter * freq) * t)

    # Normalize & apply envelope
    envelope = np.ones(n_samples)
    attack = int(0.1 * sample_rate_hz)
    decay = int(0.1 * sample_rate_hz)
    envelope[:attack] = np.linspace(0, 1, attack)
    envelope[-decay:] = np.linspace(1, 0, decay)

    wave = wave * envelope * amplitude
    # Add microphone background noise
    wave += np.random.normal(0, 0.002, n_samples).astype(np.float32)
    return wave


def generate_nemar_eeg_sample(
    condition: str = "resting_state",  # "resting_state", "walking", "noisy_mains"
    duration_s: float = 10.0,
    sample_rate_hz: float = 250.0,
    seed: int = 42
) -> pd.DataFrame:
    """
    Generates 4-channel EEG DataFrame matching NEMAR PD-EEG dataset specifications.
    Channels: Fz, Cz, Pz, Oz (10-20 system)
    """
    np.random.seed(seed)
    n_samples = int(duration_s * sample_rate_hz)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)

    channels = ["fz", "cz", "pz", "oz"]
    eeg_data = {}

    for ch in channels:
        # 1/f pink noise background
        pink = np.cumsum(np.random.normal(0, 1.2, n_samples))
        pink = pink - np.mean(pink)

        # Alpha rhythm (10 Hz)
        alpha = 8.0 * np.sin(2 * np.pi * 10.0 * t + np.random.uniform(0, 2*np.pi))
        # Beta rhythm (20 Hz)
        beta_amp = 7.5 if "resting" in condition else 4.0
        beta = beta_amp * np.sin(2 * np.pi * 20.0 * t + np.random.uniform(0, 2*np.pi))
        # Theta rhythm (6 Hz)
        theta = 4.0 * np.sin(2 * np.pi * 6.0 * t)

        sig = pink * 0.3 + alpha + beta + theta

        if condition == "noisy_mains":
            # Add strong 50 Hz powerline noise
            sig += 25.0 * np.sin(2 * np.pi * 50.0 * t)

        eeg_data[ch] = np.round(sig, 3)

    df = pd.DataFrame(eeg_data)
    df.insert(0, "time", np.round(t, 4))
    return df
