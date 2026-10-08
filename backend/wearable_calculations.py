"""
STEADY - Wearable Calculations Module
Implements Section 5 formulas:
- valid reading: alert == 0 and btn == 0
- valid_seconds: count(valid readings) / READINGS_PER_SECOND_EXPECTED
- tremor_share: count(valid tremor==1) / count(valid) as percentage (0-100), or None if no valid
- tremor_strength: mean rms over valid readings with tremor==1, or None if none
- rest_share: % of valid readings with rms < REST_RMS_G; active_share = 100 - rest_share
- monitored_minutes: sum over sessions of time covered by readings (ignoring gaps > 2s)
- baseline per person: median tremor_share & median tremor_strength across baseline sessions with valid_seconds >= BASELINE_MIN_VALID_SECONDS
- change_from_baseline: {type: 'difference'|'percent', value: float}
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple

from wearable_config import (
    READINGS_PER_SECOND_EXPECTED,
    REST_RMS_G,
    BASELINE_MIN_VALID_SECONDS,
    BASELINE_EPSILON,
)


def compute_session_metrics(readings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes summary metrics for a list of readings from a session.
    Readings with alert=1 or btn=1 are strictly excluded from statistics.
    """
    if not readings:
        return {
            "total_readings": 0,
            "valid_readings": 0,
            "valid_seconds": 0.0,
            "duration_s": 0.0,
            "tremor_share": None,
            "tremor_strength": None,
            "rest_share": None,
            "active_share": None,
            "mean_rms": None,
            "mean_freq": None,
        }

    total_readings = len(readings)
    
    # Calculate total duration from first to last timestamp or sample count
    if total_readings > 1 and "t_ms" in readings[0] and "t_ms" in readings[-1]:
        duration_s = max(0.0, (readings[-1]["t_ms"] - readings[0]["t_ms"]) / 1000.0)
    else:
        duration_s = total_readings / READINGS_PER_SECOND_EXPECTED

    # Valid readings filter: alert == 0 and btn == 0
    valid = [r for r in readings if int(r.get("alert", 0)) == 0 and int(r.get("btn", 0)) == 0]
    valid_count = len(valid)
    valid_seconds = round(valid_count / READINGS_PER_SECOND_EXPECTED, 1)

    if valid_count == 0:
        return {
            "total_readings": total_readings,
            "valid_readings": 0,
            "valid_seconds": 0.0,
            "duration_s": round(duration_s, 1),
            "tremor_share": None,
            "tremor_strength": None,
            "rest_share": None,
            "active_share": None,
            "mean_rms": None,
            "mean_freq": None,
        }

    # Tremor share (% of valid readings with tremor == 1)
    tremor_valid = [r for r in valid if int(r.get("tremor", 0)) == 1]
    tremor_count = len(tremor_valid)
    tremor_share = round((tremor_count / valid_count) * 100.0, 1)

    # Tremor strength: mean rms over valid readings with tremor == 1
    if tremor_count > 0:
        tremor_strength = round(float(np.mean([float(r.get("rms", 0.0)) for r in tremor_valid])), 4)
    else:
        tremor_strength = None

    # Rest share (% with rms < REST_RMS_G)
    rest_count = sum(1 for r in valid if float(r.get("rms", 0.0)) < REST_RMS_G)
    rest_share = round((rest_count / valid_count) * 100.0, 1)
    active_share = round(100.0 - rest_share, 1)

    # Overall means
    all_rms = [float(r.get("rms", 0.0)) for r in valid]
    all_freq = [float(r.get("freq", 0.0)) for r in valid if float(r.get("freq", 0.0)) > 0]
    mean_rms = round(float(np.mean(all_rms)), 4) if all_rms else None
    mean_freq = round(float(np.mean(all_freq)), 2) if all_freq else None

    return {
        "total_readings": total_readings,
        "valid_readings": valid_count,
        "valid_seconds": valid_seconds,
        "duration_s": round(duration_s, 1),
        "tremor_share": tremor_share,
        "tremor_strength": tremor_strength,
        "rest_share": rest_share,
        "active_share": active_share,
        "mean_rms": mean_rms,
        "mean_freq": mean_freq,
    }


def compute_change_from_baseline(
    value: Optional[float],
    baseline: Optional[float]
) -> Optional[Dict[str, Any]]:
    """
    Computes change from baseline:
    - If baseline is null or value is null: return null.
    - If baseline < BASELINE_EPSILON (for share as fraction, i.e. 1.0 percentage points), return difference.
    - Otherwise return relative percent change: ((value - baseline) / baseline) * 100.
    """
    if value is None or baseline is None:
        return None

    # BASELINE_EPSILON is 0.01 (which represents 1.0% in percentage scale 0-100)
    eps_threshold = 1.0

    if baseline <= eps_threshold:
        diff = value - baseline
        return {
            "type": "difference",
            "value": round(diff, 2),
            "formatted": f"{diff:+.1f} pts",
        }

    pct_change = ((value - baseline) / baseline) * 100.0
    return {
        "type": "percent",
        "value": round(pct_change, 1),
        "formatted": f"{pct_change:+.1f}%",
    }



def compute_monitored_minutes(sessions_readings: List[List[Dict[str, Any]]]) -> float:
    """
    Sum over sessions of the time covered by readings (ignoring gaps > 2 seconds).
    """
    total_covered_seconds = 0.0

    for readings in sessions_readings:
        if len(readings) < 2:
            continue
        
        # Sort by timestamp/t_ms
        sorted_r = sorted(readings, key=lambda r: r.get("t_ms", 0))
        for i in range(1, len(sorted_r)):
            dt = (sorted_r[i].get("t_ms", 0) - sorted_r[i - 1].get("t_ms", 0)) / 1000.0
            if 0 < dt <= 2.0:
                total_covered_seconds += dt
            elif dt <= 0:
                # Default 0.1s step if t_ms is missing/identical
                total_covered_seconds += 1.0 / READINGS_PER_SECOND_EXPECTED

    return round(total_covered_seconds / 60.0, 1)
