"""
STEADY - Wearable Serial Ingestion Engine & ReadingSource Interface
Handles:
1. Resilient background serial reading at 115200 baud.
2. Auto-reconnection with detection of port_missing, port_busy, no_data, legacy_format, and connected states.
3. Parsing JSON telemetry, boot packets, legacy format, and garbage counting.
4. Sending commands ('V' vibration) to the band.
5. Abstract ReadingSource interface for serial and replay implementations.
"""

import abc
import json
import re
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Dict, Any, Optional, List
from collections import deque

from wearable_config import (
    SERIAL_PORT,
    SERIAL_BAUD,
    STALE_DATA_SECONDS,
    READINGS_PER_SECOND_EXPECTED,
)


class ReadingSource(abc.ABC):
    """Abstract interface for reading telemetry from a hardware device or replay simulator."""
    
    @abc.abstractmethod
    def start(self) -> None:
        """Start the reading source."""
        pass

    @abc.abstractmethod
    def stop(self) -> None:
        """Stop the reading source."""
        pass

    @abc.abstractmethod
    def set_on_reading(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register a callback for every valid reading."""
        pass

    @abc.abstractmethod
    def send_command(self, char: str) -> bool:
        """Send a single character command to the band."""
        pass

    @abc.abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Return the current connection and ingestion status."""
        pass


class SerialReadingSource(ReadingSource):
    """
    Serial implementation using pyserial with automatic reconnect, state tracking,
    and line parsing for Steady Band firmware.
    """
    def __init__(self, port: str = SERIAL_PORT, baud: int = SERIAL_BAUD):
        self.port = port
        self.baud = baud
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._ser = None
        self._lock = threading.Lock()
        
        self.on_reading: Optional[Callable[[Dict[str, Any]], None]] = None
        
        # Ingestion metrics & counters
        self.mpu_ok: bool = True
        self.last_reading_time: Optional[float] = None
        self.last_reading_at_iso: Optional[str] = None
        self.skipped_lines: int = 0
        self.legacy_lines: int = 0
        self.last_bad_line: str = ""
        self.raw_state: str = "disconnected"
        
        # Rolling rate tracker (timestamps of valid readings within last 2 seconds)
        self._rate_deque = deque(maxlen=100)
        # Recent readings buffer for HTTP live polling & fast charting
        self._recent_readings = deque(maxlen=300)

    def get_latest_readings(self, n: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._recent_readings)[-n:]

    def set_on_reading(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        self.on_reading = callback

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="SteadySerialReader")
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        with self._lock:
            if self._ser:
                try:
                    self._ser.close()
                except Exception:
                    pass
                self._ser = None
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        self.raw_state = "disconnected"

    def send_command(self, char: str) -> bool:
        """Write single character to serial port. Returns True if sent, False otherwise."""
        with self._lock:
            if self._ser and self._ser.is_open:
                try:
                    self._ser.write(char.encode("ascii"))
                    self._ser.flush()
                    return True
                except Exception as e:
                    print(f"[SERIAL] Failed to send command '{char}': {e}")
                    return False
        return False

    def get_readings_per_second(self) -> float:
        """Calculate rolling readings per second over the last 2 seconds."""
        now = time.time()
        # Prune older than 2 seconds
        while self._rate_deque and (now - self._rate_deque[0]) > 2.0:
            self._rate_deque.popleft()
        if len(self._rate_deque) < 2:
            return 0.0
        elapsed = now - self._rate_deque[0]
        return round(len(self._rate_deque) / max(0.5, elapsed), 1)

    def get_state(self) -> str:
        """
        Calculates the user-facing connection state:
        'connected' | 'no_data' | 'port_busy' | 'port_missing' | 'legacy_format' | 'disconnected'
        """
        if self.raw_state in ("port_missing", "port_busy", "legacy_format"):
            return self.raw_state

        if not self._running:
            return "disconnected"
        
        if self.raw_state == "disconnected":
            return "disconnected"
        
        # If open, check freshness of readings
        now = time.time()
        if self.last_reading_time is None or (now - self.last_reading_time) > STALE_DATA_SECONDS:
            return "no_data"
            
        return "connected"


    def get_status(self) -> Dict[str, Any]:
        """Return standardized status payload."""
        state = self.get_state()
        is_connected = (state == "connected")
        rps = self.get_readings_per_second() if is_connected else 0.0
        
        return {
            "connected": is_connected,
            "port": self.port,
            "state": state,
            "mpu_ok": self.mpu_ok,
            "last_reading_at": self.last_reading_at_iso,
            "readings_per_second": rps,
            "skipped_lines": self.skipped_lines,
            "legacy_lines": self.legacy_lines,
            "last_bad_line": self.last_bad_line,
        }

    def parse_line(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Parse raw serial line. Handles:
        1. Boot line: {"boot":1, "mpu":1}
        2. Normal reading JSON: {"t":..., "x":..., "y":..., "z":..., "hp":..., "rms":..., "freq":..., "tremor":..., "alert":..., "btn":...}
           Also handles 'BLE -> {...}' prefixes and alternate keys:
           timestamp, motion, tremor_strength, tremor_frequency, tremor_detected, vibrating
        3. Legacy text line: x=-240 y=-24 z=16000
        4. Garbage / bad lines.
        Returns parsed reading dict or None.
        """
        if not line:
            return None

        clean = line.strip()
        if not clean:
            return None

        # Check for Legacy text format (e.g. x=-240 y=-24 z=16000 or AX: ... AY: ...)
        if re.search(r"x\s*=\s*-?\d+", clean, re.IGNORECASE) and re.search(r"y\s*=\s*-?\d+", clean, re.IGNORECASE):
            self.legacy_lines += 1
            self.raw_state = "legacy_format"
            return None

        # Extract JSON substring if line contains '{' and '}' (handles 'BLE -> {...}' or other prefixes)
        json_match = re.search(r"\{.*\}", clean)
        if json_match:
            json_str = json_match.group(0)
            try:
                data = json.loads(json_str)
                if not isinstance(data, dict):
                    self.skipped_lines += 1
                    self.last_bad_line = clean
                    return None

                # Check for Boot line
                if "boot" in data:
                    self.mpu_ok = bool(data.get("mpu", 1) == 1)
                    return None

                # Normal Reading validation
                # Support varied ESP32 firmware keys:
                # time: timestamp, time, t, t_ms, ms
                # motion: motion, hp
                # tremor_strength: tremor_strength, rms
                # tremor_frequency: tremor_frequency, freq, f
                # tremor_detected: tremor_detected, tremor
                # alert: vibrating, alert
                # coords: x/ax, y/ay, z/az
                t = int(data.get("t", data.get("timestamp", data.get("time", data.get("t_ms", data.get("ms", 0))))))
                x = float(data.get("x", data.get("ax", 0.0)))
                y = float(data.get("y", data.get("ay", 0.0)))
                z = float(data.get("z", data.get("az", 1.0)))
                hp = float(data.get("hp", data.get("motion", 0.0)))
                rms = float(data.get("rms", data.get("tremor_strength", 0.0)))
                freq = float(data.get("freq", data.get("tremor_frequency", data.get("f", 0.0))))

                raw_tremor = data.get("tremor", data.get("tremor_detected", 0))
                if isinstance(raw_tremor, bool):
                    tremor = 1 if raw_tremor else 0
                else:
                    tremor = int(raw_tremor) if raw_tremor else (1 if rms >= 0.04 else 0)

                raw_alert = data.get("alert", data.get("vibrating", 0))
                if isinstance(raw_alert, bool):
                    alert = 1 if raw_alert else 0
                else:
                    alert = int(raw_alert) if raw_alert else 0

                btn = int(data.get("btn", data.get("button", 0)))

                now_ts = time.time()
                now_iso = datetime.now(timezone.utc).isoformat()
                
                self.last_reading_time = now_ts
                self.last_reading_at_iso = now_iso
                self._rate_deque.append(now_ts)
                self.raw_state = "connected"

                reading_dict = {
                    "ts": now_iso,
                    "t_ms": t,
                    "x": round(x, 4),
                    "y": round(y, 4),
                    "z": round(z, 4),
                    "hp": round(hp, 4),
                    "rms": round(rms, 4),
                    "freq": round(freq, 2),
                    "tremor": 1 if tremor else 0,
                    "alert": 1 if alert else 0,
                    "btn": 1 if btn else 0,
                }
                self._recent_readings.append(reading_dict)
                return reading_dict
            except (ValueError, TypeError, json.JSONDecodeError):
                self.skipped_lines += 1
                self.last_bad_line = clean
                return None

        # Non-JSON garbage
        self.skipped_lines += 1
        self.last_bad_line = clean
        return None

    def _run_loop(self) -> None:
        """Background thread loop managing serial connection and recovery."""
        try:
            import serial
        except ImportError:
            print("[SERIAL] pyserial not installed. Run 'pip install pyserial'")
            self.raw_state = "port_missing"
            return

        while self._running:
            # Attempt to open serial port
            try:
                ser = serial.Serial(self.port, self.baud, timeout=1.0)
                with self._lock:
                    self._ser = ser
                self.raw_state = "connected"
                print(f"[SERIAL] Connected to Steady Band on {self.port} at {self.baud} baud")

                while self._running:
                    try:
                        raw_bytes = ser.readline()
                        if not raw_bytes:
                            # Timeout / no data on line
                            continue

                        line = raw_bytes.decode(errors="ignore")
                        reading = self.parse_line(line)
                        if reading and self.on_reading:
                            self.on_reading(reading)

                    except (serial.SerialException, OSError) as e:
                        print(f"[SERIAL] Device read error / disconnected: {e}")
                        break

            except (PermissionError, serial.SerialException) as e:
                err_msg = str(e).lower()
                if "access is denied" in err_msg or "permission" in err_msg or "busy" in err_msg:
                    self.raw_state = "port_busy"
                elif "file not found" in err_msg or "could not open port" in err_msg or "system cannot find" in err_msg:
                    self.raw_state = "port_missing"
                else:
                    self.raw_state = "disconnected"

            except Exception as e:
                print(f"[SERIAL] Unexpected port error: {e}")
                self.raw_state = "disconnected"

            # Clean up closed port
            with self._lock:
                if self._ser:
                    try:
                        self._ser.close()
                    except Exception:
                        pass
                    self._ser = None

            # Wait before attempting auto-reconnect
            time.sleep(1.5)


# Global singleton instance
serial_source = SerialReadingSource()
