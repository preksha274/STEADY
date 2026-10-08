"""
Unit tests for Wearable Serial Parser, State Machine, and Ingestion Logic.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from wearable_serial import SerialReadingSource


class TestSerialParser(unittest.TestCase):
    def setUp(self):
        self.source = SerialReadingSource(port="TEST_PORT", baud=115200)

    def test_parse_valid_json_reading(self):
        line = '{"t":123456,"x":0.012,"y":-0.003,"z":0.998,"hp":0.0041,"rms":0.0523,"freq":5.1,"tremor":1,"alert":0,"btn":0}'
        reading = self.source.parse_line(line)
        self.assertIsNotNone(reading)
        self.assertEqual(reading["t_ms"], 123456)
        self.assertAlmostEqual(reading["x"], 0.012)
        self.assertAlmostEqual(reading["y"], -0.003)
        self.assertAlmostEqual(reading["z"], 0.998)
        self.assertAlmostEqual(reading["hp"], 0.0041)
        self.assertAlmostEqual(reading["rms"], 0.0523)
        self.assertAlmostEqual(reading["freq"], 5.1)
        self.assertEqual(reading["tremor"], 1)
        self.assertEqual(reading["alert"], 0)
        self.assertEqual(reading["btn"], 0)
        self.assertIn("ts", reading)

    def test_parse_boot_line(self):
        # Boot OK
        boot_line_ok = '{"boot":1,"mpu":1}'
        res = self.source.parse_line(boot_line_ok)
        self.assertIsNone(res)  # Boot line does not emit sample
        self.assertTrue(self.source.mpu_ok)

        # Boot MPU Failed
        boot_line_fail = '{"boot":1,"mpu":0}'
        res = self.source.parse_line(boot_line_fail)
        self.assertIsNone(res)
        self.assertFalse(self.source.mpu_ok)

    def test_parse_legacy_text_format(self):
        legacy_line = 'x=-240 y=-24 z=16000'
        res = self.source.parse_line(legacy_line)
        self.assertIsNone(res)
        self.assertEqual(self.source.legacy_lines, 1)
        self.assertEqual(self.source.get_state(), "legacy_format")

    def test_parse_garbage_lines(self):
        garbage = "GARBAGE_RANDOM_STREAM_DATA"
        res = self.source.parse_line(garbage)
        self.assertIsNone(res)
        self.assertEqual(self.source.skipped_lines, 1)
        self.assertEqual(self.source.last_bad_line, garbage)

        malformed_json = '{"t": 100, "x": '
        res2 = self.source.parse_line(malformed_json)
        self.assertIsNone(res2)
        self.assertEqual(self.source.skipped_lines, 2)
        self.assertEqual(self.source.last_bad_line, malformed_json.strip())

    def test_status_payload_structure(self):
        status = self.source.get_status()
        self.assertIn("connected", status)
        self.assertIn("port", status)
        self.assertIn("state", status)
        self.assertIn("mpu_ok", status)
        self.assertIn("last_reading_at", status)
        self.assertIn("readings_per_second", status)
        self.assertIn("skipped_lines", status)
        self.assertIn("legacy_lines", status)
        self.assertIn("last_bad_line", status)

    def test_send_command_when_disconnected(self):
        # Sending when port is not open must safely return False without exception
        res = self.source.send_command("V")
        self.assertFalse(res)


if __name__ == "__main__":
    unittest.main()
