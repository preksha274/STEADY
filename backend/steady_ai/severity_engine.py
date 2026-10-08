"""
STEADY AI - Movement Severity & Threshold Engine
Evaluates movement severity level (GOOD, MODERATE, HIGH, NO_DATA) based on:
1. Movement Tremor Ratio (tremor seconds / tracked seconds)
2. Live Sustained Tremor Duration (seconds)
3. Data Quality / Reliability (% assessed samples)
4. Active Family Alert state

All thresholds are loaded from backend/config/severity_config.json.
Movement-only and strictly non-clinical.
"""

import os
import json
from typing import Dict, Any, Optional, Tuple

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config", "severity_config.json")


def load_severity_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[SEVERITY ENGINE] Failed to load config: {e}")
            
    # Fallback defaults matching specification
    return {
        "version": "1.0.0",
        "tremor_ratio_thresholds": {
            "good_max_pct": 15.0,
            "moderate_max_pct": 30.0
        },
        "sustained_tremor_seconds": {
            "moderate_min_s": 10.0,
            "high_min_s": 30.0
        },
        "data_quality_pct": {
            "good_min_pct": 90.0,
            "moderate_min_pct": 70.0
        }
    }


def evaluate_movement_severity(
    tremor_ratio_pct: Optional[float],
    tracked_seconds: float = 0.0,
    sustained_tremor_s: float = 0.0,
    has_active_alert: bool = False,
    time_label: str = "today",
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluates severity level: GOOD | MODERATE | HIGH | NO_DATA.
    """
    cfg = config or load_severity_config()
    ratio_thresh = cfg.get("tremor_ratio_thresholds", {"good_max_pct": 15.0, "moderate_max_pct": 30.0})
    sustained_thresh = cfg.get("sustained_tremor_seconds", {"moderate_min_s": 10.0, "high_min_s": 30.0})
    
    # 1. Check for NO DATA
    if tracked_seconds <= 0 or tremor_ratio_pct is None:
        return {
            "level": "NO_DATA",
            "label": "No data",
            "status": "no_data",
            "reason": f"No telemetry recorded for {time_label}",
            "color": "slate",
            "hex": "#64748B",
            "icon": "help-circle"
        }

    # 2. Check HIGH criteria:
    # ratio > 30% OR sustained tremor > 30s OR active family alert
    if tremor_ratio_pct > ratio_thresh.get("moderate_max_pct", 30.0) or sustained_tremor_s >= sustained_thresh.get("high_min_s", 30.0) or has_active_alert:
        if has_active_alert:
            reason = "High: active family alert triggered"
        elif sustained_tremor_s >= sustained_thresh.get("high_min_s", 30.0):
            reason = f"High: sustained tremor-like movement for {int(sustained_tremor_s)}s"
        else:
            reason = f"High: tremor-like movement for {tremor_ratio_pct:.1f}% of {time_label}"
            
        return {
            "level": "HIGH",
            "label": "High - check on them",
            "status": "high",
            "reason": reason,
            "color": "rose",
            "hex": "#E11D48",
            "icon": "alert-octagon"
        }

    # 3. Check MODERATE criteria:
    # ratio 15% to 30% OR sustained tremor 10 to 30s
    if tremor_ratio_pct >= ratio_thresh.get("good_max_pct", 15.0) or sustained_tremor_s >= sustained_thresh.get("moderate_min_s", 10.0):
        if sustained_tremor_s >= sustained_thresh.get("moderate_min_s", 10.0):
            reason = f"Moderate: tremor-like movement sustained for {int(sustained_tremor_s)}s"
        else:
            reason = f"Moderate: tremor-like movement for {tremor_ratio_pct:.1f}% of {time_label}"
            
        return {
            "level": "MODERATE",
            "label": "Moderate",
            "status": "moderate",
            "reason": reason,
            "color": "amber",
            "hex": "#D97706",
            "icon": "alert-triangle"
        }

    # 4. Otherwise GOOD (< 15% and no sustained live tremor)
    return {
        "level": "GOOD",
        "label": "Good",
        "status": "good",
        "reason": f"Good: tremor-like movement at {tremor_ratio_pct:.1f}% of {time_label}",
        "color": "emerald",
        "hex": "#059669",
        "icon": "check-circle-2"
    }


def evaluate_quality_severity(
    quality_pct: Optional[float],
    total_samples: int = 0,
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluates data quality reliability: >=90% GOOD, 70-90% MODERATE, <70% HIGH (low reliability).
    """
    if total_samples <= 0 or quality_pct is None:
        return {
            "level": "NO_DATA",
            "label": "No data",
            "color": "slate",
            "hex": "#64748B",
            "icon": "help-circle"
        }

    cfg = config or load_severity_config()
    quality_thresh = cfg.get("data_quality_pct", {"good_min_pct": 90.0, "moderate_min_pct": 70.0})

    if quality_pct >= quality_thresh.get("good_min_pct", 90.0):
        return {
            "level": "GOOD",
            "label": "High Reliability",
            "color": "emerald",
            "hex": "#059669",
            "icon": "check-circle-2"
        }
    elif quality_pct >= quality_thresh.get("moderate_min_pct", 70.0):
        return {
            "level": "MODERATE",
            "label": "Moderate Reliability",
            "color": "amber",
            "hex": "#D97706",
            "icon": "alert-triangle"
        }
    else:
        return {
            "level": "HIGH",
            "label": "Low Reliability - Gaps Detected",
            "color": "rose",
            "hex": "#E11D48",
            "icon": "alert-octagon"
        }
