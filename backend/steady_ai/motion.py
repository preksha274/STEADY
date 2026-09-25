"""
STEADY AI - Motion Feature Extraction (TremorScope & Gait Biomechanics)
Processes 3-axis accelerometer and optional gyroscope time series.
Extracts tremor frequency (3-8Hz), tremor amplitude, signal variability,
and gait cadence/asymmetry metrics.
"""

from typing import Optional, Union, Dict, Any, List, Tuple
import io
import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, welch, find_peaks

from .types import (
    TremorMetrics,
    SignalQuality,
    ConfidenceReport,
    ConfidenceTier,
    SymptomSeverityTier,
    ChartPoint,
    PSDPoint,
    TremorScopeSessionOutput
)
from .confidence import score_motion_confidence


TREMOR_BAND_HZ = (3.0, 8.0)
LOCOMOTION_BAND_HZ = (0.5, 3.0)

# Severity threshold benchmarks for tremor amplitude (m/s^2 RMS)
TREMOR_THRESHOLDS = {
    "mild": 0.08,      # RMS < 0.08 m/s^2
    "moderate": 0.25,  # 0.08 <= RMS < 0.25 m/s^2
    "high": 0.25       # RMS >= 0.25 m/s^2
}


def extract_motion_features(
    data: Union[pd.DataFrame, bytes, str, np.ndarray],
    sample_rate_hz: Optional[float] = None,
    baseline_amplitude: Optional[float] = None,
    session_id: Optional[str] = None
) -> TremorScopeSessionOutput:
    """
    Extracts tremor and gait biomechanical metrics from IMU data.
    Pure function with typed output.
    """
    # 1. Parse input to DataFrame
    if isinstance(data, (bytes, bytearray)):
        df = pd.read_csv(io.BytesIO(data))
    elif isinstance(data, str):
        if "\n" in data or "," in data:
            df = pd.read_csv(io.StringIO(data))
        else:
            df = pd.read_csv(data)
    elif isinstance(data, np.ndarray):
        if data.shape[1] >= 3:
            cols = ["ax", "ay", "az"]
            if data.shape[1] >= 6:
                cols += ["gx", "gy", "gz"]
            if data.shape[1] >= 7:
                cols = ["time"] + cols
            df = pd.DataFrame(data, columns=cols[:data.shape[1]])
        else:
            raise ValueError(f"NumPy array must have at least 3 columns (ax, ay, az), got shape {data.shape}")
    elif isinstance(data, pd.DataFrame):
        df = data.copy()
    else:
        raise TypeError(f"Unsupported data type for IMU analysis: {type(data)}")

    if df.empty:
        raise ValueError("IMU dataset is empty.")

    # Normalize column names
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Check accelerometer columns
    req_cols = ["ax", "ay", "az"]
    missing_req = [c for c in req_cols if c not in df.columns]
    if missing_req:
        raise ValueError(f"Missing required accelerometer columns: {missing_req}. Expected ax, ay, az.")

    initial_row_count = len(df)
    for col in req_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=req_cols).reset_index(drop=True)
    clean_row_count = len(df)
    if clean_row_count == 0:
        raise ValueError("No valid numeric rows for ax, ay, az.")

    missing_samples_pct = float(max(0.0, ((initial_row_count - clean_row_count) / max(1, initial_row_count)) * 100.0))

    # 2. Timing and Sample Rate
    time_col = None
    for tc in ["time", "t", "timestamp", "time_s", "time(s)"]:
        if tc in df.columns:
            time_col = tc
            break

    if time_col is not None:
        df[time_col] = pd.to_numeric(df[time_col], errors="coerce")
        df = df.dropna(subset=[time_col]).reset_index(drop=True)
        time_vals = df[time_col].values
        dt_vals = np.diff(time_vals)
        mean_dt = float(np.mean(dt_vals)) if len(dt_vals) > 0 and np.mean(dt_vals) > 0 else 0.01
        fs = float(1.0 / mean_dt) if sample_rate_hz is None else float(sample_rate_hz)
        duration_s = float(time_vals[-1] - time_vals[0]) if len(time_vals) > 1 else 0.0
    else:
        fs = float(sample_rate_hz) if sample_rate_hz is not None else 100.0
        duration_s = float(len(df) / fs)
        time_vals = np.arange(len(df)) / fs

    # 3. Acceleration magnitude & preprocessing
    ax, ay, az = df["ax"].values, df["ay"].values, df["az"].values
    a_mag = np.sqrt(ax**2 + ay**2 + az**2)
    signal_magnitude = float(np.mean(a_mag))
    variability = float(np.std(a_mag))

    # Detrend
    a_detrend = a_mag - signal_magnitude

    # Bandpass filter (0.5 to 15.0 Hz)
    nyq = fs / 2.0
    low_cut = 0.5 / nyq
    high_cut = min(15.0, nyq - 0.1) / nyq
    if low_cut < high_cut and high_cut > 0 and low_cut > 0:
        b, a = butter(3, [low_cut, high_cut], btype="bandpass")
        a_filtered = filtfilt(b, a, a_detrend)
    else:
        a_filtered = a_detrend

    # 4. Spectral Tremor Analysis via Welch's PSD
    nperseg = min(len(a_filtered), max(64, int(fs * 4)))
    freqs, psd = welch(a_filtered, fs=fs, nperseg=nperseg)

    # 3-8 Hz Tremor Band
    tremor_min_hz, tremor_max_hz = TREMOR_BAND_HZ
    tremor_mask = (freqs >= tremor_min_hz) & (freqs <= tremor_max_hz)

    if np.any(tremor_mask):
        tremor_freqs = freqs[tremor_mask]
        tremor_psd = psd[tremor_mask]
        max_idx = np.argmax(tremor_psd)
        tremor_frequency_hz = float(tremor_freqs[max_idx])

        # Integrate band power (using trapezoid integration)
        if hasattr(np, "trapezoid"):
            area = float(np.trapezoid(tremor_psd, tremor_freqs))
        else:
            area = float(np.trapz(tremor_psd, tremor_freqs))
        tremor_amplitude = float(np.sqrt(max(0.0, area)))
    else:
        tremor_frequency_hz = 0.0
        tremor_amplitude = 0.0

    # Severity Tier categorization
    if tremor_amplitude < TREMOR_THRESHOLDS["mild"]:
        intensity = SymptomSeverityTier.MILD
    elif tremor_amplitude < TREMOR_THRESHOLDS["moderate"]:
        intensity = SymptomSeverityTier.MODERATE
    else:
        intensity = SymptomSeverityTier.HIGH

    # 5. Gyroscope RMS if present
    gyro_rms = None
    gyro_cols = ["gx", "gy", "gz"]
    if all(gc in df.columns for gc in gyro_cols):
        for gc in gyro_cols:
            df[gc] = pd.to_numeric(df[gc], errors="coerce")
        df_g = df.dropna(subset=gyro_cols)
        if len(df_g) > 0:
            g_mag = np.sqrt(df_g["gx"].values**2 + df_g["gy"].values**2 + df_g["gz"].values**2)
            gyro_rms = float(np.sqrt(np.mean(g_mag**2)))

    # 6. Gait Cadence & Asymmetry (if movement present)
    step_cadence_spm = None
    step_regularity = None
    asymmetry_index = None

    if duration_s >= 4.0:
        # Check low-frequency locomotion peaks (0.8 - 3.0 Hz)
        min_dist = max(1, int(fs * 0.35))  # max 170 steps/min
        peaks, props = find_peaks(a_filtered, distance=min_dist, prominence=0.05)
        if len(peaks) >= 4:
            peak_times = time_vals[peaks]
            step_intervals = np.diff(peak_times)
            mean_step_time = float(np.mean(step_intervals))
            if mean_step_time > 0:
                step_cadence_spm = float(60.0 / mean_step_time)
                # Step regularity: 1.0 - CV of step time
                cv_step = float(np.std(step_intervals) / mean_step_time)
                step_regularity = float(max(0.0, min(1.0, 1.0 - cv_step)))

                # Even vs Odd step duration ratio for asymmetry
                if len(step_intervals) >= 4:
                    even_steps = step_intervals[0::2]
                    odd_steps = step_intervals[1::2]
                    min_len = min(len(even_steps), len(odd_steps))
                    if min_len > 0:
                        diff_ratio = np.abs(np.mean(even_steps[:min_len]) - np.mean(odd_steps[:min_len])) / mean_step_time
                        asymmetry_index = float(diff_ratio * 100.0)

    # 7. Baseline deviation calculation
    baseline_deviation_pct = None
    if baseline_amplitude is not None and baseline_amplitude > 0:
        diff = tremor_amplitude - baseline_amplitude
        baseline_deviation_pct = float((diff / baseline_amplitude) * 100.0)

    # 8. Confidence scoring
    confidence = score_motion_confidence(
        duration_s=duration_s,
        variability=variability,
        missing_samples_pct=missing_samples_pct,
        sample_rate_hz=fs
    )

    quality = SignalQuality(
        duration_s=round(duration_s, 2),
        sample_rate_hz=round(fs, 1),
        missing_samples_pct=round(missing_samples_pct, 2),
        is_short=duration_s < 10.0,
        is_noisy=variability > 3.0 or missing_samples_pct > 5.0,
        details="Standardized phone accelerometer signal extraction"
    )

    # 9. Downsampled chart data
    step = max(1, len(time_vals) // 800)
    chart_signal = [
        ChartPoint(
            time_s=round(float(t), 3),
            raw_magnitude=round(float(m), 4),
            filtered_magnitude=round(float(fm), 4)
        )
        for t, m, fm in zip(time_vals[::step], a_mag[::step], a_filtered[::step])
    ]

    psd_mask = (freqs >= 0.0) & (freqs <= 15.0)
    chart_psd = [
        PSDPoint(
            freq_hz=round(float(f), 2),
            power=round(float(p), 6)
        )
        for f, p in zip(freqs[psd_mask], psd[psd_mask])
    ]

    metrics = TremorMetrics(
        tremor_frequency_hz=round(tremor_frequency_hz, 2),
        tremor_amplitude=round(tremor_amplitude, 4),
        intensity=intensity,
        signal_magnitude=round(signal_magnitude, 4),
        variability=round(variability, 4),
        gyro_rms=round(gyro_rms, 4) if gyro_rms is not None else None,
        step_cadence_spm=round(step_cadence_spm, 1) if step_cadence_spm is not None else None,
        step_regularity=round(step_regularity, 3) if step_regularity is not None else None,
        asymmetry_index=round(asymmetry_index, 2) if asymmetry_index is not None else None
    )

    return TremorScopeSessionOutput(
        session_id=session_id,
        metrics=metrics,
        quality=quality,
        confidence=confidence,
        chart_signal=chart_signal,
        chart_psd=chart_psd,
        baseline_deviation_pct=round(baseline_deviation_pct, 2) if baseline_deviation_pct is not None else None,
        label="Compared to your usual"
    )
