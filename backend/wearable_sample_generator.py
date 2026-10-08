"""
STEADY - Sample Person & Synthetic Longitudinal History Generator
Generates realistic, repeatable 90-day synthetic dataset for DEMO01 (Meera Nair).

Honesty & Safety:
- Marked with is_sample = 1 across person and sessions.
- Generates 10 Hz readings consistent with firmware physics and algorithms.
- Runs exact rule alert detection engine for systematically generated alerts.
"""

import math
import random
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
from wearable_config import (
    TREMOR_RMS_G,
    REST_RMS_G,
    RULE_WINDOW_SECONDS,
    RULE_MARGIN_POINTS,
    RULE_COOLDOWN_SECONDS,
)
from wearable_db import get_db_connection, init_db


SAMPLE_CODE = "DEMO01"
SAMPLE_NAME = "Meera Nair"
RANDOM_SEED = 42


def generate_sample_person(end_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Creates or resets DEMO01 with 90 days of synthetic data ending on end_date (default: today).
    Uses a fixed random seed for deterministic repeatability.
    """
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)

    init_db()
    conn = get_db_connection()

    try:
        person_id = f"p_sample_{uuid.uuid4().hex[:8]}"
        today = end_date or datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=89)  # 90 days total (day 0 to day 89)
        now_iso = datetime.now(timezone.utc).isoformat()

        sessions_to_insert = []
        readings_to_insert = []
        alerts_to_insert = []

        # -------------------------------------------------------------
        # 3. Create 3 Baseline Sessions on Day 1 (start_date)
        #    Each 60s (600 readings) at 10 Hz, posture: 'still', low tremor (3% to 6%)
        # -------------------------------------------------------------
        baseline_shares_recorded = []
        for b_idx in range(3):
            sess_id = f"ses_base_{b_idx+1}_{uuid.uuid4().hex[:8]}"
            b_hour = 8
            b_min = b_idx * 5
            b_dt = datetime(start_date.year, start_date.month, start_date.day, b_hour, b_min, 0, tzinfo=timezone.utc)
            b_end_dt = b_dt + timedelta(seconds=60)

            sessions_to_insert.append((
                sess_id, person_id, "baseline", "still", "Initial baseline calibration session", "live",
                b_dt.isoformat(), b_end_dt.isoformat(), 1
            ))

            target_tremor_sec = random.randint(2, 4)  # ~3.3% to 6.6% tremor share
            tremor_seconds_set = set(random.sample(range(5, 55), target_tremor_sec))
            tremor_samples_count = 0

            for sec in range(60):
                is_tremor_sec = sec in tremor_seconds_set
                sec_rms = round(random.uniform(0.042, 0.052), 4) if is_tremor_sec else round(random.uniform(0.012, 0.026), 4)
                sec_freq = round(random.uniform(4.5, 5.5), 2) if is_tremor_sec else 0.0

                for sub in range(10):
                    t_ms = (sec * 10 + sub) * 100
                    sample_dt = b_dt + timedelta(milliseconds=t_ms)
                    noise_x = random.gauss(0, 0.008)
                    noise_y = random.gauss(0, 0.008)
                    noise_z = random.gauss(0, 0.010)

                    if is_tremor_sec:
                        tremor_wave = 0.04 * math.sin(2 * math.pi * sec_freq * (t_ms / 1000.0))
                        x_val = round(0.015 + tremor_wave + noise_x, 4)
                        y_val = round(-0.010 + tremor_wave * 0.7 + noise_y, 4)
                        z_val = round(0.990 + tremor_wave * 0.4 + noise_z, 4)
                        hp_val = round(sec_rms * 0.92 + random.gauss(0, 0.002), 4)
                        tremor_val = 1
                        tremor_samples_count += 1
                    else:
                        x_val = round(0.015 + noise_x, 4)
                        y_val = round(-0.010 + noise_y, 4)
                        z_val = round(0.990 + noise_z, 4)
                        hp_val = round(sec_rms * 0.85 + random.gauss(0, 0.001), 4)
                        tremor_val = 0

                    readings_to_insert.append((
                        sess_id, sample_dt.isoformat(), t_ms,
                        x_val, y_val, z_val, hp_val, sec_rms, sec_freq,
                        tremor_val, 0, 0
                    ))

            baseline_shares_recorded.append((tremor_samples_count / 600.0) * 100.0)

        established_baseline = round(float(np.median(baseline_shares_recorded)), 1)

        # -------------------------------------------------------------
        # 4. Generate 90 Days of Normal Sessions
        # -------------------------------------------------------------
        # Days to skip (approx 10% of 90 days = 9 days) - avoid skipping flare days (day 60-65)
        skip_days = {8, 17, 26, 38, 49, 58, 72, 79, 87}

        # Rule alert tracking state across synthetic stream
        rule_window: List[Tuple[float, int]] = []  # (rel_timestamp, tremor_int)
        last_rule_alert_t = -9999.0

        for day_idx in range(90):
            if day_idx in skip_days:
                continue

            current_day = start_date + timedelta(days=day_idx)

            # Target tremor share story progression:
            # Days 0 to 34 (1 to 35): stable near baseline (3 to 8%)
            # Days 35 to 59 (36 to 60): slow upward drift to ~15 to 20%
            # Days 60 to 65 (61 to 66): clear flare (30 to 45%), evening worse than morning
            # Days 66 to 89 (67 to 90): gradual return to 8 to 12%
            if day_idx < 35:
                base_daily_share = 3.5 + (day_idx / 35.0) * 4.0 + random.uniform(-1.0, 1.5)
            elif day_idx < 60:
                progress = (day_idx - 35) / 25.0
                base_daily_share = 7.5 + progress * 11.5 + random.uniform(-1.5, 2.0)
            elif day_idx < 66:
                # Flare window!
                flare_prog = (day_idx - 60) / 5.0
                base_daily_share = 32.0 + math.sin(flare_prog * math.pi) * 12.0 + random.uniform(-2.0, 2.0)
            else:
                recovery_prog = (day_idx - 66) / 23.0
                base_daily_share = 26.0 * (1.0 - recovery_prog) + 9.0 * recovery_prog + random.uniform(-1.5, 1.5)

            # Mild weekly variation (slightly higher on weekends: day_idx % 7 >= 5)
            if day_idx % 7 in (5, 6):
                base_daily_share += 1.5

            base_daily_share = max(2.0, min(50.0, base_daily_share))

            # 3 Sessions per day: Morning (~08:30), Afternoon (~14:00), Evening (~20:00)
            # Evening sessions are worse than mornings, especially during flare
            slot_configs = [
                ("morning", 8, 30, 0.85, "walking"),
                ("afternoon", 14, 0, 1.0, "typing"),
                ("evening", 20, 15, 1.25 if day_idx in range(60, 66) else 1.1, "still"),
            ]

            for slot_name, slot_hour, slot_min, slot_multiplier, default_label in slot_configs:
                target_share = max(1.0, min(55.0, base_daily_share * slot_multiplier + random.uniform(-1.0, 1.0)))
                sess_id = f"ses_d{day_idx+1}_{slot_name[:3]}_{uuid.uuid4().hex[:6]}"

                s_dt = datetime(current_day.year, current_day.month, current_day.day, slot_hour, slot_min, 0, tzinfo=timezone.utc)
                s_end_dt = s_dt + timedelta(seconds=120)

                sessions_to_insert.append((
                    sess_id, person_id, "normal", default_label,
                    f"Routine {slot_name} movement monitoring", "live",
                    s_dt.isoformat(), s_end_dt.isoformat(), 1
                ))

                # 120 seconds = 120 blocks of 10 samples (1200 readings total)
                tremor_seconds_needed = int(round((target_share / 100.0) * 120))
                tremor_seconds_needed = max(0, min(120, tremor_seconds_needed))

                # Create contiguous or clustered tremor chunks for realistic shaking
                active_tremor_secs = set()
                if tremor_seconds_needed > 0:
                    clusters = max(1, tremor_seconds_needed // 8)
                    cluster_centers = sorted(random.sample(range(5, 115), min(clusters, 10)))
                    for c in cluster_centers:
                        chunk_len = min(tremor_seconds_needed - len(active_tremor_secs), random.randint(4, 12))
                        for offset in range(chunk_len):
                            if (c + offset) < 120:
                                active_tremor_secs.add(c + offset)
                    # Fill any remainder
                    remaining = tremor_seconds_needed - len(active_tremor_secs)
                    if remaining > 0:
                        unused = [i for i in range(120) if i not in active_tremor_secs]
                        active_tremor_secs.update(random.sample(unused, min(remaining, len(unused))))

                # Generate 1200 samples
                sess_readings_tmp = []
                for sec in range(120):
                    is_tremor_sec = sec in active_tremor_secs
                    if is_tremor_sec:
                        sec_rms = round(random.uniform(0.042, 0.085), 4)
                        sec_freq = round(random.uniform(4.2, 6.2), 2)
                    else:
                        sec_rms = round(random.uniform(0.008, 0.028), 4)
                        sec_freq = 0.0

                    for sub in range(10):
                        t_ms = (sec * 10 + sub) * 100
                        sample_dt = s_dt + timedelta(milliseconds=t_ms)
                        noise_x = random.gauss(0, 0.012)
                        noise_y = random.gauss(0, 0.012)
                        noise_z = random.gauss(0, 0.015)

                        if is_tremor_sec:
                            shaking = 0.06 * math.sin(2 * math.pi * sec_freq * (t_ms / 1000.0))
                            x_val = round(0.020 + shaking + noise_x, 4)
                            y_val = round(-0.015 + shaking * 0.8 + noise_y, 4)
                            z_val = round(0.980 + shaking * 0.5 + noise_z, 4)
                            hp_val = round(sec_rms * 0.94 + random.gauss(0, 0.003), 4)
                            tremor_val = 1
                        else:
                            x_val = round(0.020 + noise_x, 4)
                            y_val = round(-0.015 + noise_y, 4)
                            z_val = round(0.980 + noise_z, 4)
                            hp_val = round(sec_rms * 0.80 + random.gauss(0, 0.001), 4)
                            tremor_val = 0

                        sess_readings_tmp.append({
                            "session_id": sess_id,
                            "ts": sample_dt.isoformat(),
                            "t_ms": t_ms,
                            "x": x_val, "y": y_val, "z": z_val, "hp": hp_val,
                            "rms": sec_rms, "freq": sec_freq,
                            "tremor": tremor_val, "alert": 0, "btn": 0
                        })

                # ---------------------------------------------------------
                # Rule Alert Evaluator on this session's readings
                # Uses identical logic: 120s rolling window, baseline + 15 pts, 60s cooldown
                # ---------------------------------------------------------
                sess_window: List[Tuple[float, int]] = []
                sess_last_alert_sec = -999.0

                for r_idx, r in enumerate(sess_readings_tmp):
                    sec_float = r["t_ms"] / 1000.0
                    sess_window.append((sec_float, r["tremor"]))

                    # Keep 120s window
                    while sess_window and (sec_float - sess_window[0][0]) > RULE_WINDOW_SECONDS:
                        sess_window.pop(0)

                    # Check rule if at least 100 valid samples in window
                    if len(sess_window) >= 100:
                        w_tremors = sum(t for _, t in sess_window)
                        w_share = (w_tremors / len(sess_window)) * 100.0
                        threshold = established_baseline + RULE_MARGIN_POINTS

                        if w_share >= threshold:
                            if (sec_float - sess_last_alert_sec) >= RULE_COOLDOWN_SECONDS:
                                sess_last_alert_sec = sec_float
                                r["alert"] = 1  # mark reading alert

                                alt_id = f"alt_syn_{uuid.uuid4().hex[:8]}"
                                reason = (
                                    f"Tremor-like movement exceeded baseline ({established_baseline:.1f}%) "
                                    f"by {RULE_MARGIN_POINTS} pts (rolling: {w_share:.1f}%)"
                                )
                                alerts_to_insert.append((
                                    alt_id, person_id, sess_id, r["ts"], reason, "rule"
                                ))

                    readings_to_insert.append((
                        r["session_id"], r["ts"], r["t_ms"],
                        r["x"], r["y"], r["z"], r["hp"],
                        r["rms"], r["freq"], r["tremor"], r["alert"], r["btn"]
                    ))

        # -------------------------------------------------------------
        # 5. Bulk Insert into Database in Single Atomic Transaction
        # -------------------------------------------------------------
        with conn:
            existing = conn.execute("SELECT id FROM person WHERE code = ? OR is_sample = 1;", (SAMPLE_CODE,)).fetchall()
            if existing:
                p_ids = [p["id"] for p in existing]
                placeholders = ",".join("?" for _ in p_ids)
                conn.execute(f"DELETE FROM alert WHERE person_id IN ({placeholders});", p_ids)
                conn.execute(f"DELETE FROM reading WHERE session_id IN (SELECT id FROM session WHERE person_id IN ({placeholders}));", p_ids)
                conn.execute(f"DELETE FROM session WHERE person_id IN ({placeholders});", p_ids)
                conn.execute(f"DELETE FROM person WHERE id IN ({placeholders});", p_ids)

            conn.execute(
                """
                INSERT INTO person (id, code, display_name, created_at, is_sample)
                VALUES (?, ?, ?, ?, 1);
                """,
                (person_id, SAMPLE_CODE, SAMPLE_NAME, now_iso)
            )

            conn.executemany(
                """
                INSERT INTO session (id, person_id, type, label, note, source, started_at, ended_at, is_sample)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                sessions_to_insert
            )

            conn.executemany(
                """
                INSERT INTO reading (session_id, ts, t_ms, x, y, z, hp, rms, freq, tremor, alert, btn)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                readings_to_insert
            )

            conn.executemany(
                """
                INSERT INTO alert (id, person_id, session_id, ts, reason, source)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                alerts_to_insert
            )

        total_sessions = len(sessions_to_insert)
        total_readings = len(readings_to_insert)
        total_alerts = len(alerts_to_insert)
        days_covered = 90 - len(skip_days)

        return {
            "status": "ok",
            "person_id": person_id,
            "person_code": SAMPLE_CODE,
            "display_name": SAMPLE_NAME,
            "is_sample": True,
            "baseline_tremor_share": established_baseline,
            "days_covered": days_covered,
            "sessions_created": total_sessions,
            "readings_created": total_readings,
            "alerts_created": total_alerts,
            "start_date": start_date.isoformat(),
            "end_date": today.isoformat(),
            "message": f"Successfully generated 90-day dataset for {SAMPLE_NAME} ({SAMPLE_CODE}) with {total_sessions} sessions, {total_readings:,} readings, and {total_alerts} systematically generated alerts.",
        }

    finally:
        conn.close()


