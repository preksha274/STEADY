import io
import math
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, welch

app = FastAPI(title="MovePilot Backend API", version="1.0.0")

# Enable CORS for frontend on :3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tremor Intensity Config Dict
TREMOR_CONFIG = {
    "band_hz": (3.0, 8.0),
    "thresholds": {
        "mild": 0.08,      # RMS < 0.08 m/s^2
        "moderate": 0.25,  # 0.08 <= RMS < 0.25 m/s^2
        "high": 0.25,      # RMS >= 0.25 m/s^2
    }
}

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "MovePilot Backend API",
        "version": "1.0.0"
    }

@app.post("/analyze/imu")
async def analyze_imu(file: UploadFile = File(...)):
    # Validate file format
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a CSV file."
        )

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty."
        )

    # Normalize column names (strip whitespace & lowercase)
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Validate required accelerometer columns: ax, ay, az
    req_cols = ["ax", "ay", "az"]
    missing_req = [c for c in req_cols if c not in df.columns]
    if missing_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required accelerometer column(s): {', '.join(missing_req)}. CSV must contain ax, ay, az columns."
        )

    initial_row_count = len(df)

    # Convert required columns to numeric
    for col in req_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop NaNs in required columns
    df = df.dropna(subset=req_cols).reset_index(drop=True)
    clean_row_count = len(df)

    if clean_row_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no valid numeric rows for ax, ay, az."
        )

    missing_samples_pct = float(max(0.0, ((initial_row_count - clean_row_count) / max(1, initial_row_count)) * 100.0))

    # Time & sampling rate calculation
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
        sample_rate_hz = float(1.0 / mean_dt) if mean_dt > 0 else 100.0
        duration_s = float(time_vals[-1] - time_vals[0]) if len(time_vals) > 1 else 0.0
    else:
        sample_rate_hz = 100.0
        duration_s = float(len(df) / sample_rate_hz)
        time_vals = np.arange(len(df)) / sample_rate_hz

    # Validate duration (>= 5.0 seconds required)
    if duration_s < 5.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recording duration ({duration_s:.2f}s) is too short. At least 5 seconds of IMU data is required."
        )

    # Compute acceleration magnitude
    ax, ay, az = df["ax"].values, df["ay"].values, df["az"].values
    a_mag = np.sqrt(ax**2 + ay**2 + az**2)

    signal_magnitude = float(np.mean(a_mag))
    variability = float(np.std(a_mag))

    # Remove mean (detrend)
    a_detrend = a_mag - signal_magnitude

    # Apply bandpass filter (0.5 to 15 Hz)
    nyq = sample_rate_hz / 2.0
    low_cut = 0.5 / nyq
    high_cut = min(15.0, nyq - 0.1) / nyq

    if low_cut < high_cut and high_cut > 0:
        b, a = butter(3, [low_cut, high_cut], btype="bandpass")
        a_filtered = filtfilt(b, a, a_detrend)
    else:
        a_filtered = a_detrend

    # Tremor analysis via Welch's PSD
    nperseg = min(len(a_filtered), max(64, int(sample_rate_hz * 4)))
    freqs, psd = welch(a_filtered, fs=sample_rate_hz, nperseg=nperseg)

    # 3-8 Hz Tremor Band
    tremor_min_hz, tremor_max_hz = TREMOR_CONFIG["band_hz"]
    tremor_mask = (freqs >= tremor_min_hz) & (freqs <= tremor_max_hz)

    if np.any(tremor_mask):
        tremor_freqs = freqs[tremor_mask]
        tremor_psd = psd[tremor_mask]
        max_idx = np.argmax(tremor_psd)
        tremor_frequency_hz = float(tremor_freqs[max_idx])

        # Integrate PSD in 3-8 Hz band
        if hasattr(np, "trapezoid"):
            area = float(np.trapezoid(tremor_psd, tremor_freqs))
        else:
            area = float(np.trapz(tremor_psd, tremor_freqs))
        tremor_amplitude = float(np.sqrt(max(0.0, area)))
    else:
        tremor_frequency_hz = 0.0
        tremor_amplitude = 0.0

    # Categorize Tremor Intensity
    if tremor_amplitude < TREMOR_CONFIG["thresholds"]["mild"]:
        intensity = "mild"
    elif tremor_amplitude < TREMOR_CONFIG["thresholds"]["moderate"]:
        intensity = "moderate"
    else:
        intensity = "high"

    # Gyroscope RMS if present
    gyro_rms = None
    gyro_cols = ["gx", "gy", "gz"]
    if all(gc in df.columns for gc in gyro_cols):
        for gc in gyro_cols:
            df[gc] = pd.to_numeric(df[gc], errors="coerce")
        df_g = df.dropna(subset=gyro_cols)
        if len(df_g) > 0:
            g_mag = np.sqrt(df_g["gx"].values**2 + df_g["gy"].values**2 + df_g["gz"].values**2)
            gyro_rms = float(np.sqrt(np.mean(g_mag**2)))

    # Quality & Confidence
    is_short = duration_s < 10.0
    is_noisy = variability > 3.0 or missing_samples_pct > 5.0

    if duration_s >= 10.0 and not is_noisy:
        confidence = "high"
        confidence_reason = f"Sufficient recording length ({duration_s:.1f}s) with steady baseline"
    elif duration_s >= 5.0 and not is_noisy:
        confidence = "medium"
        confidence_reason = f"Recording duration ({duration_s:.1f}s) is slightly short (<10s) but signal is clean"
    else:
        confidence = "low"
        confidence_reason = f"Short duration ({duration_s:.1f}s) or high signal noise detected"

    # Downsample signal for charting
    num_points = len(time_vals)
    step = max(1, num_points // 1000)
    chart_signal = [
        {
            "time_s": round(float(t), 3),
            "raw_magnitude": round(float(m), 4),
            "filtered_magnitude": round(float(fm), 4),
        }
        for t, m, fm in zip(time_vals[::step], a_mag[::step], a_filtered[::step])
    ]

    # PSD Charting Data (up to 15 Hz)
    psd_mask = (freqs >= 0.0) & (freqs <= 15.0)
    psd_chart = [
        {
            "freq_hz": round(float(f), 2),
            "power": round(float(p), 6),
        }
        for f, p in zip(freqs[psd_mask], psd[psd_mask])
    ]

    return {
        "metrics": {
            "tremor_frequency_hz": round(tremor_frequency_hz, 2),
            "tremor_amplitude": round(tremor_amplitude, 4),
            "intensity": intensity,
            "signal_magnitude": round(signal_magnitude, 4),
            "variability": round(variability, 4),
            "gyro_rms": round(gyro_rms, 4) if gyro_rms is not None else None,
        },
        "quality": {
            "duration_s": round(duration_s, 2),
            "sample_rate_hz": round(sample_rate_hz, 1),
            "missing_samples_pct": round(missing_samples_pct, 2),
            "is_short": is_short,
            "is_noisy": is_noisy,
        },
        "confidence": confidence,
        "confidence_reason": confidence_reason,
        "chart_data": {
            "signal": chart_signal,
            "psd": psd_chart,
        },
    }


@app.post("/analyze/eeg")
async def analyze_eeg(
    file: UploadFile = File(...),
    sample_rate_hz: Optional[float] = Form(None)
):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a CSV file."
        )

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty."
        )

    # Normalize column names
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Time column detection & sample rate calculation
    time_col = None
    for tc in ["time", "t", "timestamp", "time_s", "time(s)"]:
        if tc in df.columns:
            time_col = tc
            break

    time_vals = None
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recording duration ({duration_s:.2f}s) is too short. At least 3 seconds of EEG data is required."
        )

    # Identify channel columns (numeric columns except time)
    non_time_cols = [c for c in df.columns if c != time_col]
    channel_cols = []
    for col in non_time_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].notna().sum() > 0:
            channel_cols.append(col)

    if not channel_cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid EEG channel columns found in CSV file."
        )

    # Drop NaNs across channels
    df = df.dropna(subset=channel_cols).reset_index(drop=True)

    # Quality checks
    flat_channels = []
    artifact_channels = []
    psd_list = []
    freqs_ref = None

    channel_stds = []
    for ch in channel_cols:
        sig = df[ch].values
        std_val = float(np.std(sig))
        max_abs = float(np.max(np.abs(sig)))
        channel_stds.append(std_val)

        if std_val < 1e-6:
            flat_channels.append(ch)

        if max_abs > 500.0:  # > 500 uV extreme artifact
            artifact_channels.append(ch)

    # Check for relative artifact outliers (>10x median std)
    med_std = float(np.median(channel_stds)) if channel_stds else 1.0
    for ch, std_val in zip(channel_cols, channel_stds):
        if std_val > 10.0 * med_std and ch not in artifact_channels:
            artifact_channels.append(ch)

    # Compute Welch's PSD per channel
    valid_channels = [ch for ch in channel_cols if ch not in flat_channels]
    if not valid_channels:
        valid_channels = channel_cols  # fallback

    for ch in valid_channels:
        sig = df[ch].values
        # Detrend
        sig_detrend = sig - np.mean(sig)
        nperseg = min(len(sig_detrend), max(128, int(fs * 4)))
        freqs, psd_ch = welch(sig_detrend, fs=fs, nperseg=nperseg)
        freqs_ref = freqs
        psd_list.append(psd_ch)

    # Average PSD across valid channels
    avg_psd = np.mean(psd_list, axis=0)

    # Check for strong 50/60 Hz line noise
    line_noise_present = False
    for line_f in [50.0, 60.0]:
        mask_line = (freqs_ref >= line_f - 1.0) & (freqs_ref <= line_f + 1.0)
        mask_bg = (freqs_ref >= line_f - 5.0) & (freqs_ref <= line_f + 5.0) & (~mask_line)
        if np.any(mask_line) and np.any(mask_bg):
            peak_power = float(np.max(avg_psd[mask_line]))
            bg_power = float(np.mean(avg_psd[mask_bg]))
            if bg_power > 0 and (peak_power / bg_power) > 5.0:
                line_noise_present = True

    # Helper function for band integration
    def get_band_power(f_low: float, f_high: float):
        mask = (freqs_ref >= f_low) & (freqs_ref <= f_high)
        if not np.any(mask):
            return 0.0
        if hasattr(np, "trapezoid"):
            return float(np.trapezoid(avg_psd[mask], freqs_ref[mask]))
        else:
            return float(np.trapz(avg_psd[mask], freqs_ref[mask]))

    # Absolute Band Powers
    delta_abs = get_band_power(0.5, 4.0)
    theta_abs = get_band_power(4.0, 8.0)
    alpha_abs = get_band_power(8.0, 13.0)
    beta_abs = get_band_power(13.0, 30.0)

    total_power = get_band_power(0.5, 30.0)
    total_safe = max(total_power, 1e-12)

    # Relative Band Powers
    delta_rel = float(delta_abs / total_safe)
    theta_rel = float(theta_abs / total_safe)
    alpha_rel = float(alpha_abs / total_safe)
    beta_rel = float(beta_abs / total_safe)

    # Confidence calculation
    is_short = duration_s < 10.0
    if not flat_channels and not artifact_channels and not line_noise_present and not is_short:
        confidence = "high"
        confidence_reason = f"Clean multi-channel EEG signal ({duration_s:.1f}s) without major artifacts"
    elif not flat_channels and len(artifact_channels) <= 1:
        confidence = "medium"
        confidence_reason = f"Good signal ({duration_s:.1f}s) with minor noise or short recording duration"
    else:
        confidence = "low"
        reasons = []
        if flat_channels:
            reasons.append(f"flat channels ({', '.join(flat_channels)})")
        if artifact_channels:
            reasons.append(f"artifact channels ({', '.join(artifact_channels)})")
        if line_noise_present:
            reasons.append("strong 50/60Hz line noise")
        if is_short:
            reasons.append("short duration")
        confidence_reason = f"Quality warnings: {', '.join(reasons)}"

    # Charting data: PSD up to 30 Hz
    chart_mask = (freqs_ref >= 0.0) & (freqs_ref <= 30.0)
    psd_chart = [
        {
            "freq_hz": round(float(f), 2),
            "power": round(float(p), 6),
        }
        for f, p in zip(freqs_ref[chart_mask], avg_psd[chart_mask])
    ]

    return {
        "channel_count": len(channel_cols),
        "channels": channel_cols,
        "band_powers": {
            "delta": {
                "absolute": round(delta_abs, 4),
                "relative": round(delta_rel, 4),
                "band_hz": [0.5, 4.0],
            },
            "theta": {
                "absolute": round(theta_abs, 4),
                "relative": round(theta_rel, 4),
                "band_hz": [4.0, 8.0],
            },
            "alpha": {
                "absolute": round(alpha_abs, 4),
                "relative": round(alpha_rel, 4),
                "band_hz": [8.0, 13.0],
            },
            "beta": {
                "absolute": round(beta_abs, 4),
                "relative": round(beta_rel, 4),
                "band_hz": [13.0, 30.0],
            },
            "total_power_0_5_30hz": round(total_power, 4),
        },
        "quality": {
            "duration_s": round(duration_s, 2),
            "sample_rate_hz": round(fs, 1),
            "flat_channels": flat_channels,
            "artifact_channels": artifact_channels,
            "line_noise_present": line_noise_present,
            "is_short": is_short,
        },
        "confidence": confidence,
        "confidence_reason": confidence_reason,
        "chart_data": {
            "psd": psd_chart,
        },
    }
