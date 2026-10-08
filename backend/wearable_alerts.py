"""
STEADY - Wearable Alert Engine & Vibration Controller
Implements Section 6 specifications:
1. Band alert detection (0 -> 1 rising edge from band telemetry).
   - Suppressed if within BAND_ALERT_SUPPRESS_SECONDS (5s) after backend sent 'V'.
   - Persisted to SQLite with source='band', reason='Tremor-like movement detected by the band'.
2. Rule alert (Elevated movement vs personal baseline):
   - Evaluated during active normal sessions when personal baseline exists.
   - 120s rolling window (RULE_WINDOW_SECONDS) of valid readings (excluding alert=1 and btn=1).
   - Fires when rolling tremor share >= baseline_tremor_share + 15 pts (RULE_MARGIN_POINTS).
   - Enforces 60s cooldown (RULE_COOLDOWN_SECONDS).
   - Triggers band vibration ('V') and persists with source='rule'.
3. Test alert (Manual test vibration from web app):
   - Persisted with source='test', reason='Manual test vibration triggered from web app'.
   - Triggers band vibration ('V').
"""

import time
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple, Callable

from wearable_config import (
    RULE_WINDOW_SECONDS,
    RULE_MARGIN_POINTS,
    RULE_COOLDOWN_SECONDS,
    BAND_ALERT_SUPPRESS_SECONDS,
)
from wearable_db import create_alert, get_person_baseline, db_session_manager


