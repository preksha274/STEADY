"""
Integration test for Phase 5: Personal Baseline Workflow and Calibration.
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
from wearable_db import init_db, db_session_manager, get_person_baseline


class TestPhase5Baseline(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db()
        db_session_manager.stop_session()

    def test_baseline_lifecycle_and_insufficient_data(self):
        # 1. Create Person
        code = f"B{int(time.time()) % 10000:04d}"
        p_res = self.client.post("/api/people", json={"code": code, "display_name": "Baseline Subject"})
        person_id = p_res.json()["id"]

        # Initial baseline must be null
        b0 = self.client.get(f"/api/people/{person_id}/baseline").json()
        self.assertIsNone(b0["tremor_share"])
        self.assertEqual(b0["sessions_used"], 0)

        # 2. Incomplete / Insufficient Baseline (< 30s valid, e.g. 15s = 150 samples)
        s_short_res = self.client.post("/api/sessions/start", json={
            "person_id": person_id,
            "type": "baseline",
            "label": "still",
            "note": "Cancelled early"
        })
        s_short_id = s_short_res.json()["id"]

        # Ingest 150 samples (15s)
        for i in range(150):
            db_session_manager.handle_incoming_reading({
                "ts": datetime.now(timezone.utc).isoformat(),
                "t_ms": 1000 + i * 100,
                "x": 0.01,
                "y": 0.01,
                "z": 0.99,
                "hp": 0.005,
                "rms": 0.01,
                "freq": 0.0,
                "tremor": 0,
                "alert": 0,
                "btn": 0,
            })
        self.client.post(f"/api/sessions/{s_short_id}/stop")

        # Baseline should STILL be null because 15s < 30s minimum
        b_short = self.client.get(f"/api/people/{person_id}/baseline").json()
        self.assertIsNone(b_short["tremor_share"])
        self.assertEqual(b_short["sessions_used"], 0)

        # 3. Full 60s Still Baseline (600 samples, 10 tremor samples = 1.67% ~ 1.7% tremor share)
        s_full_res = self.client.post("/api/sessions/start", json={
            "person_id": person_id,
            "type": "baseline",
            "label": "still",
            "note": "60s resting baseline"
        })
        s_full_id = s_full_res.json()["id"]

        for i in range(600):
            is_tremor = 1 if i < 10 else 0
            db_session_manager.handle_incoming_reading({
                "ts": datetime.now(timezone.utc).isoformat(),
                "t_ms": 20000 + i * 100,
                "x": 0.01,
                "y": 0.01,
                "z": 0.99,
                "hp": 0.008,
                "rms": 0.045 if is_tremor else 0.012,
                "freq": 4.8 if is_tremor else 0.0,
                "tremor": is_tremor,
                "alert": 0,
                "btn": 0,
            })
        self.client.post(f"/api/sessions/{s_full_id}/stop")

        # Baseline should now be valid
        b_valid = self.client.get(f"/api/people/{person_id}/baseline").json()
        self.assertIsNotNone(b_valid["tremor_share"])
        self.assertAlmostEqual(b_valid["tremor_share"], 1.7, places=1)
        self.assertEqual(b_valid["sessions_used"], 1)

        # 4. Normal Session with Deliberate Shaking (300 samples, 240 tremor samples = 80.0%)
        s_shake_res = self.client.post("/api/sessions/start", json={
            "person_id": person_id,
            "type": "normal",
            "label": "shaking"
        })
        s_shake_id = s_shake_res.json()["id"]

        for i in range(300):
            is_tremor = 1 if i < 240 else 0
            db_session_manager.handle_incoming_reading({
                "ts": datetime.now(timezone.utc).isoformat(),
                "t_ms": 90000 + i * 100,
                "x": 0.15,
                "y": 0.20,
                "z": 0.95,
                "hp": 0.065,
                "rms": 0.075 if is_tremor else 0.02,
                "freq": 5.2 if is_tremor else 0.0,
                "tremor": is_tremor,
                "alert": 0,
                "btn": 0,
            })
        self.client.post(f"/api/sessions/{s_shake_id}/stop")

        # 5. Check Sessions List for Person: Change from baseline must be clearly positive
        sessions = self.client.get(f"/api/sessions?person_id={person_id}").json()
        shake_session = next(s for s in sessions if s["id"] == s_shake_id)
        self.assertEqual(shake_session["tremor_share"], 80.0)
        self.assertIsNotNone(shake_session["change_from_baseline"])
        # Change should be positive
        self.assertGreater(shake_session["change_from_baseline"]["value"], 0)


if __name__ == "__main__":
    unittest.main()
