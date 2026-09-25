"""
STEADY AI - Freeze Index (Experimental) Module
Computes the Freezing of Gait (FOG) power ratio from live accelerometer data:
Freeze Index (FI) = Power(3–8 Hz) / Power(0.5–3 Hz)
Every output is explicitly flagged as experimental, maintaining the UI's
'I\'m frozen' button as the primary and reliable safety path.
"""

from typing import Union, Optional, Tuple, Dict, Any
import io
import numpy as np
import pandas as pd
from scipy.signal import welch

from .types import (
    FreezeIndexResult,
    SymptomSeverityTier,
    ConfidenceReport,
    ConfidenceTier,
    QualityIssue
)
from .confidence import score_motion_confidence


FREEZE_BAND_HZ = (3.0, 8.0)
LOCOMOTION_BAND_HZ = (0.5, 3.0)

# Typical literature thresholds for Freeze Index
FI_THRESHOLDS = {
    "low_risk": 1.5,
    "moderate_risk": 2.8,
    "high_risk": 2.8
}


def compute_freeze_index(
    data: Union[pd.DataFrame, bytes, str, np.ndarray],
    sample_rate_hz: float = 100.0,
    window_duration_s: Optional[float] = None
) -> FreezeIndexResult:
    """
    Computes the Freeze Index (FI) power spectral density ratio from 3-axis accelerometer stream.
    Strictly marked as experimental.
    """
    # 1. Parse input
    if isinstance(data, (bytes, bytearray)):
        df = pd.read_csv(io.BytesIO(data))
    elif isinstance(data, str):
        if "\n" in data or "," in data:
            df = pd.read_csv(io.StringIO(data))
        else:
            df = pd.read_csv(data)
    elif isinstance(data, np.ndarray):
        df = pd.DataFrame(data[:, :3], columns=["ax", "ay", "az"])
    elif isinstance(data, pd.DataFrame):
        df = data.copy()
    else:
        raise TypeError(f"Unsupported data type for Freeze Index: {type(data)}")

    df.columns = [str(c).strip().lower() for c in df.columns]

    req_cols = ["ax", "ay", "az"]
    for col in req_cols:
        if col not in df.columns:
            raise ValueError(f"Missing accelerometer column: {col}")
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=req_cols).reset_index(drop=True)
    if len(df) < 30:
        raise ValueError("Insufficient samples for spectral freeze index calculation (need >= 30 samples).")

    # Time column detection if present
    time_col = None
    for tc in ["time", "t", "timestamp", "time_s"]:
        if tc in df.columns:
            time_col = tc
            break

    if time_col is not None:
        df[time_col] = pd.to_numeric(df[time_col], errors="coerce")
        df = df.dropna(subset=[time_col]).reset_index(drop=True)
        time_vals = df[time_col].values
        dt_vals = np.diff(time_vals)
        mean_dt = float(np.mean(dt_vals)) if len(dt_vals) > 0 and np.mean(dt_vals) > 0 else 0.01
        fs = float(1.0 / mean_dt) if mean_dt > 0 else sample_rate_hz
        duration_s = float(time_vals[-1] - time_vals[0]) if len(time_vals) > 1 else len(df) / fs
    else:
        fs = sample_rate_hz
        duration_s = len(df) / fs

    # 2. Compute resultant acceleration magnitude & detrend
    ax, ay, az = df["ax"].values, df["ay"].values, df["az"].values
    a_mag = np.sqrt(ax**2 + ay**2 + az**2)
    a_detrend = a_mag - np.mean(a_mag)
    variability = float(np.std(a_mag))

    # 3. Welch PSD computation
    nperseg = min(len(a_detrend), max(32, int(fs * 2.0)))
    freqs, psd = welch(a_detrend, fs=fs, nperseg=nperseg)

    # 4. Integrate locomotion power (0.5 - 3.0 Hz) and freeze power (3.0 - 8.0 Hz)
    loco_mask = (freqs >= LOCOMOTION_BAND_HZ[0]) & (freqs <= LOCOMOTION_BAND_HZ[1])
    freeze_mask = (freqs >= FREEZE_BAND_HZ[0]) & (freqs <= FREEZE_BAND_HZ[1])

    def integrate(f_mask: np.ndarray) -> float:
        if not np.any(f_mask):
            return 1e-6
        f_sub = freqs[f_mask]
        p_sub = psd[f_mask]
        if hasattr(np, "trapezoid"):
            return float(np.trapezoid(p_sub, f_sub))
        return float(np.trapz(p_sub, f_sub))

    locomotion_power = max(1e-6, integrate(loco_mask))
    freeze_power = max(1e-6, integrate(freeze_mask))

    freeze_index = float(freeze_power / locomotion_power)

    # 5. Risk Tier evaluation
    if freeze_index < FI_THRESHOLDS["low_risk"]:
        risk_tier = SymptomSeverityTier.MILD
    elif freeze_index < FI_THRESHOLDS["moderate_risk"]:
        risk_tier = SymptomSeverityTier.MODERATE
    else:
        risk_tier = SymptomSeverityTier.HIGH

    # 6. Confidence Report
    conf_report = score_motion_confidence(
        duration_s=duration_s,
        variability=variability,
        missing_samples_pct=0.0,
        sample_rate_hz=fs
    )

    return FreezeIndexResult(
        freeze_index_ratio=round(freeze_index, 3),
        locomotion_power=round(locomotion_power, 6),
        freeze_power=round(freeze_power, 6),
        freeze_risk_tier=risk_tier,
        is_experimental=True,
        disclaimer="Experimental indicator. The 'I\'m frozen' button is the primary and reliable safety path.",
        confidence=conf_report
    )
