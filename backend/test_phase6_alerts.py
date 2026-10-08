"""
Unit tests for Phase 6: Alert Engine & Vibration Controller
Tests:
1. Band alert detection (0 -> 1 edge) and deduplication.
2. Suppression of band alert within 5s after backend sent 'V'.
3. Rule alert triggering when elevated over personal baseline (+15 pts) in 120s window.
4. Rule alert 60s cooldown enforcement.
5. Test alert generation and serial vibration command dispatch.
"""

import unittest
import time
from unittest.mock import MagicMock
from wearable_alerts import AlertEngine
from wearable_config import RULE_MARGIN_POINTS, BAND_ALERT_SUPPRESS_SECONDS


class TestPhase6Alerts(unittest.TestCase):
    def setUp(self):
        self.engine = AlertEngine()
        self.mock_vibrate = MagicMock(return_value=True)
        self.mock_on_alert = MagicMock()
        self.engine.set_vibrate_sender(self.mock_vibrate)
        self.engine.set_on_alert(self.mock_on_alert)

    def test_band_alert_edge_detection(self):
        # Initial state: alert=0
        r1 = {"ts": "2026-10-09T00:00:00Z", "alert": 0, "btn": 0, "tremor": 0}
        alerts1 = self.engine.process_reading(r1)
        self.assertEqual(len(alerts1), 0)

        # Transition 0 -> 1: should generate band alert
        r2 = {"ts": "2026-10-09T00:00:01Z", "alert": 1, "btn": 0, "tremor": 1}
        alerts2 = self.engine.process_reading(r2)
        self.assertEqual(len(alerts2), 1)
        self.assertEqual(alerts2[0]["source"], "band")
        self.assertIn("Tremor-like movement", alerts2[0]["reason"])
        self.mock_on_alert.assert_called_once()

        # Stay at alert=1: should NOT generate duplicate alert
        r3 = {"ts": "2026-10-09T00:00:02Z", "alert": 1, "btn": 0, "tremor": 1}
        alerts3 = self.engine.process_reading(r3)
        self.assertEqual(len(alerts3), 0)

    def test_band_alert_suppression_after_backend_vibrate(self):
        # Simulate backend sent 'V' 2 seconds ago
        self.engine.last_vibrate_sent_time = time.time() - 2.0  # within 5s suppression

        # Transition 0 -> 1
        r = {"ts": "2026-10-09T00:00:01Z", "alert": 1, "btn": 0, "tremor": 1}
        alerts = self.engine.process_reading(r)
        self.assertEqual(len(alerts), 0, "Band alert should be suppressed within 5s of backend V command")

        # Now simulate backend sent 'V' 6 seconds ago (past suppression window)
        self.engine.prev_band_alert_state = 0
        self.engine.last_vibrate_sent_time = time.time() - (BAND_ALERT_SUPPRESS_SECONDS + 1.0)
        alerts_after = self.engine.process_reading(r)
        self.assertEqual(len(alerts_after), 1, "Band alert should fire after suppression window passes")

    def test_rule_alert_elevated_baseline(self):
        # Mock baseline
        self.engine._get_cached_baseline = MagicMock(return_value=10.0)

        # Create real test person and session in DB
        import uuid
        from wearable_db import create_person, db_session_manager
        code = f"T_{uuid.uuid4().hex[:6].upper()}"
        p_ok, p_doc, _ = create_person(code, "Test Alert Person")
        p_id = p_doc["id"]
        s_ok, s_doc, _ = db_session_manager.start_session(person_id=p_id, session_type="normal")

        
        try:
            # Feed 100 samples with 50% tremor (tremor=1 on alternate samples) -> 50% > 25%
            alerts = []
            for i in range(100):
                sample = {
                    "ts": f"2026-10-09T00:00:{i:02d}Z",
                    "alert": 0,
                    "btn": 0,
                    "tremor": 1 if i % 2 == 0 else 0, # 50%
                }
                res = self.engine.process_reading(sample)
                alerts.extend(res)

            # At the 100th sample, it should trigger rule alert
            rule_alerts = [a for a in alerts if a["source"] == "rule"]
            self.assertEqual(len(rule_alerts), 1)
            self.assertIn("exceeded baseline", rule_alerts[0]["reason"])
            self.mock_vibrate.assert_called_with("V")

            # Subsequent samples within cooldown should not trigger another rule alert
            res2 = self.engine.process_reading({
                "ts": "2026-10-09T00:01:41Z",
                "alert": 0,
                "btn": 0,
                "tremor": 1,
            })
            rule_alerts2 = [a for a in res2 if a["source"] == "rule"]
            self.assertEqual(len(rule_alerts2), 0, "Cooldown should prevent re-triggering within 60s")

        finally:
            db_session_manager.stop_session()


    def test_manual_test_alert(self):
        alert_doc = self.engine.trigger_test_alert()
        self.assertEqual(alert_doc["source"], "test")
        self.assertIn("Manual test vibration", alert_doc["reason"])
        self.mock_vibrate.assert_called_with("V")
        self.mock_on_alert.assert_called_with(alert_doc)


if __name__ == "__main__":
    unittest.main()
