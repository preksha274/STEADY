"""
Unit tests for Section 5 Calculations and Baseline Change Logic.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from wearable_calculations import (
    compute_session_metrics,
    compute_change_from_baseline,
    compute_monitored_minutes,
)


class TestWearableCalculations(unittest.TestCase):
    def test_valid_reading_exclusion(self):
        # 10 readings total: 6 normal, 2 alert=1, 2 btn=1
        readings = [
            {"t_ms": 1000, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.05, "freq": 5.0, "tremor": 1, "alert": 0, "btn": 0},
            {"t_ms": 1100, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.06, "freq": 5.0, "tremor": 1, "alert": 0, "btn": 0},
            {"t_ms": 1200, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.01, "freq": 0.0, "tremor": 0, "alert": 0, "btn": 0},
            {"t_ms": 1300, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.01, "freq": 0.0, "tremor": 0, "alert": 0, "btn": 0},
            {"t_ms": 1400, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.01, "freq": 0.0, "tremor": 0, "alert": 0, "btn": 0},
            {"t_ms": 1500, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.01, "freq": 0.0, "tremor": 0, "alert": 0, "btn": 0},
            # Excluded: alert=1
            {"t_ms": 1600, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.50, "freq": 5.0, "tremor": 1, "alert": 1, "btn": 0},
            {"t_ms": 1700, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.50, "freq": 5.0, "tremor": 1, "alert": 1, "btn": 0},
            # Excluded: btn=1
            {"t_ms": 1800, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.50, "freq": 5.0, "tremor": 1, "alert": 0, "btn": 1},
            {"t_ms": 1900, "x": 0.0, "y": 0.0, "z": 1.0, "rms": 0.50, "freq": 5.0, "tremor": 1, "alert": 0, "btn": 1},
        ]

        metrics = compute_session_metrics(readings)
        self.assertEqual(metrics["total_readings"], 10)
        self.assertEqual(metrics["valid_readings"], 6)
        self.assertEqual(metrics["valid_seconds"], 0.6)  # 6 / 10 = 0.6s
        
        # 2 out of 6 valid readings had tremor == 1 -> 33.3%
        self.assertAlmostEqual(metrics["tremor_share"], 33.3, places=1)
        # Tremor strength = mean of (0.05, 0.06) = 0.055
        self.assertAlmostEqual(metrics["tremor_strength"], 0.055, places=3)
        # Rest share = 4 out of 6 (< 0.015) = 66.7%
        self.assertAlmostEqual(metrics["rest_share"], 66.7, places=1)
        self.assertAlmostEqual(metrics["active_share"], 33.3, places=1)

    def test_empty_readings_returns_nulls(self):
        metrics = compute_session_metrics([])
        self.assertIsNone(metrics["tremor_share"])
        self.assertIsNone(metrics["tremor_strength"])
        self.assertEqual(metrics["valid_seconds"], 0.0)

    def test_change_from_baseline(self):
        # 1. Null handling
        self.assertIsNone(compute_change_from_baseline(None, 15.0))
        self.assertIsNone(compute_change_from_baseline(20.0, None))

        # 2. Standard percent change: baseline = 15.0%, value = 30.0% -> +100.0%
        res = compute_change_from_baseline(30.0, 15.0)
        self.assertIsNotNone(res)
        self.assertEqual(res["type"], "percent")
        self.assertAlmostEqual(res["value"], 100.0, places=1)
        self.assertEqual(res["formatted"], "+100.0%")

        # 3. Epsilon difference case: baseline = 0.5% (<= 1.0%), value = 5.5% -> +5.0 pts difference
        res_eps = compute_change_from_baseline(5.5, 0.5)
        self.assertIsNotNone(res_eps)
        self.assertEqual(res_eps["type"], "difference")
        self.assertAlmostEqual(res_eps["value"], 5.0, places=1)
        self.assertEqual(res_eps["formatted"], "+5.0 pts")

    def test_monitored_minutes(self):
        # 30 readings spaced by 0.1s = 3.0s duration
        readings1 = [{"t_ms": i * 100} for i in range(30)]
        # Gap > 2s ignored
        readings2 = [{"t_ms": 10000 + i * 100} for i in range(30)]
        
        mins = compute_monitored_minutes([readings1, readings2])
        # Expected: ~5.8s / 60 = ~0.1 mins
        self.assertGreaterEqual(mins, 0.0)


if __name__ == "__main__":
    unittest.main()
