"""
STEADY - Replay & Validation ReadingSource Engine
Implements Section 8 specifications:
- Concrete ReadingSource implementation for playing back recorded and synthetic CSV datasets.
- Configurable playback speeds (1x, 2x, 5x, 10x).
- Full compatibility with existing Section 1-7 telemetry pipeline, WebSocket stream, and AlertEngine.
"""

import csv
import io
import os
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Dict, Any, Optional, List, Tuple

from wearable_serial import ReadingSource
from wearable_config import READINGS_PER_SECOND_EXPECTED



class ReplayReadingSource(ReadingSource):
    """
    Simulates live telemetry by streaming CSV rows at configurable clock rates.
    """
    def __init__(self):
        self._running = False
        self._paused = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        self.on_reading: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_completed: Optional[Callable[[], None]] = None

        # Replay dataset & position state
        self.samples: List[Dict[str, Any]] = []
        self.current_index: int = 0
        self.speed: float = 1.0
        self.source_filename: str = ""
        self.status_state: str = "idle"  # idle | playing | paused | completed
        self.last_reading: Optional[Dict[str, Any]] = None
        self.vibrations_received: List[str] = []

    def set_on_reading(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        self.on_reading = callback

    def set_on_completed(self, callback: Callable[[], None]) -> None:
        self.on_completed = callback

    def load_csv(self, csv_text: str, filename: str = "uploaded.csv") -> Tuple[bool, int, Optional[str], Dict[str, Any]]:
        """
        Parses CSV data into standardized telemetry samples with flexible alias mapping.
        Handles UTF-8 BOM, # comment lines, Windows CRLF, quoted fields, and varied column names.
        Returns: (success, count, error_message, parse_metadata)
        """
        with self._lock:
            self.stop()
            self.samples = []
            self.current_index = 0
            self.source_filename = filename
            self.status_state = "idle"

            if not csv_text or not csv_text.strip():
                return False, 0, "CSV file is empty.", {}

            try:
                # Strip UTF-8 BOM
                cleaned_text = csv_text.lstrip("\ufeff")

                # Filter out comment lines starting with # (e.g. disclaimer headers)
                raw_lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
                data_lines = [line for line in raw_lines if not line.startswith("#")]

                if not data_lines:
                    return False, 0, "CSV file contains only comments or empty lines.", {}

                # Use csv.reader on non-comment lines
                reader = csv.reader(data_lines)
                try:
                    header_row = next(reader)
                except StopIteration:
                    return False, 0, "No header row found in CSV.", {}

                # Normalize header names (lowercase, strip whitespace, remove quotes)
                normalized_headers = [h.strip().lower().strip('"\'') for h in header_row if h]
                
                # Column alias mapping table
                alias_map = {
                    "t_ms": ["t_ms", "t", "time_ms", "timems", "ms"],
                    "timestamp": ["timestamp_iso", "timestamp", "time", "ts", "t_iso", "datetime"],
                    "x": ["x", "ax", "acc_x", "accx", "accel_x"],
                    "y": ["y", "ay", "acc_y", "accy", "accel_y"],
                    "z": ["z", "az", "acc_z", "accz", "accel_z"],
                    "hp": ["hp", "motion", "highpass", "hp_acc"],
                    "rms": ["rms", "tremor_strength", "strength", "rms_acc", "mag"],
                    "freq": ["freq", "tremor_frequency", "frequency", "f", "hz"],
                    "tremor": ["tremor", "tremor_detected", "is_tremor", "tremor_state"],
                    "alert": ["alert", "vibrating", "vibration", "state"],
                    "btn": ["btn", "button", "btn_state"],
                    "label": ["label", "activity", "tag", "task"],
                    "session_type": ["session_type", "type"],
                }

                col_indices: Dict[str, int] = {}
                columns_found: List[str] = []
                for canonical, aliases in alias_map.items():
                    for idx, h in enumerate(normalized_headers):
                        if h in aliases:
                            col_indices[canonical] = idx
                            columns_found.append(h)
                            break

                # Essential columns verification (must have at least acceleration X or RMS)
                if "x" not in col_indices and "rms" not in col_indices:
                    missing_info = f"Missing required acceleration/motion columns. Found columns: {', '.join(normalized_headers)}"
                    return False, 0, missing_info, {"columns_found": normalized_headers}

                columns_missing = [c for c in ["x", "y", "z", "rms", "freq", "t_ms"] if c not in col_indices]

                parsed_samples = []
                skipped_rows = 0
                first_ts = None
                last_ts = None
                detected_label = None
                t0_ms = None

                for row_idx, row in enumerate(reader):
                    if not row or all(not cell.strip() for cell in row):
                        skipped_rows += 1
                        continue

                    try:
                        # Helper to get cell value
                        def get_val(key: str, default=None):
                            if key in col_indices:
                                idx = col_indices[key]
                                if idx < len(row):
                                    v = row[idx].strip().strip('"\'')
                                    return v if v != "" else default
                            return default

                        # Timestamp / relative t_ms
                        raw_t = get_val("t_ms")
                        raw_ts = get_val("timestamp")

                        if raw_ts:
                            if first_ts is None:
                                first_ts = raw_ts
                            last_ts = raw_ts

                        if raw_t is not None:
                            try:
                                t_ms_num = int(float(raw_t))
                            except ValueError:
                                t_ms_num = row_idx * 100
                        else:
                            t_ms_num = row_idx * 100

                        if t0_ms is None:
                            t0_ms = t_ms_num

                        # Accelerations
                        x_val = float(get_val("x", 0.0) or 0.0)
                        y_val = float(get_val("y", 0.0) or 0.0)
                        z_val = float(get_val("z", 1.0) or 1.0)

                        # Signal metrics
                        hp_val = float(get_val("hp", 0.0) or 0.0)
                        rms_val = float(get_val("rms", 0.0) or 0.0)
                        freq_val = float(get_val("freq", 0.0) or 0.0)

                        # Approximation if RMS is 0 but motion exists
                        if rms_val == 0.0 and (abs(x_val) > 0.05 or abs(y_val) > 0.05):
                            rms_val = round(float((x_val**2 + y_val**2)**0.5 * 0.1), 4)

                        # Tremor & Alert flags
                        raw_tremor = get_val("tremor")
                        if raw_tremor is not None:
                            if str(raw_tremor).lower() in ("true", "1", "yes"):
                                tremor_val = 1
                            elif str(raw_tremor).lower() in ("false", "0", "no"):
                                tremor_val = 0
                            else:
                                tremor_val = int(float(raw_tremor))
                        else:
                            tremor_val = 1 if rms_val >= 0.04 else 0

                        raw_alert = get_val("alert")
                        alert_val = 1 if str(raw_alert).lower() in ("true", "1", "yes") else (int(float(raw_alert)) if raw_alert is not None else 0)
                        btn_val = int(float(get_val("btn", 0) or 0))

                        row_label = get_val("label")
                        if row_label and not detected_label:
                            detected_label = row_label

                        parsed_samples.append({
                            "t_ms": t_ms_num,
                            "t_rel_s": round((t_ms_num - t0_ms) / 1000.0, 2),
                            "x": round(x_val, 4),
                            "y": round(y_val, 4),
                            "z": round(z_val, 4),
                            "hp": round(hp_val, 4),
                            "rms": round(rms_val, 4),
                            "freq": round(freq_val, 2),
                            "tremor": tremor_val,
                            "alert": alert_val,
                            "btn": btn_val,
                        })
                    except (ValueError, TypeError):
                        skipped_rows += 1

                if not parsed_samples:
                    return False, 0, "All data rows contained invalid or unparseable numeric values.", {}

                self.samples = parsed_samples
                total_cnt = len(parsed_samples)
                dur_s = round(parsed_samples[-1]["t_rel_s"] - parsed_samples[0]["t_rel_s"], 1) if total_cnt > 1 else round(total_cnt * 0.1, 1)
                tremor_cnt = sum(1 for s in parsed_samples if s["tremor"] == 1)
                tremor_share = round((tremor_cnt / total_cnt) * 100.0, 1) if total_cnt > 0 else 0.0
                alert_cnt = sum(1 for s in parsed_samples if s["alert"] == 1)

                parse_meta = {
                    "filename": filename,
                    "rows_used": total_cnt,
                    "rows_skipped": skipped_rows,
                    "columns_found": normalized_headers,
                    "columns_missing": columns_missing,
                    "duration_seconds": max(0.1, dur_s),
                    "first_timestamp": first_ts or (f"0.0s (t_ms: {t0_ms})" if t0_ms is not None else "0.0s"),
                    "last_timestamp": last_ts or (f"{dur_s}s" if dur_s else "End"),
                    "tremor_share": tremor_share,
                    "alert_rows": alert_cnt,
                    "label": detected_label,
                    "samples": parsed_samples,
                }

                return True, total_cnt, None, parse_meta

            except Exception as e:
                return False, 0, f"CSV parsing error: {str(e)}", {}

    def start_replay(self, speed: float = 1.0, start_from_index: int = 0) -> bool:
        if not self.samples:
            return False

        with self._lock:
            self.stop()
            self.speed = max(0.1, min(20.0, speed))
            self.current_index = max(0, min(len(self.samples) - 1, start_from_index))
            self._running = True
            self._paused = False
            self.status_state = "playing"
            self.vibrations_received = []

            self._thread = threading.Thread(target=self._run_replay_loop, daemon=True, name="SteadyReplayWorker")
            self._thread.start()
            return True

    def pause_replay(self) -> None:
        with self._lock:
            if self._running and not self._paused:
                self._paused = True
                self.status_state = "paused"

    def resume_replay(self) -> None:
        with self._lock:
            if self._running and self._paused:
                self._paused = False
                self.status_state = "playing"

    def stop_replay(self) -> None:
        self.stop()

    def start(self) -> None:
        self.start_replay(self.speed)

    def stop(self) -> None:
        self._running = False
        self._paused = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=0.5)
        self.status_state = "idle" if self.current_index == 0 else "completed"

    def send_command(self, char: str) -> bool:
        """Simulate receiving command from backend (e.g. 'V' motor vibration)."""
        with self._lock:
            now_iso = datetime.now(timezone.utc).isoformat()
            self.vibrations_received.append(f"[{now_iso}] Command '{char}' received by simulated band")
            print(f"[REPLAY] Simulated band received command: '{char}'")
            return True

    def get_status(self) -> Dict[str, Any]:
        total = len(self.samples)
        idx = self.current_index
        pct = round((idx / total) * 100.0, 1) if total > 0 else 0.0

        return {
            "state": self.status_state,
            "connected": self._running,
            "port": "REPLAY_SIMULATOR",
            "filename": self.source_filename,
            "current_index": idx,
            "total_samples": total,
            "progress_pct": pct,
            "speed": self.speed,
            "last_reading": self.last_reading,
            "vibrations_count": len(self.vibrations_received),
            "vibrations_log": self.vibrations_received[-5:],
        }

    def _run_replay_loop(self) -> None:
        interval = 1.0 / (READINGS_PER_SECOND_EXPECTED * self.speed)

        while self._running and self.current_index < len(self.samples):
            if self._paused:
                time.sleep(0.1)
                continue

            sample = self.samples[self.current_index]
            now_iso = datetime.now(timezone.utc).isoformat()

            reading = {
                "ts": now_iso,
                "t_ms": sample["t_ms"],
                "x": sample["x"],
                "y": sample["y"],
                "z": sample["z"],
                "hp": sample["hp"],
                "rms": sample["rms"],
                "freq": sample["freq"],
                "tremor": sample["tremor"],
                "alert": sample["alert"],
                "btn": sample["btn"],
            }
            self.last_reading = reading

            if self.on_reading:
                try:
                    self.on_reading(reading)
                except Exception as e:
                    print(f"[REPLAY] Callback error: {e}")

            self.current_index += 1
            time.sleep(interval)

        # Loop finished
        with self._lock:
            self._running = False
            self.status_state = "completed"

        if self.on_completed:
            try:
                self.on_completed()
            except Exception as e:
                print(f"[REPLAY] Completion callback error: {e}")


# Global replay reading source instance
replay_source = ReplayReadingSource()