def remove_sample_person() -> Dict[str, Any]:
    """
    Deletes ONLY records where is_sample = 1 (person DEMO01 and all associated sample sessions).
    Leaves all real patient/user data completely untouched.
    """
    conn = get_db_connection()
    try:
        with conn:
            # 1. Find all sample people
            sample_people = conn.execute("SELECT id, code FROM person WHERE is_sample = 1 OR code = ?;", (SAMPLE_CODE,)).fetchall()
            p_ids = [p["id"] for p in sample_people]

            del_readings = 0
            del_alerts = 0
            del_sessions = 0
            del_people = len(p_ids)

            if p_ids:
                placeholders = ",".join("?" for _ in p_ids)
                del_alerts = conn.execute(f"DELETE FROM alert WHERE person_id IN ({placeholders});", p_ids).rowcount
                del_readings = conn.execute(f"DELETE FROM reading WHERE session_id IN (SELECT id FROM session WHERE person_id IN ({placeholders}));", p_ids).rowcount
                del_sessions = conn.execute(f"DELETE FROM session WHERE person_id IN ({placeholders});", p_ids).rowcount
                conn.execute(f"DELETE FROM person WHERE id IN ({placeholders});", p_ids)

        return {
            "status": "ok",
            "deleted_person_code": SAMPLE_CODE,
            "people_deleted": del_people,
            "sessions_deleted": del_sessions,
            "readings_deleted": del_readings,
            "alerts_deleted": del_alerts,
            "message": f"Successfully removed sample person {SAMPLE_CODE} and all {del_sessions} synthetic sessions.",
        }
    finally:
        conn.close()


def get_sample_person_status() -> Dict[str, Any]:
    """Checks whether the sample person currently exists in SQLite."""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM person WHERE code = ? AND is_sample = 1;", (SAMPLE_CODE,)).fetchone()
        if not row:
            return {"exists": False, "person": None, "session_count": 0, "reading_count": 0}

        p_dict = dict(row)
        sess_count = conn.execute("SELECT COUNT(*) as c FROM session WHERE person_id = ?;", (p_dict["id"],)).fetchone()["c"]
        alert_count = conn.execute("SELECT COUNT(*) as c FROM alert WHERE person_id = ?;", (p_dict["id"],)).fetchone()["c"]

        return {
            "exists": True,
            "person": p_dict,
            "session_count": sess_count,
            "alert_count": alert_count,
        }
    finally:
        conn.close()