class AlertEngine:
    def __init__(self):
        self.last_vibrate_sent_time: float = 0.0
        self.last_rule_alert_time: float = 0.0
        self.prev_band_alert_state: int = 0
        
        # Rolling window of valid readings for rule evaluation: (timestamp_float, tremor_int)
        self._window_readings: deque[Tuple[float, int]] = deque()
        
        # Cached baseline: { person_id: { "tremor_share": float | None, "fetched_at": float } }
        self._baseline_cache: Dict[str, Dict[str, Any]] = {}
        
        # Callback to send serial vibration command 'V'
        self.vibrate_sender: Optional[Callable[[str], bool]] = None
        
        # Callback to notify WebSocket listeners of new alerts
        self.on_alert_callback: Optional[Callable[[Dict[str, Any]], None]] = None

    def set_vibrate_sender(self, sender: Callable[[str], bool]) -> None:
        self.vibrate_sender = sender

    def set_on_alert(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        self.on_alert_callback = callback

    def record_vibrate_sent(self) -> None:
        """Mark that a vibration command was dispatched to the band."""
        self.last_vibrate_sent_time = time.time()

    def _send_vibrate(self) -> bool:
        self.record_vibrate_sent()
        if self.vibrate_sender:
            try:
                return self.vibrate_sender("V")
            except Exception as e:
                print(f"[ALERT ENGINE] Error sending vibration: {e}")
                return False
        return False

    def _get_cached_baseline(self, person_id: str) -> Optional[float]:
        now = time.time()
        cached = self._baseline_cache.get(person_id)
        if cached and (now - cached.get("fetched_at", 0)) < 15.0:
            return cached.get("tremor_share")
        
        baseline_data = get_person_baseline(person_id)
        tremor_share = baseline_data.get("tremor_share")
        self._baseline_cache[person_id] = {
            "tremor_share": tremor_share,
            "fetched_at": now
        }
        return tremor_share

    def process_reading(self, reading: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Process a single incoming telemetry reading.
        Returns list of newly generated alerts.
        """
        alerts_generated = []
        now = time.time()
        
        curr_alert = int(reading.get("alert", 0))
        curr_btn = int(reading.get("btn", 0))
        curr_tremor = int(reading.get("tremor", 0))
        
        active_sess = db_session_manager.get_active_session()
        person_id = active_sess.get("person_id") if active_sess else None
        session_id = active_sess.get("id") if active_sess else None
        
        # -------------------------------------------------------------
        # 1. Band Alert Rising Edge Detection (0 -> 1)
        # -------------------------------------------------------------
        if self.prev_band_alert_state == 0 and curr_alert == 1:
            # Check suppression window (BAND_ALERT_SUPPRESS_SECONDS after backend sent 'V')
            if (now - self.last_vibrate_sent_time) > BAND_ALERT_SUPPRESS_SECONDS:
                # If we have an active person, save alert to DB
                if person_id:
                    alert_doc = create_alert(
                        person_id=person_id,
                        reason="Tremor-like movement detected by the band",
                        source="band",
                        session_id=session_id,
                        ts=reading.get("ts")
                    )
                    alerts_generated.append(alert_doc)
                    if self.on_alert_callback:
                        self.on_alert_callback(alert_doc)
                else:
                    # Broadcast without DB persistence if no person is active
                    alt_data = {
                        "id": f"alt_live_{int(now*1000)}",
                        "person_id": None,
                        "session_id": None,
                        "ts": reading.get("ts") or datetime.now(timezone.utc).isoformat(),
                        "reason": "Tremor-like movement detected by the band",
                        "source": "band"
                    }
                    alerts_generated.append(alt_data)
                    if self.on_alert_callback:
                        self.on_alert_callback(alt_data)

        self.prev_band_alert_state = curr_alert

        # -------------------------------------------------------------
        # 2. Rule Alert Detection (Elevated Movement vs Personal Baseline)
        # -------------------------------------------------------------
        # Only evaluate rule alerts during active normal sessions
        if active_sess and active_sess.get("type") == "normal" and person_id:
            # Ignore contaminated samples (alert=1 or btn=1) from rolling statistics
            if curr_alert == 0 and curr_btn == 0:
                self._window_readings.append((now, curr_tremor))

            # Prune samples older than RULE_WINDOW_SECONDS
            while self._window_readings and (now - self._window_readings[0][0]) > RULE_WINDOW_SECONDS:
                self._window_readings.popleft()

            baseline_share = self._get_cached_baseline(person_id)
            
            # Need an established baseline and at least 100 valid samples (~10s minimum) in the window
            if baseline_share is not None and len(self._window_readings) >= 100:
                total_valid = len(self._window_readings)
                tremor_count = sum(t for _, t in self._window_readings)
                rolling_share = (tremor_count / total_valid) * 100.0
                
                threshold_target = baseline_share + RULE_MARGIN_POINTS
                
                if rolling_share >= threshold_target:
                    # Check cooldown
                    if (now - self.last_rule_alert_time) >= RULE_COOLDOWN_SECONDS:
                        self.last_rule_alert_time = now
                        
                        # Trigger band vibration
                        self._send_vibrate()
                        
                        reason = (
                            f"Tremor-like movement exceeded baseline ({baseline_share:.1f}%) "
                            f"by {RULE_MARGIN_POINTS} pts (rolling: {rolling_share:.1f}%)"
                        )
                        
                        alert_doc = create_alert(
                            person_id=person_id,
                            reason=reason,
                            source="rule",
                            session_id=session_id,
                            ts=reading.get("ts")
                        )
                        alerts_generated.append(alert_doc)
                        if self.on_alert_callback:
                            self.on_alert_callback(alert_doc)

        return alerts_generated

    def trigger_test_alert(self, person_id: Optional[str] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Triggers a manual test vibration and creates a test alert.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Send vibration command to band
        self._send_vibrate()
        
        # If no person specified, check active session
        active_sess = db_session_manager.get_active_session()
        target_person_id = person_id or (active_sess.get("person_id") if active_sess else None)
        target_session_id = session_id or (active_sess.get("id") if active_sess else None)
        
        if target_person_id:
            alert_doc = create_alert(
                person_id=target_person_id,
                reason="Manual test vibration triggered from web app",
                source="test",
                session_id=target_session_id,
                ts=now_iso
            )
        else:
            alert_doc = {
                "id": f"alt_test_{int(time.time()*1000)}",
                "person_id": None,
                "session_id": None,
                "ts": now_iso,
                "reason": "Manual test vibration triggered from web app",
                "source": "test"
            }
            
        if self.on_alert_callback:
            self.on_alert_callback(alert_doc)
            
        return alert_doc

    def reset_window(self) -> None:
        """Reset the rolling window (e.g. when session ends or starts)."""
        self._window_readings.clear()
        self.prev_band_alert_state = 0


# Global singleton alert engine
alert_engine = AlertEngine()
