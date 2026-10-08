"""
Unit and integration tests for Phase 8: Replay & Validation Engine
Tests:
1. ReplayReadingSource CSV parsing and sample extraction.
2. Playback state transitions: idle -> playing -> paused -> playing -> stopped.
3. Replay command handling (simulated band 'V' vibration).
4. REST endpoints:
   - POST /api/replay/load with presets and custom CSV.
   - POST /api/replay/start, pause, resume, stop.
   - GET /api/replay/status.
"""

import unittest
import time
from fastapi.testclient import TestClient
from main import app
from wearable_replay import ReplayReadingSource


class TestPhase8Replay(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.source = ReplayReadingSource()

    def test_csv_parsing_steady_export(self):
        # Scenario 1: Export with '# ' disclaimer comment line
        csv_text = """# STEADY Telemetry CSV Export - Confidential
person_code,session_id,timestamp_iso,t_ms,x,y,z,hp,rms,freq,tremor,alert,btn,session_type,label
P01,ses_123,2026-10-09T00:00:00Z,100,0.012,-0.003,0.998,0.004,0.052,5.1,1,0,0,normal,still
P01,ses_123,2026-10-09T00:00:01Z,200,0.015,-0.002,0.995,0.003,0.021,0.0,0,0,0,normal,still
"""
        ok, count, err, meta = self.source.load_csv(csv_text, "test_steady.csv")
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(count, 2)
        self.assertEqual(self.source.samples[0]["t_ms"], 100)
        self.assertEqual(self.source.samples[0]["rms"], 0.052)
        self.assertEqual(self.source.samples[0]["tremor"], 1)
        self.assertEqual(meta["rows_used"], 2)
        self.assertEqual(meta["rows_skipped"], 0)

    def test_csv_parsing_wrist_monitor_legacy(self):
        # Scenario 2: wrist-monitor.html style CSV with aliases (ax, ay, az, time_ms, mag, is_tremor)
        csv_text = """time_ms,ax,ay,az,mag,is_tremor,activity
1000,0.05,-0.02,0.98,0.065,1,drinking
1100,0.04,-0.01,0.99,0.030,0,drinking
1200,0.06,-0.03,0.97,0.072,1,drinking
"""
        ok, count, err, meta = self.source.load_csv(csv_text, "wrist_monitor.csv")
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(count, 3)
        self.assertEqual(self.source.samples[0]["x"], 0.05)
        self.assertEqual(self.source.samples[0]["rms"], 0.065)
        self.assertEqual(self.source.samples[0]["tremor"], 1)
        self.assertEqual(meta["label"], "drinking")
        self.assertAlmostEqual(meta["tremor_share"], 66.7, places=1)

    def test_csv_parsing_bom_and_crlf(self):
        # Scenario 3: UTF-8 BOM with Windows CRLF line endings
        csv_text = "\ufeff# Disclaimer line\r\nx,y,z,rms,freq,t_ms\r\n0.01,0.02,0.99,0.045,4.5,500\r\n0.02,0.03,0.98,0.055,4.8,600\r\n"
        ok, count, err, meta = self.source.load_csv(csv_text, "bom_crlf.csv")
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(count, 2)
        self.assertEqual(self.source.samples[0]["z"], 0.99)
        self.assertEqual(meta["rows_used"], 2)

    def test_csv_parsing_empty_file(self):
        # Scenario 4: Empty file or comment-only file
        ok, count, err, meta = self.source.load_csv("", "empty.csv")
        self.assertFalse(ok)
        self.assertEqual(count, 0)
        self.assertIn("empty", err.lower())

        ok2, count2, err2, meta2 = self.source.load_csv("# Only a comment\n# Another comment\n", "comments_only.csv")
        self.assertFalse(ok2)
        self.assertEqual(count2, 0)
        self.assertIn("comments", err2.lower())

    def test_csv_parsing_missing_column(self):
        # Scenario 5: File with missing required columns (no acceleration / RMS)
        csv_text = "patient_id,age,gender,notes\n101,65,M,tremor observed\n102,70,F,resting\n"
        ok, count, err, meta = self.source.load_csv(csv_text, "missing_cols.csv")
        self.assertFalse(ok)
        self.assertEqual(count, 0)
        self.assertIn("missing", err.lower())

    def test_replay_playback_lifecycle(self):
        csv_text = "t_ms,x,y,z,hp,rms,freq,tremor,alert,btn\n" + "\n".join(
            f"{i*100},0.01,0.02,0.98,0.004,0.05,5.0,1,0,0" for i in range(10)
        )
        self.source.load_csv(csv_text, "playback_test.csv")
        
        # Start at 20x speed for quick test
        started = self.source.start_replay(speed=20.0)
        self.assertTrue(started)
        self.assertEqual(self.source.status_state, "playing")

        # Pause
        self.source.pause_replay()
        self.assertEqual(self.source.status_state, "paused")

        # Resume
        self.source.resume_replay()
        self.assertEqual(self.source.status_state, "playing")

        # Command vibration
        self.source.send_command("V")
        status = self.source.get_status()
        self.assertEqual(status["vibrations_count"], 1)

        # Stop
        self.source.stop()
        self.assertIn(self.source.status_state, ["completed", "idle"])

    def test_replay_rest_endpoints(self):
        # 1. Load preset
        res_load = self.client.post("/api/replay/load", json={"preset": "demo_short"})
        self.assertEqual(res_load.status_code, 200)
        data = res_load.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["sample_count"] > 0)

        # 2. Get status
        res_status = self.client.get("/api/replay/status")
        self.assertEqual(res_status.status_code, 200)
        self.assertEqual(res_status.json()["state"], "idle")

        # 3. Start replay
        res_start = self.client.post("/api/replay/start", json={"speed": 5.0})
        self.assertEqual(res_start.status_code, 200)
        self.assertEqual(res_start.json()["state"], "playing")

        # 4. Pause
        res_pause = self.client.post("/api/replay/pause")
        self.assertEqual(res_pause.status_code, 200)
        self.assertEqual(res_pause.json()["state"], "paused")

        # 5. Resume
        res_resume = self.client.post("/api/replay/resume")
        self.assertEqual(res_resume.status_code, 200)
        self.assertEqual(res_resume.json()["state"], "playing")

        # 6. Stop
        res_stop = self.client.post("/api/replay/stop")
        self.assertEqual(res_stop.status_code, 200)
        self.assertEqual(res_stop.json()["state"], "idle")


if __name__ == "__main__":
    unittest.main()
