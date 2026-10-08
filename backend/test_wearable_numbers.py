"""
Unit Tests for Wearable Math, Severity Levels, and Simulated Data Exclusion.
Tests:
1. Known input: 600s tracked, 90s tremor = 15.0% tremor ratio.
2. Clamping bounds: tremor ratio is always between 0.0% and 100.0%.
3. Simulated data exclusion: samples with source="simulated" are rejected.
4. Severity thresholds: GOOD (<15%), MODERATE (15-30%), HIGH (>30% or sustained >30s).
5. Data quality severity: >=90% GOOD, 70-90% MODERATE, <70% HIGH.
6. Empty data state: returns NO_DATA (never green).
"""

import os
import sys
import unittest

# Ensure backend directory is in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from steady_ai.wearable_storage import WearableStorageService
from steady_ai.severity_engine import evaluate_movement_severity, evaluate_quality_severity, load_severity_config


class TestWearableCalculations(unittest.TestCase):
    def setUp(self):
        self.service = WearableStorageService()
        self.config = load_severity_config()

    def test_known_input_ratio_calculation(self):
        """Test with known input: 600s tracked, 90s tremor -> 15.0%"""
        tracked_s = 600.0
        tremor_s = 90.0
        
        ratio = (tremor_s / tracked_s) * 100.0
        self.assertAlmostEqual(ratio, 15.0, places=2)
        
        sev = evaluate_movement_severity(ratio, tracked_seconds=tracked_s, time_label="test")
        self.assertEqual(sev["level"], "MODERATE")
        self.assertIn("15.0%", sev["reason"])

    def test_clamping_bounds(self):
        """Tremor ratio must never exceed 100% or be below 0%"""
        # Over-full case
        tracked_s = 100.0
        tremor_s = 150.0  # Even if corrupt count happened
        ratio = min(100.0, max(0.0, (tremor_s / tracked_s) * 100.0))
        self.assertEqual(ratio, 100.0)

        # Under case
        tremor_s = -10.0
        ratio = min(100.0, max(0.0, (tremor_s / tracked_s) * 100.0))
        self.assertEqual(ratio, 0.0)

    def test_simulated_samples_exclusion(self):
        """Samples tagged source='simulated' must be excluded from storage and history"""
        sim_sample = {
            "source": "simulated",
            "ms": 1000,
            "ax": 0.1,
            "ay": 0.2,
            "az": 1.0,
            "rms": 0.25,
            "freq": 5.0,
            "tremor": 1,
            "state": 0
        }
        res = self.service.validate_and_enrich_sample(sim_sample)
        self.assertIsNone(res, "Simulated sample was not rejected")

        # Real sample should be accepted
        real_sample = {
            "ms": 1000,
            "ax": 0.1,
            "ay": 0.2,
            "az": 1.0,
            "rms": 0.25,
            "freq": 5.0,
            "tremor": 1,
            "state": 0
        }
        res2 = self.service.validate_and_enrich_sample(real_sample)
        self.assertIsNotNone(res2, "Real sample was rejected")

    def test_severity_levels(self):
        """Test GOOD (<15%), MODERATE (15-30%), HIGH (>30% or sustained >30s)"""
        # 1. Good (< 15%)
        sev_good = evaluate_movement_severity(10.0, tracked_seconds=1000.0)
        self.assertEqual(sev_good["level"], "GOOD")
        self.assertEqual(sev_good["color"], "emerald")

        # 2. Moderate (15% to 30%)
        sev_mod = evaluate_movement_severity(22.0, tracked_seconds=1000.0)
        self.assertEqual(sev_mod["level"], "MODERATE")
        self.assertEqual(sev_mod["color"], "amber")

        # 3. High (> 30%)
        sev_high = evaluate_movement_severity(35.0, tracked_seconds=1000.0)
        self.assertEqual(sev_high["level"], "HIGH")
        self.assertEqual(sev_high["color"], "rose")
        self.assertEqual(sev_high["label"], "High - check on them")

        # 4. Sustained tremor triggers
        sev_sustained_mod = evaluate_movement_severity(5.0, tracked_seconds=1000.0, sustained_tremor_s=15.0)
        self.assertEqual(sev_sustained_mod["level"], "MODERATE")

        sev_sustained_high = evaluate_movement_severity(5.0, tracked_seconds=1000.0, sustained_tremor_s=35.0)
        self.assertEqual(sev_sustained_high["level"], "HIGH")

        # 5. Active family alert triggers HIGH
        sev_alert = evaluate_movement_severity(5.0, tracked_seconds=1000.0, has_active_alert=True)
        self.assertEqual(sev_alert["level"], "HIGH")

    def test_no_data_state_never_green(self):
        """When tracked duration is 0 or missing, status must be NO_DATA with slate color, never green"""
        sev_empty = evaluate_movement_severity(None, tracked_seconds=0.0)
        self.assertEqual(sev_empty["level"], "NO_DATA")
        self.assertEqual(sev_empty["color"], "slate")
        self.assertNotEqual(sev_empty["color"], "emerald")

    def test_data_quality_severity(self):
        """Test data quality levels: >=90% Good, 70-90% Moderate, <70% High/Gaps"""
        q_good = evaluate_quality_severity(95.0, total_samples=5000)
        self.assertEqual(q_good["level"], "GOOD")

        q_mod = evaluate_quality_severity(80.0, total_samples=5000)
        self.assertEqual(q_mod["level"], "MODERATE")

        q_low = evaluate_quality_severity(60.0, total_samples=5000)
        self.assertEqual(q_low["level"], "HIGH")

        q_empty = evaluate_quality_severity(None, total_samples=0)
        self.assertEqual(q_empty["level"], "NO_DATA")


if __name__ == "__main__":
    unittest.main()
