"""
STEADY AI - Wearable Sample Storage & Aggregation Engine
Handles:
1. Validating incoming telemetry samples and tracking bad lines.
2. Filtering out simulated samples (tagged source="simulated").
3. Attaching server UTC timestamps and active Session IDs.
4. Persisting raw samples into gzip-compressed files in storage_db/raw_wearable/.
5. Calculating and storing rolling per-minute aggregates in storage_db/wearable_summaries.json.
6. Calculating strictly bounded tremor ratios (0 - 100%) from real sample timestamps.
7. Providing summary and timeseries query endpoints with severity evaluations.
"""

import os
import gzip
import json
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from steady_ai.severity_engine import evaluate_movement_severity, evaluate_quality_severity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_DB_DIR = os.path.join(BASE_DIR, "storage_db")
RAW_STORAGE_DIR = os.path.join(STORAGE_DB_DIR, "raw_wearable")
SUMMARIES_FILE = os.path.join(STORAGE_DB_DIR, "wearable_summaries.json")

os.makedirs(STORAGE_DB_DIR, exist_ok=True)
os.makedirs(RAW_STORAGE_DIR, exist_ok=True)


class WearableStorageService:
    def __init__(self):
        self.active_session_id: str = f"wearable_ses_{uuid.uuid4().hex[:10]}"
        self.session_started_at_utc: str = datetime.now(timezone.utc).isoformat()
        self.bad_lines_count: int = 0
        self.total_processed_samples: int = 0
        self.last_ms: Optional[int] = None
        
        # Sustained tremor tracking (live in-memory)
        self.sustained_tremor_samples: int = 0
        self.max_sustained_tremor_seconds: float = 0.0
        
        # In-memory buffer for compression flush (every ~1000 samples or 30s)
        self.raw_flush_buffer: List[Dict[str, Any]] = []
        self.last_raw_flush_time: float = time.time()
        
        # Minute aggregator buffer
        self.current_minute_buffer: List[Dict[str, Any]] = []
        self.current_minute_start_utc: str = datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat()
        
        self.summaries: List[Dict[str, Any]] = self._load_summaries()

    def get_current_session_id(self) -> str:
        return self.active_session_id

    def renew_session(self) -> str:
        self.flush_raw_buffer()
        self.active_session_id = f"wearable_ses_{uuid.uuid4().hex[:10]}"
        self.session_started_at_utc = datetime.now(timezone.utc).isoformat()
        self.sustained_tremor_samples = 0
        self.max_sustained_tremor_seconds = 0.0
        return self.active_session_id

    def _load_summaries(self) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(SUMMARIES_FILE):
                with open(SUMMARIES_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        # Migrate older summaries if needed
                        valid = []
                        for s in data:
                            if "tracked_seconds" not in s:
                                # Fix seed/legacy records
                                is_seed = "seed" in s.get("session_id", "")
                                s["tracked_seconds"] = 3600.0 if is_seed else 60.0
                                s["tremor_seconds"] = (s.get("tremor_pct", 10.0) / 100.0) * s["tracked_seconds"]
                                s["tremor_minutes"] = round(s["tremor_seconds"] / 60.0, 2)
                                s["tracked_minutes"] = round(s["tracked_seconds"] / 60.0, 2)
                            valid.append(s)
                        return valid
        except Exception as e:
            print(f"[WEARABLE STORAGE] Failed to load summaries: {e}")
        
        # Generate clean historical seed summaries
        seeded = self._generate_seed_wearable_summaries()
        self._save_summaries(seeded)
        return seeded

    def _save_summaries(self, data: List[Dict[str, Any]]) -> None:
        try:
            with open(SUMMARIES_FILE, "w", encoding="utf-8") as f:
                json.dump(data[-10000:], f, indent=2)
        except Exception as e:
            print(f"[WEARABLE STORAGE] Failed to save summaries: {e}")

    def _generate_seed_wearable_summaries(self) -> List[Dict[str, Any]]:
        """Generate historical per-hour summaries spanning 30 days (720 hours)."""
        now = datetime.now(timezone.utc)
        summaries = []
        session_id = "wearable_ses_historical_seed"
        
        for i in range(720, 0, -1):
            t = now - timedelta(hours=i)
            hour = t.hour
            # Circadian tremor pattern (range 0.05 to 0.25g)
            amp = max(0.04, float(0.12 + 0.08 * np.sin((hour - 8) * np.pi / 12) + np.random.uniform(-0.02, 0.02)))
            freq = round(float(np.random.uniform(4.7, 5.3)), 2)
            
            # Tremor ratio is between 2% and 28%
            tremor_pct = max(2.0, min(28.0, float(amp * 110 + np.random.uniform(-3, 3))))
            
            tracked_seconds = 3600.0  # 1 hour = 3600s
            tremor_seconds = round((tremor_pct / 100.0) * tracked_seconds, 2)
            tremor_minutes = round(tremor_seconds / 60.0, 2)
            
            summaries.append({
                "session_id": session_id,
                "minute_start_utc": t.replace(minute=0, second=0, microsecond=0).isoformat(),
                "sample_count": 6000,
                "assessed_sample_count": 5800,
                "tracked_seconds": tracked_seconds,
                "tracked_minutes": 60.0,
                "tremor_seconds": tremor_seconds,
                "tremor_minutes": tremor_minutes,
                "tremor_pct": round(tremor_pct, 1),
                "mean_amplitude_g": round(amp, 4),
                "max_amplitude_g": round(amp * 1.4, 4),
                "dominant_freq_hz": freq,
                "not_assessed_pct": round(float(np.random.uniform(1.0, 3.5)), 1),
                "bad_lines_count": int(np.random.randint(0, 2)),
                "drops_count": int(np.random.randint(0, 4)),
            })
        return summaries

    def validate_and_enrich_sample(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Validates sample schema, injects server UTC timestamp and session ID.
        Excludes samples tagged with source="simulated".
        Returns enriched dict or None if invalid/simulated.
        """
        try:
            # 1. Strictly exclude simulated test data from history & persistence
            if raw.get("source") == "simulated" or raw.get("is_simulated") is True:
                return None

            ms = int(raw.get("ms", raw.get("time", raw.get("t_ms", 0))))
            ax = float(raw.get("ax", raw.get("x", 0.0)))
            ay = float(raw.get("ay", raw.get("y", 0.0)))
            az = float(raw.get("az", raw.get("z", 1.0)))
            hp = float(raw.get("hp", 0.0))
            rms = float(raw.get("rms", 0.0))
            freq = float(raw.get("freq", raw.get("f", 0.0)))
            tremor = int(raw.get("tremor", raw.get("t", 0)))
            state = int(raw.get("state", raw.get("s", 0)))
            drops = int(raw.get("drops", raw.get("d", 0)))
            
            # Physical bounds check for ±16g accelerometer range
            if not (-16.0 <= ax <= 16.0 and -16.0 <= ay <= 16.0 and -16.0 <= az <= 16.0):
                self.bad_lines_count += 1
                return None

            now_utc = datetime.now(timezone.utc).isoformat()
            is_assessed = (state not in (1, 2, 4))  # Exclude vibrating, cooldown, sensor error
            
            # Live sustained tremor duration tracking
            if is_assessed and tremor == 1:
                self.sustained_tremor_samples += 1
                current_sustained_s = self.sustained_tremor_samples * 0.01  # 10ms per sample
                if current_sustained_s > self.max_sustained_tremor_seconds:
                    self.max_sustained_tremor_seconds = current_sustained_s
            elif is_assessed and tremor == 0:
                self.sustained_tremor_samples = 0
            
            return {
                "session_id": self.active_session_id,
                "server_timestamp_utc": now_utc,
                "ms": ms,
                "ax": round(ax, 4),
                "ay": round(ay, 4),
                "az": round(az, 4),
                "hp": round(hp, 4),
                "rms": round(rms, 4),
                "freq": round(freq, 2),
                "tremor": 1 if tremor else 0,
                "state": state,
                "drops": drops,
                "assessed": is_assessed,
            }
        except Exception:
            self.bad_lines_count += 1
            return None

    def ingest_samples(self, raw_samples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process, enrich, validate, and buffer samples for compressed storage and minute aggregation.
        """
        valid_samples = []
        for s in raw_samples:
            enriched = self.validate_and_enrich_sample(s)
            if enriched:
                valid_samples.append(enriched)
                self.raw_flush_buffer.append(enriched)
                self.current_minute_buffer.append(enriched)
                self.total_processed_samples += 1

        # Chunk flush (every 1000 samples or 30 seconds)
        now = time.time()
        if len(self.raw_flush_buffer) >= 1000 or (now - self.last_raw_flush_time >= 30.0 and len(self.raw_flush_buffer) > 0):
            self.flush_raw_buffer()

        # Minute aggregate flush (every 60s)
        current_minute = datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat()
        if current_minute != self.current_minute_start_utc and len(self.current_minute_buffer) >= 10:
            self._flush_minute_summary(self.current_minute_start_utc)
            self.current_minute_start_utc = current_minute

        return valid_samples

    def flush_raw_buffer(self) -> None:
        if not self.raw_flush_buffer:
            return
        
        try:
            timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"{self.active_session_id}_{timestamp_str}_{uuid.uuid4().hex[:6]}.json.gz"
            filepath = os.path.join(RAW_STORAGE_DIR, filename)
            
            json_lines = "\n".join([json.dumps(s) for s in self.raw_flush_buffer])
            with gzip.open(filepath, "wt", encoding="utf-8") as gz_file:
                gz_file.write(json_lines)
            
            self.raw_flush_buffer = []
            self.last_raw_flush_time = time.time()
        except Exception as e:
            print(f"[WEARABLE STORAGE] Raw compression flush error: {e}")

    def _flush_minute_summary(self, minute_utc_str: str) -> None:
        if not self.current_minute_buffer:
            return
        
        total = len(self.current_minute_buffer)
        assessed = [s for s in self.current_minute_buffer if s["assessed"]]
        assessed_count = len(assessed)
        not_assessed_pct = ((total - assessed_count) / max(1, total)) * 100.0
        
        # Calculate tracked seconds from timestamps or sample dt
        if len(self.current_minute_buffer) > 1:
            ms_list = [s["ms"] for s in self.current_minute_buffer if "ms" in s]
            if ms_list and (max(ms_list) - min(ms_list)) > 0:
                tracked_seconds = round((max(ms_list) - min(ms_list)) / 1000.0, 2)
            else:
                tracked_seconds = round(total * 0.01, 2)
        else:
            tracked_seconds = round(total * 0.01, 2)

        # Tremor seconds from assessed tremor sample count
        tremor_samples = sum(1 for s in assessed if s["tremor"] == 1)
        tremor_ratio_fraction = (tremor_samples / max(1, assessed_count)) if assessed_count > 0 else 0.0
        tremor_seconds = round(tremor_ratio_fraction * tracked_seconds, 2)
        tremor_pct = round(min(100.0, max(0.0, tremor_ratio_fraction * 100.0)), 1)
        tremor_minutes = round(tremor_seconds / 60.0, 3)
        tracked_minutes = round(tracked_seconds / 60.0, 3)
        
        amplitudes = [s["rms"] for s in assessed]
        mean_amp = float(np.mean(amplitudes)) if amplitudes else 0.0
        max_amp = float(np.max(amplitudes)) if amplitudes else 0.0
        
        freqs = [s["freq"] for s in assessed if s["freq"] > 0]
        dominant_freq = float(np.median(freqs)) if freqs else 0.0
        
        last_drops = self.current_minute_buffer[-1].get("drops", 0)
        
        summary_doc = {
            "session_id": self.active_session_id,
            "minute_start_utc": minute_utc_str,
            "sample_count": total,
            "assessed_sample_count": assessed_count,
            "tracked_seconds": tracked_seconds,
            "tracked_minutes": tracked_minutes,
            "tremor_seconds": tremor_seconds,
            "tremor_minutes": tremor_minutes,
            "tremor_pct": tremor_pct,
            "mean_amplitude_g": round(mean_amp, 4),
            "max_amplitude_g": round(max_amp, 4),
            "dominant_freq_hz": round(dominant_freq, 2),
            "not_assessed_pct": round(not_assessed_pct, 1),
            "bad_lines_count": self.bad_lines_count,
            "drops_count": last_drops,
        }
        
        self.summaries.append(summary_doc)
        self._save_summaries(self.summaries)
        self.current_minute_buffer = []

    def get_summary(self, time_range: str = "day") -> Dict[str, Any]:
        """
        Aggregate summary metrics strictly with:
        - tremor ratio = (tremor seconds / tracked seconds) * 100%, strictly bounded [0, 100]%
        - tracked duration from real timestamps
        - severity level evaluated according to config
        """
        filtered = self._filter_by_range(self.summaries, time_range)
        
        if not filtered:
            severity = evaluate_movement_severity(
                tremor_ratio_pct=None,
                tracked_seconds=0.0,
                time_label=time_range
            )
            quality_sev = evaluate_quality_severity(None, total_samples=0)
            return {
                "range": time_range,
                "has_data": False,
                "session_id": self.active_session_id,
                "session_started_at_utc": self.session_started_at_utc,
                "total_tracked_seconds": 0.0,
                "total_minutes_tracked": 0.0,
                "total_tremor_seconds": 0.0,
                "total_tremor_minutes": 0.0,
                "overall_tremor_pct": 0.0,
                "average_amplitude_g": 0.0,
                "peak_amplitude_g": 0.0,
                "average_dominant_freq_hz": 0.0,
                "total_samples": 0,
                "bad_lines_count": self.bad_lines_count,
                "data_quality_pct": 0.0,
                "records_count": 0,
                "severity": severity,
                "quality_severity": quality_sev,
            }
        
        total_samples = sum(s.get("sample_count", 0) for s in filtered)
        assessed_samples = sum(s.get("assessed_sample_count", 0) for s in filtered)
        
        # Calculate tracked seconds and tremor seconds precisely
        total_tracked_seconds = sum(s.get("tracked_seconds", s.get("tracked_minutes", 60.0 if "seed" in s.get("session_id", "") else 1.0) * 60.0) for s in filtered)
        total_tremor_seconds = sum(s.get("tremor_seconds", s.get("tremor_minutes", 0.0) * 60.0) for s in filtered)
        
        total_minutes_tracked = round(total_tracked_seconds / 60.0, 1)
        total_tremor_minutes = round(total_tremor_seconds / 60.0, 1)
        
        if total_tracked_seconds > 0:
            overall_tremor_pct = min(100.0, max(0.0, (total_tremor_seconds / total_tracked_seconds) * 100.0))
        else:
            overall_tremor_pct = 0.0
        
        amps = [s["mean_amplitude_g"] for s in filtered if s.get("mean_amplitude_g", 0) > 0]
        max_amps = [s["max_amplitude_g"] for s in filtered if s.get("max_amplitude_g", 0) > 0]
        freqs = [s["dominant_freq_hz"] for s in filtered if s.get("dominant_freq_hz", 0) > 0]
        
        avg_amp = float(np.mean(amps)) if amps else 0.0
        peak_amp = float(np.max(max_amps)) if max_amps else 0.0
        avg_freq = float(np.mean(freqs)) if freqs else 0.0
        
        quality_pct = (assessed_samples / max(1, total_samples)) * 100.0 if total_samples > 0 else 0.0

        # Movement & Quality severity evaluation
        severity = evaluate_movement_severity(
            tremor_ratio_pct=round(overall_tremor_pct, 1),
            tracked_seconds=total_tracked_seconds,
            sustained_tremor_s=self.max_sustained_tremor_seconds,
            time_label=time_range
        )
        quality_sev = evaluate_quality_severity(quality_pct, total_samples=total_samples)

        return {
            "range": time_range,
            "has_data": total_samples > 0,
            "session_id": self.active_session_id,
            "session_started_at_utc": self.session_started_at_utc,
            "total_tracked_seconds": round(total_tracked_seconds, 1),
            "total_minutes_tracked": total_minutes_tracked,
            "total_tremor_seconds": round(total_tremor_seconds, 1),
            "total_tremor_minutes": total_tremor_minutes,
            "overall_tremor_pct": round(overall_tremor_pct, 1),
            "average_amplitude_g": round(avg_amp, 4),
            "peak_amplitude_g": round(peak_amp, 4),
            "average_dominant_freq_hz": round(avg_freq, 2),
            "total_samples": total_samples,
            "bad_lines_count": self.bad_lines_count,
            "data_quality_pct": round(quality_pct, 1),
            "records_count": len(filtered),
            "severity": severity,
            "quality_severity": quality_sev,
        }

    def get_series(self, time_range: str = "day") -> List[Dict[str, Any]]:
        """
        Return timeseries data points for charts over range=day|week|month|all.
        Enriches each point with its individual movement severity.
        """
        filtered = self._filter_by_range(self.summaries, time_range)
        
        # Enrich points with severity status for bar charting
        enriched = []
        for pt in filtered:
            ratio = pt.get("tremor_pct", 0.0)
            tracked_s = pt.get("tracked_seconds", 60.0)
            pt_sev = evaluate_movement_severity(ratio, tracked_seconds=tracked_s, time_label="interval")
            enriched.append({
                **pt,
                "severity_level": pt_sev["level"],
                "severity_color": pt_sev["color"],
                "severity_hex": pt_sev["hex"],
            })
            
        if len(enriched) > 300:
            step = max(1, len(enriched) // 200)
            return enriched[::step]
        return enriched

    def _filter_by_range(self, data: List[Dict[str, Any]], time_range: str) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        if time_range == "day":
            cutoff = now - timedelta(days=1)
        elif time_range == "week":
            cutoff = now - timedelta(days=7)
        elif time_range == "month":
            cutoff = now - timedelta(days=30)
        else:  # all
            return data

        filtered = []
        for item in data:
            ts_str = item.get("minute_start_utc", "")
            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if dt >= cutoff:
                    filtered.append(item)
            except Exception:
                filtered.append(item)
        return filtered


# Global singleton
wearable_storage = WearableStorageService()
