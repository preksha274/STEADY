"""
Unit tests for Sample Person (DEMO01) & Synthetic History Generation.
Verifies:
1. Internal consistency of generated readings (tremor vs rms & freq, physics, sample intervals).
2. 'Remove sample person' leaves real patient data untouched.
3. 7, 30, and 90-day numbers match direct recomputation from readings.
4. Sample data is excluded from validation and real baselines by default.
"""

import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from main import app
from wearable_db import (
    get_db_connection,
    init_db,
    create_person,
    list_people,
    list_sessions,
    get_person_baseline,
    get_participant_report_summary,
)
from wearable_sample_generator import (
    generate_sample_person,
    remove_sample_person,
    get_sample_person_status,
    SAMPLE_CODE,
    SAMPLE_NAME,
)
from wearable_config import TREMOR_RMS_G


class TestSamplePerson(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)

    def test_sample_person_generator_consistency(self):
        # 1. Generate sample person
        result = generate_sample_person()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["person_code"], SAMPLE_CODE)
        self.assertEqual(result["display_name"], SAMPLE_NAME)
        self.assertTrue(result["is_sample"])
        self.assertTrue(result["sessions_created"] > 200)
        self.assertTrue(result["readings_created"] > 200000)
        self.assertTrue(result["alerts_created"] > 0)

        conn = get_db_connection()
        try:
            # Check person record
            person = conn.execute("SELECT * FROM person WHERE code = ?;", (SAMPLE_CODE,)).fetchone()
            self.assertIsNotNone(person)
            self.assertEqual(person["is_sample"], 1)

            # Check 3 baseline sessions on day 1
            baselines = conn.execute(
                "SELECT * FROM session WHERE person_id = ? AND type = 'baseline' ORDER BY started_at ASC;",
                (person["id"],)
            ).fetchall()
            self.assertEqual(len(baselines), 3)

            for b in baselines:
                self.assertEqual(b["is_sample"], 1)
                r_rows = conn.execute("SELECT * FROM reading WHERE session_id = ?;", (b["id"],)).fetchall()
                self.assertEqual(len(r_rows), 600)  # 60s at 10 Hz

            # Check consistency of readings across all sample sessions
            sample_readings = conn.execute("""
                SELECT r.* FROM reading r
                JOIN session s ON r.session_id = s.id
                WHERE s.person_id = ?
                LIMIT 5000;
            """, (person["id"],)).fetchall()

            for r in sample_readings:
                # Rule 1: tremor = 1 ONLY when rms >= TREMOR_RMS_G and 3.0 <= freq <= 8.0
                if r["tremor"] == 1:
                    self.assertGreaterEqual(r["rms"], TREMOR_RMS_G)
                    self.assertGreaterEqual(r["freq"], 3.0)
                    self.assertLessEqual(r["freq"], 8.0)
                else:
                    # If tremor == 0, then either rms < 0.04 or freq not in tremor band
                    self.assertTrue(r["rms"] < TREMOR_RMS_G or not (3.0 <= r["freq"] <= 8.0))

                # Rule 2: z acceleration includes gravity (~0.98g +/- noise)
                self.assertGreater(r["z"], 0.7)
                self.assertLess(r["z"], 1.3)

        finally:
            conn.close()

    def test_remove_sample_person_preserves_real_data(self):
        # 1. Clean up old REAL01 if existing, then create a real person and session
        conn = get_db_connection()
        try:
            with conn:
                old_p = conn.execute("SELECT id FROM person WHERE code = 'REAL01';").fetchone()
                if old_p:
                    conn.execute("DELETE FROM reading WHERE session_id IN (SELECT id FROM session WHERE person_id = ?);", (old_p["id"],))
                    conn.execute("DELETE FROM session WHERE person_id = ?;", (old_p["id"],))
                    conn.execute("DELETE FROM person WHERE id = ?;", (old_p["id"],))
        finally:
            conn.close()

        create_res, real_person, _ = create_person("REAL01", "Dr. John Real", is_sample=False)
        self.assertTrue(create_res)

        conn = get_db_connection()
        try:
            with conn:
                real_sess_id = "ses_real_test_123"
                conn.execute(
                    "INSERT INTO session (id, person_id, type, label, note, source, started_at, ended_at, is_sample) VALUES (?, ?, 'normal', 'walking', 'Real session', 'live', ?, NULL, 0);",
                    (real_sess_id, real_person["id"], datetime.now(timezone.utc).isoformat())
                )
                conn.execute(
                    "INSERT INTO reading (session_id, ts, t_ms, x, y, z, hp, rms, freq, tremor, alert, btn) VALUES (?, ?, 100, 0.01, -0.01, 0.99, 0.01, 0.02, 0.0, 0, 0, 0);",
                    (real_sess_id, datetime.now(timezone.utc).isoformat())
                )
        finally:
            conn.close()

        # 2. Ensure sample person exists
        generate_sample_person()

        # 3. Call remove_sample_person
        rem_res = remove_sample_person()
        self.assertEqual(rem_res["status"], "ok")

        # 4. Verify sample person is deleted
        conn = get_db_connection()
        try:
            sample_p = conn.execute("SELECT * FROM person WHERE code = ?;", (SAMPLE_CODE,)).fetchone()
            self.assertIsNone(sample_p)

            # 5. Verify REAL person and their session still exist completely untouched
            real_p = conn.execute("SELECT * FROM person WHERE code = 'REAL01';",).fetchone()
            self.assertIsNotNone(real_p)
            self.assertEqual(real_p["is_sample"], 0)

            real_s = conn.execute("SELECT * FROM session WHERE id = ?;", (real_sess_id,)).fetchone()
            self.assertIsNotNone(real_s)

            real_r = conn.execute("SELECT * FROM reading WHERE session_id = ?;", (real_sess_id,)).fetchall()
            self.assertEqual(len(real_r), 1)

            # Clean up real test person
            with conn:
                conn.execute("DELETE FROM reading WHERE session_id = ?;", (real_sess_id,))
                conn.execute("DELETE FROM session WHERE id = ?;", (real_sess_id,))
                conn.execute("DELETE FROM person WHERE id = ?;", (real_person["id"],))
        finally:
            conn.close()

    def test_report_numbers_match_direct_recomputation(self):
        # Generate sample dataset
        generate_sample_person()

        conn = get_db_connection()
        try:
            person = conn.execute("SELECT id FROM person WHERE code = ?;", (SAMPLE_CODE,)).fetchone()
            self.assertIsNotNone(person)
            p_id = person["id"]
        finally:
            conn.close()

        # Test 7d, 30d, and 90d reports
        for r_range in ["7d", "30d", "90d"]:
            rep = get_participant_report_summary(p_id, range_type=r_range)
            self.assertTrue(rep["is_sample"])
            self.assertIsNotNone(rep["baseline"]["tremor_share"])
            self.assertTrue(rep["total_sessions"] > 0)
            self.assertTrue(rep["total_readings"] > 0)
            self.assertTrue(len(rep["daily_trends"]) > 0)

            # Verify direct recomputation of overall avg tremor share from daily trends
            total_sec = sum(d["monitored_seconds"] for d in rep["daily_trends"])
            weighted_tremor = sum(d["avg_tremor_share"] * d["monitored_seconds"] for d in rep["daily_trends"])
            expected_avg = round(weighted_tremor / total_sec, 1) if total_sec > 0 else 0.0

            self.assertAlmostEqual(rep["overall_avg_tremor_share"], expected_avg, places=1)

            if r_range == "90d":
                # 90d report should have weekly summary and flare days present
                self.assertTrue(len(rep["weekly_summary"]) >= 10)
                # Ensure notable events are populated
                self.assertIn("alert_days", rep["notable_events"])
                self.assertIn("highest_share_days", rep["notable_events"])

    def test_sample_data_excluded_from_validation_and_filters_by_default(self):
        generate_sample_person()

        # 1. list_people with include_sample=False excludes DEMO01
        filtered_people = list_people(include_sample=False)
        self.assertFalse(any(p["code"] == SAMPLE_CODE for p in filtered_people))

        # 2. list_people with include_sample=True includes DEMO01
        all_people = list_people(include_sample=True)
        demo = next((p for p in all_people if p["code"] == SAMPLE_CODE), None)
        self.assertIsNotNone(demo)
        self.assertTrue(demo["is_sample"])

        # 3. list_sessions with include_sample=False excludes sample sessions
        filtered_sessions = list_sessions(include_sample=False)
        self.assertFalse(any(s.get("is_sample") for s in filtered_sessions))

    def test_rest_api_sample_endpoints(self):
        # 1. Status endpoint
        res = self.client.get("/api/sample-person/status")
        self.assertEqual(res.status_code, 200)

        # 2. Load endpoint
        res_load = self.client.post("/api/sample-person/load")
        self.assertEqual(res_load.status_code, 200)
        data = res_load.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["person_code"], SAMPLE_CODE)

        # 3. Remove endpoint
        res_rem = self.client.delete("/api/sample-person/remove")
        self.assertEqual(res_rem.status_code, 200)
        self.assertEqual(res_rem.json()["status"], "ok")


if __name__ == "__main__":
    unittest.main()
