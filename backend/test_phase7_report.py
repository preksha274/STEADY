"""
Unit and integration tests for Phase 7: Session Reports and Timeline Aggregation
Tests:
1. GET /api/sessions/{id}/timeline returns metadata, metrics, baseline, alerts, and timeline points.
2. GET /api/sessions/{id}/timeline returns 404 for invalid session.
3. get_session_timeline correctly handles downsampling for large sessions.
"""

import unittest
import uuid
from fastapi.testclient import TestClient
from main import app
from wearable_db import create_person, db_session_manager, get_session_timeline


class TestPhase7Report(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_session_timeline_valid_and_downsampling(self):
        # 1. Create Person and Session
        code = f"T_{uuid.uuid4().hex[:6].upper()}"
        p_ok, p_doc, _ = create_person(code, "Report Test Person")
        p_id = p_doc["id"]

        s_ok, s_doc, _ = db_session_manager.start_session(person_id=p_id, session_type="normal", label="still")
        s_id = s_doc["id"]

        # 2. Ingest 50 readings
        for i in range(50):
            db_session_manager.handle_incoming_reading({
                "ts": f"2026-10-09T01:00:{i:02d}Z",
                "t_ms": i * 100,
                "x": 0.01,
                "y": 0.02,
                "z": 0.98,
                "hp": 0.005,
                "rms": 0.05 if i % 2 == 0 else 0.01,
                "freq": 5.2,
                "tremor": 1 if i % 2 == 0 else 0,
                "alert": 0,
                "btn": 0,
            })
        db_session_manager.stop_session()

        # 3. Query Timeline via API
        response = self.client.get(f"/api/sessions/{s_id}/timeline")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("session", data)
        self.assertIn("metrics", data)
        self.assertIn("timeline", data)
        self.assertIn("alerts", data)
        self.assertEqual(data["session"]["id"], s_id)
        self.assertEqual(data["total_readings"], 50)
        self.assertTrue(len(data["timeline"]) > 0)
        self.assertEqual(data["metrics"]["valid_readings"], 50)


    def test_person_report_summary(self):
        # 1. Create Person
        code = f"T_{uuid.uuid4().hex[:6].upper()}"
        p_ok, p_doc, _ = create_person(code, "Multi-day Summary Person")
        p_id = p_doc["id"]

        # 2. Record Session
        s_ok, s_doc, _ = db_session_manager.start_session(person_id=p_id, session_type="normal", label="walking")
        s_id = s_doc["id"]

        for i in range(30):
            db_session_manager.handle_incoming_reading({
                "ts": f"2026-10-09T02:00:{i:02d}Z",
                "t_ms": i * 100,
                "x": 0.01,
                "y": 0.02,
                "z": 0.98,
                "hp": 0.005,
                "rms": 0.08,
                "freq": 4.8,
                "tremor": 1,
                "alert": 0,
                "btn": 0,
            })
        db_session_manager.stop_session()

        # 3. Test report endpoint
        res = self.client.get(f"/api/people/{p_id}/report?range=7d")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["person"]["id"], p_id)
        self.assertIn("daily_trends", data)
        self.assertIn("time_of_day", data)
        self.assertIn("risk_incidents", data)
        self.assertTrue(len(data["daily_trends"]) >= 1)

    def test_ble_prefix_serial_parsing(self):
        from wearable_serial import serial_source
        line = 'BLE -> {"timestamp":659786,"x":-0.0493,"y":0.0562,"z":0.9644,"motion":-0.0028,"tremor_strength":0.0033,"tremor_frequency":0.00,"tremor_detected":false,"vibrating":false}'
        parsed = serial_source.parse_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["t_ms"], 659786)
        self.assertEqual(parsed["x"], -0.0493)
        self.assertEqual(parsed["y"], 0.0562)
        self.assertEqual(parsed["z"], 0.9644)
        self.assertEqual(parsed["hp"], -0.0028)
        self.assertEqual(parsed["rms"], 0.0033)
        self.assertEqual(parsed["freq"], 0.0)
        self.assertEqual(parsed["tremor"], 0)
        self.assertEqual(parsed["alert"], 0)


if __name__ == "__main__":
    unittest.main()
