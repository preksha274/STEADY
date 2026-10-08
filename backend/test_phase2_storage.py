"""
Unit & Integration tests for Phase 2: Storage and Export API.
"""

import os
import sys
import unittest
import time
from datetime import datetime, timezone
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from main import app
from wearable_db import init_db, db_session_manager, get_db_connection
from wearable_config import DISCLAIMER_TEXT


class TestPhase2Storage(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db()
        # Clean test state
        db_session_manager.stop_session()

    def test_person_crud_and_validation(self):
        # 1. Valid person
        code = f"T{int(time.time()) % 10000:04d}"
        res = self.client.post("/api/people", json={"code": code, "display_name": "Test Subject"})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["code"], code)
        self.assertEqual(data["display_name"], "Test Subject")
        person_id = data["id"]

        # 2. Duplicate person code -> 409
        res_dup = self.client.post("/api/people", json={"code": code})
        self.assertEqual(res_dup.status_code, 409)

        # 3. Invalid code length (< 2 or > 12) -> 422 (pydantic) or 400
        res_inv = self.client.post("/api/people", json={"code": "X"})
        self.assertIn(res_inv.status_code, [400, 422])

        # 4. List people contains created person
        res_list = self.client.get("/api/people")
        self.assertEqual(res_list.status_code, 200)
        people = res_list.json()
        self.assertTrue(any(p["id"] == person_id for p in people))

    def test_session_lifecycle_and_single_active_constraint(self):
        # Create person
        code = f"P{int(time.time()) % 10000:04d}"
        p_res = self.client.post("/api/people", json={"code": code})
        person_id = p_res.json()["id"]

        # 1. Start Session 1
        s1_res = self.client.post("/api/sessions/start", json={
            "person_id": person_id,
            "type": "normal",
            "label": "shaking",
            "note": "20 second trial"
        })
        self.assertEqual(s1_res.status_code, 201)
        s1 = s1_res.json()
        s1_id = s1["id"]

        # Active check
        active_res = self.client.get("/api/sessions/active")
        self.assertEqual(active_res.status_code, 200)
        self.assertTrue(active_res.json()["active"])
        self.assertEqual(active_res.json()["session"]["id"], s1_id)

        # 2. Attempt starting second session while s1 is active -> 409 Conflict
        s2_res = self.client.post("/api/sessions/start", json={
            "person_id": person_id,
            "type": "baseline",
            "label": "still"
        })
        self.assertEqual(s2_res.status_code, 409)
        self.assertIn("already active", s2_res.json()["detail"])

        # 3. Ingest simulated 200 readings into session
        now_base = 100000
        for i in range(200):
            reading = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "t_ms": now_base + i * 100,
                "x": 0.05 + 0.01 * (i % 5),
                "y": -0.02,
                "z": 0.98,
                "hp": 0.035,
                "rms": 0.055,
                "freq": 4.8,
                "tremor": 1 if i > 50 else 0,
                "alert": 0,
                "btn": 0,
            }
            db_session_manager.handle_incoming_reading(reading)

        # 4. Stop session
        stop_res = self.client.post(f"/api/sessions/{s1_id}/stop")
        self.assertEqual(stop_res.status_code, 200)
        self.assertIsNotNone(stop_res.json()["ended_at"])

        # Stopping again is harmless no-op
        stop_again = self.client.post(f"/api/sessions/{s1_id}/stop")
        self.assertEqual(stop_again.status_code, 200)

        # Active check should now be false
        active_res2 = self.client.get("/api/sessions/active")
        self.assertFalse(active_res2.json()["active"])

    def test_csv_export_format_and_streaming(self):
        # Create person and session with 200 readings
        code = f"C{int(time.time()) % 10000:04d}"
        p_res = self.client.post("/api/people", json={"code": code})
        person_id = p_res.json()["id"]

        s_res = self.client.post("/api/sessions/start", json={
            "person_id": person_id,
            "type": "normal",
            "label": "walking"
        })
        session_id = s_res.json()["id"]

        for i in range(200):
            reading = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "t_ms": 50000 + i * 100,
                "x": 0.01,
                "y": 0.02,
                "z": 0.99,
                "hp": 0.012,
                "rms": 0.042,
                "freq": 5.2,
                "tremor": 1,
                "alert": 0,
                "btn": 0,
            }
            db_session_manager.handle_incoming_reading(reading)

        self.client.post(f"/api/sessions/{session_id}/stop")

        # 1. Test Session CSV Export
        csv_res = self.client.get(f"/api/sessions/{session_id}/export.csv")
        self.assertEqual(csv_res.status_code, 200)
        lines = csv_res.text.strip().split("\n")

        # Line 1: Disclaimer starting with '# '
        self.assertTrue(lines[0].startswith("# "))
        self.assertIn(DISCLAIMER_TEXT, lines[0])

        # Line 2: Header
        expected_header = "person_code,session_id,timestamp_iso,t_ms,x,y,z,hp,rms,freq,tremor,alert,btn,session_type,label"
        self.assertEqual(lines[1], expected_header)

        # 200 data rows
        self.assertEqual(len(lines), 202)
        sample_row = lines[2].split(",")
        self.assertEqual(sample_row[0], code)
        self.assertEqual(sample_row[1], session_id)
        self.assertEqual(sample_row[13], "normal")
        self.assertEqual(sample_row[14], "walking")

        # 2. Test Person All Data CSV Export
        p_csv_res = self.client.get(f"/api/people/{person_id}/export.csv")
        self.assertEqual(p_csv_res.status_code, 200)
        p_lines = p_csv_res.text.strip().split("\n")
        self.assertEqual(len(p_lines), 202)

    def test_empty_person_csv_export(self):
        # Empty person with no sessions
        code = f"E{int(time.time()) % 10000:04d}"
        p_res = self.client.post("/api/people", json={"code": code})
        person_id = p_res.json()["id"]

        res = self.client.get(f"/api/people/{person_id}/export.csv")
        self.assertEqual(res.status_code, 200)
        lines = res.text.strip().split("\n")
        
        # Only disclaimer and header
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[0].startswith("# "))
        self.assertEqual(lines[1], "person_code,session_id,timestamp_iso,t_ms,x,y,z,hp,rms,freq,tremor,alert,btn,session_type,label")


if __name__ == "__main__":
    unittest.main()
