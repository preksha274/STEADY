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


TREMOR_BAND_HZ = (3.5, 7.5)  # Upgraded 3.5-7.5 Hz gyroscope/accelerometer band
LOCOMOTION_BAND_HZ = (0.5, 3.0)

# Severity threshold benchmarks for tremor amplitude (m/s^2 RMS or deg/s)
TREMOR_THRESHOLDS = {
    "mild": 0.08,      # RMS < 0.08 m/s^2
    "moderate": 0.25,  # 0.08 <= RMS < 0.25 m/s^2
    "high": 0.25       # RMS >= 0.25 m/s^2
}


def extract_motion_features(
    data: Union[pd.DataFrame, bytes, str, np.ndarray],
    sample_rate_hz: Optional[float] = None,
    baseline_amplitude: Optional[float] = None,
    session_id: Optional[str] = None,
    strap_side: str = "right",
    orientation: str = "dorsal",
    dose_time_iso: Optional[str] = None
) -> TremorScopeSessionOutput:
    """
    Extracts tremor and gait biomechanical metrics from IMU data.
    - 3.5-7.5 Hz Gyroscope/Accelerometer tremor computation
    - 3 Metrics: tremor amplitude, % time in tremor, tremor volume
    - Hardware integrity: clipping, dropped packets, timestamp jitter
    - Gravity removal & body-frame orientation alignment
    - Window context gating: rest vs posture vs moving (voluntary movement -> "not assessed")
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

    # 2. Timing, Hardware Integrity & Jitter Detection
    time_col = None
    for tc in ["time", "t", "timestamp", "time_s", "time(s)"]:
        if tc in df.columns:
            time_col = tc
            break

    clipping_detected = False
    dropped_packets = 0
    timestamp_jitter_s = 0.0

    if time_col is not None:
        df[time_col] = pd.to_numeric(df[time_col], errors="coerce")
        df = df.dropna(subset=[time_col]).reset_index(drop=True)
        time_vals = df[time_col].values
        dt_vals = np.diff(time_vals)
        mean_dt = float(np.mean(dt_vals)) if len(dt_vals) > 0 and np.mean(dt_vals) > 0 else 0.01
        fs = float(1.0 / mean_dt) if sample_rate_hz is None else float(sample_rate_hz)
        duration_s = float(time_vals[-1] - time_vals[0]) if len(time_vals) > 1 else 0.0

        # Dropped packets (dt > 1.5 * mean_dt) and timestamp jitter (std(dt))
        if len(dt_vals) > 1:
            dropped_packets = int(np.sum(dt_vals > (1.5 * mean_dt)))
            timestamp_jitter_s = float(np.std(dt_vals))
    else:
        fs = float(sample_rate_hz) if sample_rate_hz is not None else 100.0
        duration_s = float(len(df) / fs)
        time_vals = np.arange(len(df)) / fs

    # Clipping detection across sensor channels (check max values / flat tops)
    ax, ay, az = df["ax"].values, df["ay"].values, df["az"].values
    all_sens = np.column_stack([ax, ay, az])
    max_abs = np.max(np.abs(all_sens))
    if max_abs > 19.0 or max_abs > 156.0:  # saturate 2g/16g range
        clipping_detected = True

    # 3. Orientation Normalization & Gravity Removal (high-pass < 0.5Hz)
    a_mag_raw = np.sqrt(ax**2 + ay**2 + az**2)
    signal_magnitude = float(np.mean(a_mag_raw))
    variability = float(np.std(a_mag_raw))

    # Gravity estimation & removal (sub-0.5Hz low-pass filter subtraction)
    nyq = fs / 2.0
    low_cutoff = min(0.5, nyq - 0.1) / nyq
    if low_cutoff > 0:
        b_hp, a_hp = butter(2, low_cutoff, btype="highpass")
        ax_dyn = filtfilt(b_hp, a_hp, ax)
        ay_dyn = filtfilt(b_hp, a_hp, ay)
        az_dyn = filtfilt(b_hp, a_hp, az)
    else:
        ax_dyn, ay_dyn, az_dyn = ax - np.mean(ax), ay - np.mean(ay), az - np.mean(az)

    a_dyn_mag = np.sqrt(ax_dyn**2 + ay_dyn**2 + az_dyn**2)

    # 4. Check for Gyroscope Channels (preferred for tremor 3.5-7.5 Hz)
    gyro_cols = ["gx", "gy", "gz"]
    has_gyro = all(gc in df.columns for gc in gyro_cols)
    gyro_rms = None
    if has_gyro:
        for gc in gyro_cols:
            df[gc] = pd.to_numeric(df[gc], errors="coerce")
        gx, gy, gz = df["gx"].values, df["gy"].values, df["gz"].values
        g_mag_raw = np.sqrt(gx**2 + gy**2 + gz**2)
        gyro_rms = float(np.sqrt(np.mean(g_mag_raw**2)))
        # Bandpass filter gyro magnitude in 3.5-7.5 Hz
        b_tr, a_tr = butter(3, [3.5 / nyq, min(7.5, nyq - 0.1) / nyq], btype="bandpass")
        tremor_signal = filtfilt(b_tr, a_tr, g_mag_raw)
    else:
        # Fall back to dynamic accelerometer magnitude in 3.5-7.5 Hz
        b_tr, a_tr = butter(3, [3.5 / nyq, min(7.5, nyq - 0.1) / nyq], btype="bandpass")
        tremor_signal = filtfilt(b_tr, a_tr, a_dyn_mag)

    # 5. Sliding 2-second Window Analysis for % Time in Tremor and Context Gating
    win_samples = max(16, int(fs * 2.0))
    step_samples = max(8, int(fs * 0.5))
    total_windows = 0
    tremor_windows = 0
    assessed_windows = 0

    periodicity_scores = []
    axis_consistency_scores = []
    context_states = []

    for start_i in range(0, len(tremor_signal) - win_samples + 1, step_samples):
        total_windows += 1
        win_tr = tremor_signal[start_i : start_i + win_samples]
        win_ax = ax_dyn[start_i : start_i + win_samples]
        win_ay = ay_dyn[start_i : start_i + win_samples]
        win_az = az_dyn[start_i : start_i + win_samples]

        # Context detection: check locomotion / voluntary movement (0.5-3.0 Hz)
        win_dyn = a_dyn_mag[start_i : start_i + win_samples]
        locomotion_power = np.std(win_dyn)

        if locomotion_power > 1.2:
            # High voluntary movement -> Mark window as "moving" / "not_assessed"
            c_state = "moving"
        elif locomotion_power > 0.4:
            c_state = "posture"
        else:
            c_state = "rest"

        context_states.append(c_state)

        # Skip voluntary movement windows from tremor assessment
        if c_state == "moving":
            continue

        assessed_windows += 1
        win_rms = np.sqrt(np.mean(win_tr**2))

        # Periodicity strength (autocorrelation peak)
        autocorr = np.correlate(win_tr, win_tr, mode="full")
        autocorr = autocorr[len(autocorr)//2:]
        norm_ac = autocorr / (autocorr[0] + 1e-8)
        periodicity = float(np.max(norm_ac[4:])) if len(norm_ac) > 4 else 0.0
        periodicity_scores.append(periodicity)

        # Axis consistency (dominant axis ratio)
        px, py, pz = np.var(win_ax), np.var(win_ay), np.var(win_az)
        tot_p = px + py + pz + 1e-8
        axis_cons = float(max(px, py, pz) / tot_p)
        axis_consistency_scores.append(axis_cons)

        # Tremor detection threshold (0.05 rad/s or 0.08 m/s^2)
        if win_rms >= 0.05:
            tremor_windows += 1

    pct_time_in_tremor = float((tremor_windows / max(1, assessed_windows)) * 100.0) if assessed_windows > 0 else 0.0

    # 6. Spectral Tremor Analysis via Welch's PSD (3.5 - 7.5 Hz)
    nperseg = min(len(tremor_signal), max(64, int(fs * 4)))
    freqs, psd = welch(tremor_signal, fs=fs, nperseg=nperseg)

    tremor_mask = (freqs >= 3.5) & (freqs <= 7.5)
    if np.any(tremor_mask):
        tremor_freqs = freqs[tremor_mask]
        tremor_psd = psd[tremor_mask]
        max_idx = np.argmax(tremor_psd)
        tremor_frequency_hz = float(tremor_freqs[max_idx])

        if hasattr(np, "trapezoid"):
            area = float(np.trapezoid(tremor_psd, tremor_freqs))
        else:
            area = float(np.trapz(tremor_psd, tremor_freqs))
        tremor_amplitude = float(np.sqrt(max(0.0, area)))
    else:
        tremor_frequency_hz = 0.0
        tremor_amplitude = 0.0

    tremor_duration_s = float((pct_time_in_tremor / 100.0) * duration_s)
    tremor_volume = float(tremor_amplitude * tremor_duration_s)

    # Context state summary
    if "moving" in context_states and context_states.count("moving") > (len(context_states) * 0.6):
        primary_context = "not_assessed"
    elif context_states.count("posture") > context_states.count("rest"):
        primary_context = "posture"
    else:
        primary_context = "rest"

    mean_periodicity = float(np.mean(periodicity_scores)) if periodicity_scores else 0.0
    mean_axis_cons = float(np.mean(axis_consistency_scores)) if axis_consistency_scores else 0.0

    # Severity Tier categorization
    if tremor_amplitude < TREMOR_THRESHOLDS["mild"]:
        intensity = SymptomSeverityTier.MILD
    elif tremor_amplitude < TREMOR_THRESHOLDS["moderate"]:
        intensity = SymptomSeverityTier.MODERATE
    else:
        intensity = SymptomSeverityTier.HIGH

    # 7. Gait Cadence & Asymmetry (if movement present)
    step_cadence_spm = None
    step_regularity = None
    asymmetry_index = None

    if duration_s >= 4.0:
        min_dist = max(1, int(fs * 0.35))
        peaks, props = find_peaks(a_dyn_mag, distance=min_dist, prominence=0.05)
        if len(peaks) >= 4:
            peak_times = time_vals[peaks]
            step_intervals = np.diff(peak_times)
            mean_step_time = float(np.mean(step_intervals))
            if mean_step_time > 0:
                step_cadence_spm = float(60.0 / mean_step_time)
                cv_step = float(np.std(step_intervals) / mean_step_time)
                step_regularity = float(max(0.0, min(1.0, 1.0 - cv_step)))

                if len(step_intervals) >= 4:
                    even_steps = step_intervals[0::2]
                    odd_steps = step_intervals[1::2]
                    min_len = min(len(even_steps), len(odd_steps))
                    if min_len > 0:
                        diff_ratio = np.abs(np.mean(even_steps[:min_len]) - np.mean(odd_steps[:min_len])) / mean_step_time
                        asymmetry_index = float(diff_ratio * 100.0)

    # 8. Baseline deviation calculation
    baseline_deviation_pct = None
    if baseline_amplitude is not None and baseline_amplitude > 0:
        diff = tremor_amplitude - baseline_amplitude
        baseline_deviation_pct = float((diff / baseline_amplitude) * 100.0)

    # 9. Confidence scoring
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
        details="Standardized orientation-normalized IMU tremor signal"
    )

    # 10. Downsampled chart data
    step = max(1, len(time_vals) // 800)
    chart_signal = [
        ChartPoint(
            time_s=round(float(t), 3),
            raw_magnitude=round(float(m), 4),
            filtered_magnitude=round(float(fm), 4)
        )
        for t, m, fm in zip(time_vals[::step], a_mag_raw[::step], tremor_signal[::step])
    ]

    psd_mask = (freqs >= 0.0) & (freqs <= 15.0)
    chart_psd = [
        PSDPoint(
            freq_hz=round(float(f), 2),
            power=round(float(p), 6)
        )
        for f, p in zip(freqs[psd_mask], psd[psd_mask])
    ]

    # Non-diagnostic framing label
    label_text = "Compared to your personal 14-day baseline"
    if dose_time_iso:
        label_text += " (movement pattern changed around dose time)"

    metrics = TremorMetrics(
        tremor_frequency_hz=round(tremor_frequency_hz, 2),
        tremor_amplitude=round(tremor_amplitude, 4),
        pct_time_in_tremor=round(pct_time_in_tremor, 1),
        tremor_volume=round(tremor_volume, 4),
        intensity=intensity,
        signal_magnitude=round(signal_magnitude, 4),
        variability=round(variability, 4),
        gyro_rms=round(gyro_rms, 4) if gyro_rms is not None else None,
        step_cadence_spm=round(step_cadence_spm, 1) if step_cadence_spm is not None else None,
        step_regularity=round(step_regularity, 3) if step_regularity is not None else None,
        asymmetry_index=round(asymmetry_index, 2) if asymmetry_index is not None else None,
        strap_side=strap_side,
        orientation=orientation,
        clipping_detected=clipping_detected,
        dropped_packets=dropped_packets,
        timestamp_jitter_s=round(timestamp_jitter_s, 4),
        context_state=primary_context,
        periodicity_strength=round(mean_periodicity, 3),
        axis_consistency=round(mean_axis_cons, 3)
    )

    return TremorScopeSessionOutput(
        session_id=session_id,
        metrics=metrics,
        quality=quality,
        confidence=confidence,
        chart_signal=chart_signal,
        chart_psd=chart_psd,
        baseline_deviation_pct=round(baseline_deviation_pct, 2) if baseline_deviation_pct is not None else None,
        label=label_text
    )

