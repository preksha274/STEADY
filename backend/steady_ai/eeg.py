"""
STEADY AI - EEG Band-Power & Artifact Detection Module
Extracts Delta, Theta, Alpha, Beta (13-30 Hz), and Gamma band powers via Welch PSD.
Comprehensive data-quality assessment: flat channels, high-voltage artifacts,
50/60Hz mains line noise, and ocular/muscle interference flags.
"""

from typing import Optional, Union, Dict, Any, List, Tuple
import io
import numpy as np
import pandas as pd
from scipy.signal import welch

from .types import (
    BandPowerDetail,
    EEGBandPowers,
    EEGQualityReport,
    ConfidenceReport,
    PSDPoint,
    EEGSessionOutput
)
from .confidence import score_eeg_confidence


BAND_DEFINITIONS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0)
}


def extract_eeg_features(
    data: Union[pd.DataFrame, bytes, str, np.ndarray],
    sample_rate_hz: Optional[float] = None,
    session_id: Optional[str] = None
) -> EEGSessionOutput:
    """
    Extracts EEG frequency band powers (with beta band focus) and multi-channel artifact flags.
    Pure function with typed outputs.
    """
    # 1. Parse data
    if isinstance(data, (bytes, bytearray)):
        df = pd.read_csv(io.BytesIO(data))
    elif isinstance(data, str):
        if "\n" in data or "," in data:
            df = pd.read_csv(io.StringIO(data))
        else:
            df = pd.read_csv(data)
    elif isinstance(data, np.ndarray):
        # Assume columns are channels
        cols = [f"ch_{i+1}" for i in range(data.shape[1])]
        df = pd.DataFrame(data, columns=cols)
    elif isinstance(data, pd.DataFrame):
        df = data.copy()
    else:
        raise TypeError(f"Unsupported data type for EEG analysis: {type(data)}")

    if df.empty:
        raise ValueError("EEG dataset is empty.")

    df.columns = [str(c).strip().lower() for c in df.columns]

    # Detect time column
    time_col = None
    for tc in ["time", "t", "timestamp", "time_s", "time(s)"]:
        if tc in df.columns:
            time_col = tc
            break

    if time_col is not None:
        df[time_col] = pd.to_numeric(df[time_col], errors="coerce")
        df = df.dropna(subset=[time_col]).reset_index(drop=True)
        time_vals = df[time_col].values
        if sample_rate_hz is None:
            dt_vals = np.diff(time_vals)
            mean_dt = float(np.mean(dt_vals)) if len(dt_vals) > 0 and np.mean(dt_vals) > 0 else 0.004
            fs = float(1.0 / mean_dt) if mean_dt > 0 else 250.0
        else:
            fs = float(sample_rate_hz)
        duration_s = float(time_vals[-1] - time_vals[0]) if len(time_vals) > 1 else 0.0
    else:
        fs = float(sample_rate_hz) if sample_rate_hz is not None else 250.0
        duration_s = float(len(df) / fs)
        time_vals = np.arange(len(df)) / fs

    if duration_s < 3.0:
        raise ValueError(f"Recording duration ({duration_s:.2f}s) is too short. At least 3 seconds required.")

    # Channel columns
    non_time_cols = [c for c in df.columns if c != time_col]
    channel_cols = []
    for col in non_time_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].notna().sum() > 0:
            channel_cols.append(col)

    if not channel_cols:
        raise ValueError("No valid EEG channel columns found.")

    df = df.dropna(subset=channel_cols).reset_index(drop=True)

    # 2. Quality & Artifact Assessment
    flat_channels: List[str] = []
    artifact_channels: List[str] = []
    channel_stds: List[float] = []

    for ch in channel_cols:
        sig = df[ch].values
        std_val = float(np.std(sig))
        max_abs = float(np.max(np.abs(sig)))
        channel_stds.append(std_val)

        if std_val < 1e-6:
            flat_channels.append(ch)
        if max_abs > 500.0:  # >500 uV amplitude artifact
            artifact_channels.append(ch)

    med_std = float(np.median(channel_stds)) if channel_stds else 1.0
    for ch, std_val in zip(channel_cols, channel_stds):
        if std_val > 10.0 * med_std and ch not in artifact_channels:
            artifact_channels.append(ch)

    # 3. Welch's PSD across valid channels
    valid_channels = [ch for ch in channel_cols if ch not in flat_channels]
    if not valid_channels:
        valid_channels = channel_cols

    psd_list = []
    freqs_ref = None

    for ch in valid_channels:
        sig = df[ch].values
        sig_detrend = sig - np.mean(sig)
        nperseg = min(len(sig_detrend), max(128, int(fs * 4)))
        freqs, psd_ch = welch(sig_detrend, fs=fs, nperseg=nperseg)
        freqs_ref = freqs
        psd_list.append(psd_ch)

    avg_psd = np.mean(psd_list, axis=0)

    # 4. Mains 50/60 Hz Line Noise Check
    line_noise_present = False
    for line_f in [50.0, 60.0]:
        mask_line = (freqs_ref >= line_f - 1.0) & (freqs_ref <= line_f + 1.0)
        mask_bg = (freqs_ref >= line_f - 5.0) & (freqs_ref <= line_f + 5.0) & (~mask_line)
        if np.any(mask_line) and np.any(mask_bg):
            peak_power = float(np.max(avg_psd[mask_line]))
            bg_power = float(np.mean(avg_psd[mask_bg]))
            if bg_power > 0 and (peak_power / bg_power) > 5.0:
                line_noise_present = True

    # 5. Muscle / Blink Artifact Check (high power ratio in >35Hz or low <1Hz drift)
    blink_or_muscle_present = False
    mask_high_freq = (freqs_ref >= 35.0) & (freqs_ref <= min(70.0, fs / 2.0))
    mask_total = (freqs_ref >= 0.5) & (freqs_ref <= 45.0)
    if np.any(mask_high_freq) and np.any(mask_total):
        high_power = float(np.sum(avg_psd[mask_high_freq]))
        total_p = float(np.sum(avg_psd[mask_total]))
        if total_p > 0 and (high_power / total_p) > 0.45:
            blink_or_muscle_present = True

    # 6. Band Power Integration
    def compute_band_power(f_low: float, f_high: float) -> float:
        mask = (freqs_ref >= f_low) & (freqs_ref <= f_high)
        if not np.any(mask):
            return 0.0
        if hasattr(np, "trapezoid"):
            return float(np.trapezoid(avg_psd[mask], freqs_ref[mask]))
        return float(np.trapz(avg_psd[mask], freqs_ref[mask]))

    delta_abs = compute_band_power(*BAND_DEFINITIONS["delta"])
    theta_abs = compute_band_power(*BAND_DEFINITIONS["theta"])
    alpha_abs = compute_band_power(*BAND_DEFINITIONS["alpha"])
    beta_abs = compute_band_power(*BAND_DEFINITIONS["beta"])
    gamma_abs = compute_band_power(*BAND_DEFINITIONS["gamma"])

    total_power = compute_band_power(0.5, 45.0)
    safe_total = max(total_power, 1e-12)

    delta_rel = float(delta_abs / safe_total)
    theta_rel = float(theta_abs / safe_total)
    alpha_rel = float(alpha_abs / safe_total)
    beta_rel = float(beta_abs / safe_total)
    gamma_rel = float(gamma_abs / safe_total)

    band_powers = EEGBandPowers(
        delta=BandPowerDetail(absolute=round(delta_abs, 4), relative=round(delta_rel, 4), band_hz=BAND_DEFINITIONS["delta"]),
        theta=BandPowerDetail(absolute=round(theta_abs, 4), relative=round(theta_rel, 4), band_hz=BAND_DEFINITIONS["theta"]),
        alpha=BandPowerDetail(absolute=round(alpha_abs, 4), relative=round(alpha_rel, 4), band_hz=BAND_DEFINITIONS["alpha"]),
        beta=BandPowerDetail(absolute=round(beta_abs, 4), relative=round(beta_rel, 4), band_hz=BAND_DEFINITIONS["beta"]),
        gamma=BandPowerDetail(absolute=round(gamma_abs, 4), relative=round(gamma_rel, 4), band_hz=BAND_DEFINITIONS["gamma"]),
        total_power_0_5_45hz=round(total_power, 4)
    )

    # 7. Confidence & Quality Report
    confidence = score_eeg_confidence(
        duration_s=duration_s,
        channel_count=len(channel_cols),
        flat_channels=flat_channels,
        artifact_channels=artifact_channels,
        line_noise_present=line_noise_present,
        blink_or_muscle_present=blink_or_muscle_present
    )

    quality = EEGQualityReport(
        duration_s=round(duration_s, 2),
        sample_rate_hz=round(fs, 1),
        channel_count=len(channel_cols),
        flat_channels=flat_channels,
        artifact_channels=artifact_channels,
        line_noise_present=line_noise_present,
        blink_or_muscle_artifact=blink_or_muscle_present,
        is_short=duration_s < 10.0
    )

    # Chart PSD (0 to 35 Hz)
    chart_mask = (freqs_ref >= 0.0) & (freqs_ref <= 35.0)
    chart_psd = [
        PSDPoint(
            freq_hz=round(float(f), 2),
            power=round(float(p), 6)
        )
        for f, p in zip(freqs_ref[chart_mask], avg_psd[chart_mask])
    ]

    return EEGSessionOutput(
        session_id=session_id,
        channel_count=len(channel_cols),
        channels=channel_cols,
        band_powers=band_powers,
        quality=quality,
        confidence=confidence,
        chart_psd=chart_psd,
        beta_band_power=round(beta_abs, 4),
        beta_relative_ratio=round(beta_rel, 4)
    )
