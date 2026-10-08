"""
STEADY AI - Hardware Live Stream DSP & Analytics Engine
Processes live 100 Hz telemetry streamed from the Steady Band ESP32:
`S,<ms>,<ax>,<ay>,<az>,<hp>,<rms>,<freq>,<tremor>,<state>,<drops>`

Handles:
1. Real-time bandpass filtering (3-8 Hz tremor band) on accelerometer data.
2. Separation of assessed vs not-assessed (state 1: vibrating, state 2: cooldown) samples.
3. Tremor amplitude, dominant frequency, and % time in tremor.
4. Confidence lens metrics: drop rate, dropout gaps, not-assessed time, data reliability.
5. Minute-by-minute historical summaries for 7-day and 30-day views.
"""

import time
import os
import json
from collections import deque
from typing import List, Dict, Any, Optional
import numpy as np
from scipy.signal import butter, filtfilt

SUMMARIES_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage_db", "hardware_summaries.json")
BASELINES_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage_db", "baselines.json")


class HardwareDSPProcessor:
    def __init__(self, max_buffer_size: int = 2000):
        self.buffer = deque(maxlen=max_buffer_size)  # ~20s at 100 Hz
        self.today_assessed_count = 0
        self.today_tremor_count = 0
        self.today_not_assessed_count = 0
        self.total_received_samples = 0
        self.last_ms = None
        self.dropout_gaps_count = 0
        self.last_drops = 0
        self.session_start_time = time.time()
        
        # Minute summary tracking
        self.current_minute_samples: List[Dict[str, Any]] = []
        self.last_minute_flush = time.time()
        self.summaries: List[Dict[str, Any]] = self._load_summaries()

    def _load_baseline(self) -> float:
        try:
            if os.path.exists(BASELINES_FILE):
                with open(BASELINES_FILE, "r") as f:
                    data = json.load(f)
                    for k in ["base_user_sarah_default", "base_user_sarah_test", "base_user_alice"]:
                        if k in data and "average_tremor_amplitude" in data[k]:
                            return float(data[k]["average_tremor_amplitude"])
        except Exception:
            pass
        return 0.22  # Default baseline amplitude in g / m/s2

    def _load_summaries(self) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(SUMMARIES_FILE):
                with open(SUMMARIES_FILE, "r") as f:
                    return json.load(f)
        except Exception:
            pass
        
        # Seed 7-day demo summaries if empty
        seeded = self._generate_seed_summaries()
        self._save_summaries(seeded)
        return seeded

    def _save_summaries(self, data: List[Dict[str, Any]]) -> None:
        try:
            os.makedirs(os.path.dirname(SUMMARIES_FILE), exist_ok=True)
            with open(SUMMARIES_FILE, "w") as f:
                json.dump(data[-5000:], f, indent=2)  # Keep last 5000 minute summaries
        except Exception as e:
            print(f"[HARDWARE DSP] Failed to save summaries: {e}")

    def _generate_seed_summaries(self) -> List[Dict[str, Any]]:
        """Generate realistic 7-day rolling minute summaries."""
        now = time.time()
        summaries = []
        # Generate 1 summary per hour for 7 days = 168 points
        for i in range(168, 0, -1):
            t = now - i * 3600
            hour = (time.gmtime(t).tm_hour) % 24
            # Circadian cycle: higher tremor during afternoon/fatigue
            base_amp = 0.15 + 0.10 * np.sin((hour - 8) * np.pi / 12) + np.random.uniform(-0.03, 0.04)
            base_amp = max(0.04, float(base_amp))
            tremor_pct = max(2.0, min(45.0, float(base_amp * 120 + np.random.uniform(-5, 5))))
            summaries.append({
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t)),
                "amplitude_g": round(base_amp, 4),
                "freq_hz": round(float(np.random.uniform(4.5, 5.5)), 2),
                "tremor_pct": round(tremor_pct, 1),
                "not_assessed_pct": round(float(np.random.uniform(1.0, 4.0)), 1),
                "sample_count": 6000,
                "drops_count": int(np.random.randint(0, 8)),
            })
        return summaries

    def ingest_batch(self, raw_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process a batch of incoming samples (~250 ms) from Web Serial / hardware.
        """
        parsed_batch = []
        now = time.time()

        for s in raw_samples:
            # Handle normalized keys or alternate aliases
            ms = int(s.get("ms", s.get("time", s.get("t_ms", 0))))
            ax = float(s.get("ax", s.get("x", 0.0)))
            ay = float(s.get("ay", s.get("y", 0.0)))
            az = float(s.get("az", s.get("z", 1.0)))
            hp = float(s.get("hp", 0.0))
            rms = float(s.get("rms", 0.0))
            freq = float(s.get("freq", s.get("f", 0.0)))
            tremor = int(s.get("tremor", s.get("t", 0)))
            state = int(s.get("state", s.get("s", 0)))
            drops = int(s.get("drops", s.get("d", self.last_drops)))

            # Track gaps
            if self.last_ms is not None and (ms - self.last_ms) > 60:
                self.dropout_gaps_count += 1
            self.last_ms = ms
            self.last_drops = drops

            sample_dict = {
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
                "assessed": (state not in (1, 2, 4)), # State 1=vibrating, 2=cooldown, 4=sensor error -> NOT ASSESSED
                "timestamp": now,
            }

            self.buffer.append(sample_dict)
            parsed_batch.append(sample_dict)
            self.current_minute_samples.append(sample_dict)
            self.total_received_samples += 1

            if sample_dict["assessed"]:
                self.today_assessed_count += 1
                if sample_dict["tremor"]:
                    self.today_tremor_count += 1
            else:
                self.today_not_assessed_count += 1

        # Check minute summary flush
        if now - self.last_minute_flush >= 60.0 and len(self.current_minute_samples) >= 100:
            self._flush_minute_summary(now)

        # Run Live DSP Analytics on the recent buffer window (~4s = 400 samples)
        metrics = self._calculate_live_metrics()
        return {
            "type": "hardware_telemetry",
            "samples": parsed_batch,
            "metrics": metrics,
        }

    def _flush_minute_summary(self, now: float) -> None:
        assessed = [s for s in self.current_minute_samples if s["assessed"]]
        total = len(self.current_minute_samples)
        if total == 0:
            return

        not_assessed_pct = ( (total - len(assessed)) / total ) * 100.0
        tremor_count = sum(1 for s in assessed if s["tremor"])
        tremor_pct = (tremor_count / max(1, len(assessed))) * 100.0
        mean_rms = float(np.mean([s["rms"] for s in assessed])) if assessed else 0.0
        freqs = [s["freq"] for s in assessed if s["freq"] > 0]
        mean_freq = float(np.mean(freqs)) if freqs else 0.0

        summary_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
            "amplitude_g": round(mean_rms, 4),
            "freq_hz": round(mean_freq, 2),
            "tremor_pct": round(tremor_pct, 1),
            "not_assessed_pct": round(not_assessed_pct, 1),
            "sample_count": total,
            "drops_count": self.last_drops,
        }
        self.summaries.append(summary_entry)
        self._save_summaries(self.summaries)

        self.current_minute_samples = []
        self.last_minute_flush = now

    def _calculate_live_metrics(self) -> Dict[str, Any]:
        buf_list = list(self.buffer)
        if not buf_list:
            return {
                "live": False,
                "tremor_amplitude": 0.0,
                "dominant_freq_hz": 0.0,
                "tremor_detected": False,
                "percent_time_in_tremor": 0.0,
                "today_percent_time_in_tremor": 0.0,
                "baseline_amplitude": 0.22,
                "baseline_deviation_pct": 0.0,
                "confidence_tier": "low",
                "confidence_reason": "No samples received",
                "not_assessed_pct": 0.0,
                "drops_count": 0,
                "dropout_gaps_count": 0,
                "effective_sample_rate_hz": 100.0,
                "reliable_data": False,
                "state": 0,
                "state_label": "Normal",
            }

        last_sample = buf_list[-1]
        cur_state = last_sample["state"]
        state_labels = {
            0: "Normal (Assessed)",
            1: "Motor Active (Not Assessed)",
            2: "Cooldown (Not Assessed)",
            3: "Button Test",
            4: "Sensor Error (Readings Paused)"
        }
        cur_state_label = state_labels.get(cur_state, "Unknown")

        # Calculate effective sample rate using firmware timestamps
        effective_sample_rate_hz = 100.0
        if len(buf_list) >= 10:
            ms_vals = [s["ms"] for s in buf_list[-100:]]
            time_diffs = np.diff(ms_vals)
            valid_dts = time_diffs[(time_diffs > 0) & (time_diffs < 200)]
            if len(valid_dts) > 0:
                mean_dt = float(np.mean(valid_dts))
                if mean_dt > 0:
                    effective_sample_rate_hz = round(float(1000.0 / mean_dt), 1)

        # Window analysis on recent 400 samples (4 seconds at 100 Hz)
        recent_window = buf_list[-400:]
        assessed_window = [s for s in recent_window if s["assessed"]]
        total_recent = len(recent_window)
        not_assessed_recent = total_recent - len(assessed_window)
        not_assessed_pct = (not_assessed_recent / max(1, total_recent)) * 100.0

        # DSP on 3-8 Hz band: bandpass filter each axis (ax, ay, az) and combine energy
        tremor_amplitude = 0.0
        dominant_freq = 0.0
        tremor_detected = False

        if len(assessed_window) >= 64:
            fs = effective_sample_rate_hz if effective_sample_rate_hz > 10.0 else 100.0
            nyq = fs / 2.0
            low = 3.0 / nyq
            high = min(8.0, nyq - 0.5) / nyq
            if low < high and low > 0:
                try:
                    b, a = butter(2, [low, high], btype="bandpass")
                    ax = np.array([s["ax"] for s in assessed_window])
                    ay = np.array([s["ay"] for s in assessed_window])
                    az = np.array([s["az"] for s in assessed_window])

                    filt_x = filtfilt(b, a, ax - np.mean(ax))
                    filt_y = filtfilt(b, a, ay - np.mean(ay))
                    filt_z = filtfilt(b, a, az - np.mean(az))

                    rms_x = float(np.mean(filt_x**2))
                    rms_y = float(np.mean(filt_y**2))
                    rms_z = float(np.mean(filt_z**2))

                    # Combine 3D energy
                    tremor_amplitude = float(np.sqrt(rms_x + rms_y + rms_z))
                except Exception:
                    tremor_amplitude = float(np.mean([s["rms"] for s in assessed_window]))
            else:
                tremor_amplitude = float(np.mean([s["rms"] for s in assessed_window]))

            # Dominant frequency from band samples
            valid_freqs = [s["freq"] for s in assessed_window if s["freq"] >= 2.5]
            if valid_freqs:
                dominant_freq = float(np.median(valid_freqs))
            else:
                dominant_freq = float(last_sample.get("freq", 0.0))

            tremor_detected = (tremor_amplitude >= 0.08 and 3.0 <= dominant_freq <= 8.0)
        else:
            tremor_amplitude = float(last_sample.get("rms", 0.0))
            dominant_freq = float(last_sample.get("freq", 0.0))
            tremor_detected = bool(last_sample.get("tremor", 0))

        # If currently in sensor error (state 4), force tremor_detected to false
        if cur_state == 4:
            tremor_detected = False

        # Calculate % time in tremor
        window_tremor_count = sum(1 for s in assessed_window if s["tremor"])
        window_tremor_pct = (window_tremor_count / max(1, len(assessed_window))) * 100.0

        today_tremor_pct = (
            (self.today_tremor_count / max(1, self.today_assessed_count)) * 100.0
            if self.today_assessed_count > 0 else window_tremor_pct
        )

        # Baseline deviation
        baseline_amp = self._load_baseline()
        deviation_pct = ((tremor_amplitude - baseline_amp) / baseline_amp) * 100.0 if baseline_amp > 0 else 0.0

        # Confidence lens & data reliability scoring
        reliable_data = True
        confidence_tier = "high"
        confidence_reasons = []

        if self.last_drops > 20:
            reliable_data = False
            confidence_tier = "low"
            confidence_reasons.append(f"{self.last_drops} dropped samples detected")

        if not_assessed_pct > 40.0:
            confidence_tier = "medium" if confidence_tier == "high" else "low"
            confidence_reasons.append(f"{not_assessed_pct:.1f}% time paused in haptic/cooldown")

        if len(buf_list) < 200:
            confidence_tier = "medium"
            confidence_reasons.append("Collecting initial telemetry buffer")

        if self.dropout_gaps_count > 5:
            confidence_tier = "low"
            reliable_data = False
            confidence_reasons.append(f"{self.dropout_gaps_count} packet dropout gaps")

        if not confidence_reasons:
            confidence_reasons.append("Steady 100 Hz USB telemetry with low noise")

        return {
            "live": True,
            "tremor_amplitude": round(tremor_amplitude, 4),
            "dominant_freq_hz": round(dominant_freq, 2),
            "tremor_detected": tremor_detected,
            "percent_time_in_tremor": round(window_tremor_pct, 1),
            "today_percent_time_in_tremor": round(today_tremor_pct, 1),
            "baseline_amplitude": round(baseline_amp, 4),
            "baseline_deviation_pct": round(deviation_pct, 1),
            "confidence_tier": confidence_tier,
            "confidence_reason": "; ".join(confidence_reasons),
            "not_assessed_pct": round(not_assessed_pct, 1),
            "drops_count": self.last_drops,
            "dropout_gaps_count": self.dropout_gaps_count,
            "reliable_data": reliable_data,
            "state": cur_state,
            "state_label": cur_state_label,
            "total_samples": self.total_received_samples,
            "assessed_samples": self.today_assessed_count,
            "not_assessed_samples": self.today_not_assessed_count,
        }

    def get_summaries(self, days: int = 7) -> List[Dict[str, Any]]:
        return self.summaries[-(days * 24):]


# Singleton instance for backend live streaming
dsp_processor = HardwareDSPProcessor()
