"""
Integration test for Phase 1 Wearable Ingestion endpoints and WebSockets.
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from main import app
from wearable_serial import serial_source


class TestPhase1Endpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_get_wearable_status(self):
        response = self.client.get("/api/wearable/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("connected", data)
        self.assertIn("port", data)
        self.assertIn("state", data)
        self.assertIn("mpu_ok", data)
        self.assertIn("readings_per_second", data)
        self.assertIn("skipped_lines", data)
        self.assertIn("legacy_lines", data)
        self.assertIn("last_bad_line", data)
        
        # State should be a valid enum
        valid_states = {"connected", "no_data", "port_busy", "port_missing", "legacy_format", "disconnected"}
        self.assertIn(data["state"], valid_states)

    def test_post_vibrate_when_disconnected(self):
        # Force state disconnected for test
        serial_source.raw_state = "disconnected"
        response = self.client.post("/api/wearable/vibrate")
        self.assertEqual(response.status_code, 409)
        self.assertIn("Band is not connected", response.json()["detail"])

    def test_websocket_wearable_connection(self):
        with self.client.websocket_connect("/ws/wearable") as websocket:
            # Successfully connected
            pass


if __name__ == "__main__":
    unittest.main()
