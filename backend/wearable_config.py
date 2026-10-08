"""
STEADY - Wearable Configuration Constants
Single source of truth for hardware ingestion, baseline calibration, rule alerts,
and system-wide non-diagnostic disclaimers.
"""

import os

# Hardware & Serial Communications
SERIAL_PORT = os.getenv("SERIAL_PORT", "COM5")
SERIAL_BAUD = 115200

# Telemetry Timing & State Thresholds
STALE_DATA_SECONDS = 3            # No reading for this long => status 'No data'
READINGS_PER_SECOND_EXPECTED = 10  # Expected 10 Hz telemetry line rate
DB_BATCH_SECONDS = 1              # Batch interval for reading persistence

# Movement DSP Thresholds
TREMOR_RMS_G = 0.04               # Same value as the firmware, used for the chart threshold line
REST_RMS_G = 0.015                # RMS below this counts as rest (prototype threshold)

# Personal Baseline Settings
BASELINE_SECONDS = 60             # Duration of a baseline recording session
BASELINE_MIN_VALID_SECONDS = 30   # A baseline session needs at least this much valid data
BASELINE_EPSILON = 0.01           # Baseline tremor share below this => show plain difference, not percent

# Alert Engine Rules
RULE_WINDOW_SECONDS = 120         # Rolling window for elevated movement rule check
RULE_MARGIN_POINTS = 15           # Percentage points above baseline tremor share
RULE_COOLDOWN_SECONDS = 60        # Minimum cooldown period between rule-triggered alerts
BAND_ALERT_SUPPRESS_SECONDS = 5   # Ignore a band alert this soon after the backend sent V

# Live Chart Configuration
LIVE_CHART_XYZ_SECONDS = 10       # Display window for raw XYZ acceleration
LIVE_CHART_RMS_SECONDS = 60       # Display window for 1s strength RMS

# Non-diagnostic Compliance Disclaimer
DISCLAIMER_TEXT = "Prototype for movement monitoring and decision support only. It is not a medical device and does not provide a diagnosis."
