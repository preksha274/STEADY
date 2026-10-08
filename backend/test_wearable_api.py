"""
Test suite for Wearable Storage, Compression, Validation, and Summary API.
"""

import os
import gzip
import json
import unittest
from datetime import datetime, timezone
from steady_ai.wearable_storage import wearable_storage, RAW_STORAGE_DIR


class TestWearableAPI(unittest.TestCase):
    def test_wearable_validation_and_timestamps(self):
        # 1. Valid sample
        raw_sample = {
            "ms": 12500,
            "ax": 0.05,
            "ay": -0.12,
            "az": 0.98,
            "hp": 0.02,
            "rms": 0.085,
            "freq": 4.9,
            "tremor": 1,
            "state": 0,
            "drops": 0
        }
        enriched = wearable_storage.validate_and_enrich_sample(raw_sample)
        self.assertIsNotNone(enriched, "Valid sample should be parsed")
        self.assertIn("server_timestamp_utc", enriched)
        self.assertIn("session_id", enriched)
        self.assertTrue(enriched["assessed"])

        # 2. Bad / Out of range sample
        bad_sample = {
            "ms": 12600,
            "ax": 999.0,  # Invalid acceleration
            "ay": 0.0,
            "az": 1.0,
        }
        bad_count_before = wearable_storage.bad_lines_count
        enriched_bad = wearable_storage.validate_and_enrich_sample(bad_sample)
        self.assertIsNone(enriched_bad)
        self.assertEqual(wearable_storage.bad_lines_count, bad_count_before + 1)

    def test_wearable_raw_compression(self):
        batch = [
            {"ms": i * 10, "ax": 0.01 * i, "ay": 0.02, "az": 0.98, "hp": 0.01, "rms": 0.06, "freq": 4.8, "tremor": 0, "state": 0, "drops": 0}
            for i in range(50)
        ]
        wearable_storage.ingest_samples(batch)
        wearable_storage.flush_raw_buffer()
        
        files = [f for f in os.listdir(RAW_STORAGE_DIR) if f.endswith(".json.gz")]
        self.assertTrue(len(files) > 0, "Raw gzip compressed files must be created")
        
        latest_file = os.path.join(RAW_STORAGE_DIR, files[-1])
        with gzip.open(latest_file, "rt", encoding="utf-8") as gz_f:
            lines = gz_f.readlines()
            self.assertTrue(len(lines) > 0, "Compressed file must contain valid JSON lines")

    def test_wearable_summary_and_series(self):
        for rng in ["day", "week", "month", "all"]:
            summary = wearable_storage.get_summary(time_range=rng)
            self.assertIn("total_minutes_tracked", summary)
            self.assertIn("total_tremor_minutes", summary)
            self.assertIn("overall_tremor_pct", summary)
            self.assertIn("severity", summary)
            self.assertTrue(0.0 <= summary["overall_tremor_pct"] <= 100.0)
            
            series = wearable_storage.get_series(time_range=rng)
            self.assertIsInstance(series, list)
            if len(series) > 0:
                self.assertIn("severity_level", series[0])

    def test_mock_websocket_100_readings_buffer_and_display(self):
        """
        Feeds 100 mock readings through the wearable stream and verifies:
        1. All 100 readings are parsed and ingested into serial_source buffer.
        2. Latest readings buffer retains the latest readings for live charting.
        3. GET /api/wearable/latest returns accurately formatted readings with 3-decimal precision.
        """
        from fastapi.testclient import TestClient
        from main import app
        from wearable_serial import serial_source
        from api.wearable_routes import on_hardware_reading_received

        client = TestClient(app)

        # 1. Feed 100 mock readings
        for i in range(100):
            mock_line = f'{{"t":{1000 + i*100},"x":{0.01 + i*0.001:.4f},"y":-0.02,"z":0.98,"hp":0.005,"rms":{0.05 + (i%5)*0.01:.4f},"freq":4.8,"tremor":{1 if i%2==0 else 0},"alert":0,"btn":0}}'
            reading = serial_source.parse_line(mock_line)
            self.assertIsNotNone(reading)
            on_hardware_reading_received(reading)

        # 2. Check latest buffer in serial_source
        latest_buf = serial_source.get_latest_readings(50)
        self.assertEqual(len(latest_buf), 50)
        self.assertEqual(latest_buf[-1]["t_ms"], 1000 + 99*100)

        # 3. Test HTTP /api/wearable/latest endpoint
        res = client.get("/api/wearable/latest?n=25")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 25)
        self.assertAlmostEqual(data[-1]["x"], round(0.01 + 99*0.001, 4), places=3)
        self.assertAlmostEqual(data[-1]["z"], 0.98, places=2)


if __name__ == "__main__":
    unittest.main()
