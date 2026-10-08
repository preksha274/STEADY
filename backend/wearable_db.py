"""
STEADY - SQLite Data Storage & Session Management Engine
Implements Section 4 data models:
- person: id, code (unique), display_name (nullable), created_at
- session: id, person_id, type ('baseline'|'normal'), label, note, source, started_at, ended_at
- reading: id, session_id, ts (UTC), t_ms, x, y, z, hp, rms, freq, tremor, alert, btn
- alert: id, person_id, session_id, ts, reason, source ('band'|'rule'|'test')
Includes batched ingestion, crash recovery, and streaming CSV export queries.
"""

import os
import sqlite3
import time
import uuid
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Iterator, Tuple


from wearable_config import (
    DB_BATCH_SECONDS,
    DISCLAIMER_TEXT,
    REST_RMS_G,
    TREMOR_RMS_G,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "storage_db", "wearable.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Initialize database tables, indices, and recover active sessions on restart."""
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS person (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                display_name TEXT,
                created_at TEXT NOT NULL,
                is_sample INTEGER DEFAULT 0
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS session (
                id TEXT PRIMARY KEY,
                person_id TEXT NOT NULL,
                type TEXT NOT NULL,
                label TEXT,
                note TEXT,
                source TEXT DEFAULT 'live',
                started_at TEXT NOT NULL,
                ended_at TEXT,
                is_sample INTEGER DEFAULT 0,
                FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reading (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                t_ms INTEGER NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                z REAL NOT NULL,
                hp REAL NOT NULL,
                rms REAL NOT NULL,
                freq REAL NOT NULL,
                tremor INTEGER NOT NULL,
                alert INTEGER NOT NULL,
                btn INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alert (
                id TEXT PRIMARY KEY,
                person_id TEXT NOT NULL,
                session_id TEXT,
                ts TEXT NOT NULL,
                reason TEXT NOT NULL,
                source TEXT NOT NULL,
                FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE SET NULL
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reading_session_ts ON reading (session_id, ts);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_session_person ON session (person_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_alert_person ON alert (person_id);")

        # Schema Migration: Ensure is_sample column exists on person and session tables
        person_cols = [r["name"] for r in conn.execute("PRAGMA table_info(person);").fetchall()]
        if "is_sample" not in person_cols:
            conn.execute("ALTER TABLE person ADD COLUMN is_sample INTEGER DEFAULT 0;")

        sess_cols = [r["name"] for r in conn.execute("PRAGMA table_info(session);").fetchall()]
        if "is_sample" not in sess_cols:
            conn.execute("ALTER TABLE session ADD COLUMN is_sample INTEGER DEFAULT 0;")

        # Crash recovery: If backend restarts while session is active (ended_at IS NULL), close it
        active_sessions = conn.execute("SELECT id, started_at FROM session WHERE ended_at IS NULL;").fetchall()
        for s in active_sessions:
            s_id = s["id"]
            # Find last reading timestamp or fallback to started_at
            last_reading = conn.execute(
                "SELECT ts FROM reading WHERE session_id = ? ORDER BY ts DESC LIMIT 1;", (s_id,)
            ).fetchone()
            end_ts = last_reading["ts"] if last_reading else s["started_at"]
            conn.execute("UPDATE session SET ended_at = ? WHERE id = ?;", (end_ts, s_id))
            print(f"[WEARABLE DB] Recovered unclosed session {s_id} with ended_at = {end_ts}")
    conn.close()


class SessionStorageService:
    """Manages active session lifecycle and batched inserts from live telemetry."""
    def __init__(self):
        self.active_session: Optional[Dict[str, Any]] = None
        self._buffer: List[Dict[str, Any]] = []
        self._last_flush_time: float = time.time()
        self._lock = os.path.exists(DB_PATH) # initialized

    def start_session(
        self,
        person_id: str,
        session_type: str = "normal",
        label: Optional[str] = None,
        note: Optional[str] = None,
        source: str = "live"
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Starts a new session. Returns (success, session_dict, error_message).
        Only ONE session can be active at a time.
        """
        if self.active_session is not None:
            return False, {}, "A session is already active. Stop the current session first."

        conn = get_db_connection()
        try:
            person = conn.execute("SELECT id, code, display_name, is_sample FROM person WHERE id = ?;", (person_id,)).fetchone()
            if not person:
                return False, {}, f"Person with id '{person_id}' not found."

            session_id = f"ses_{uuid.uuid4().hex[:12]}"
            now_iso = datetime.now(timezone.utc).isoformat()
            is_sample_val = 1 if person["is_sample"] else 0
            
            with conn:
                conn.execute(
                    """
                    INSERT INTO session (id, person_id, type, label, note, source, started_at, ended_at, is_sample)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?);
                    """,
                    (session_id, person_id, session_type, label, note, source, now_iso, is_sample_val)
                )

            session_doc = {
                "id": session_id,
                "person_id": person_id,
                "person_code": person["code"],
                "type": session_type,
                "label": label,
                "note": note,
                "source": source,
                "started_at": now_iso,
                "ended_at": None,
                "is_sample": bool(is_sample_val),
            }
            self.active_session = session_doc
            self._buffer = []
            self._last_flush_time = time.time()
            return True, session_doc, None
        finally:
            conn.close()

    def stop_session(self, session_id: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Stops active session and flushes buffered readings.
        Harmless no-op if session already stopped.
        """
        self.flush_buffer()
        
        conn = get_db_connection()
        try:
            target_id = session_id or (self.active_session["id"] if self.active_session else None)
            if not target_id:
                return True, None

            row = conn.execute("SELECT * FROM session WHERE id = ?;", (target_id,)).fetchone()
            if not row:
                return False, None

            if row["ended_at"] is None:
                now_iso = datetime.now(timezone.utc).isoformat()
                with conn:
                    conn.execute("UPDATE session SET ended_at = ? WHERE id = ?;", (now_iso, target_id))
                updated = conn.execute("SELECT * FROM session WHERE id = ?;", (target_id,)).fetchone()
                res = dict(updated)
            else:
                res = dict(row)

            if self.active_session and self.active_session["id"] == target_id:
                self.active_session = None

            return True, res
        finally:
            conn.close()

    def handle_incoming_reading(self, reading: Dict[str, Any]) -> None:
        """Called on every valid reading from serial or replay stream."""
        if not self.active_session:
            return

        reading_entry = {
            "session_id": self.active_session["id"],
            "ts": reading["ts"],
            "t_ms": reading["t_ms"],
            "x": reading["x"],
            "y": reading["y"],
            "z": reading["z"],
            "hp": reading["hp"],
            "rms": reading["rms"],
            "freq": reading["freq"],
            "tremor": reading["tremor"],
            "alert": reading["alert"],
            "btn": reading["btn"],
        }
        self._buffer.append(reading_entry)

        # Batch insert check (every DB_BATCH_SECONDS or >= 10 readings)
        now = time.time()
        if len(self._buffer) >= 10 or (now - self._last_flush_time) >= DB_BATCH_SECONDS:
            self.flush_buffer()

    def flush_buffer(self) -> None:
        """Commits buffered readings into SQLite in a single transaction."""
        if not self._buffer:
            return

        to_insert = self._buffer
        self._buffer = []
        self._last_flush_time = time.time()

        conn = get_db_connection()
        try:
            with conn:
                conn.executemany(
                    """
                    INSERT INTO reading (session_id, ts, t_ms, x, y, z, hp, rms, freq, tremor, alert, btn)
                    VALUES (:session_id, :ts, :t_ms, :x, :y, :z, :hp, :rms, :freq, :tremor, :alert, :btn);
                    """,
                    to_insert
                )
        except Exception as e:
            print(f"[WEARABLE DB] Batch insert error: {e}")
        finally:
            conn.close()

    def get_active_session(self) -> Optional[Dict[str, Any]]:
        return self.active_session


# Person CRUD
def create_person(code: str, display_name: Optional[str] = None, is_sample: bool = False) -> Tuple[bool, Dict[str, Any], Optional[str]]:
    code_clean = code.strip().upper()
    if not (2 <= len(code_clean) <= 12):
        return False, {}, "Person code must be between 2 and 12 characters."

    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT id FROM person WHERE code = ?;", (code_clean,)).fetchone()
        if existing:
            return False, {}, f"Person code '{code_clean}' already exists."

        person_id = f"p_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        is_samp_val = 1 if is_sample else 0
        with conn:
            conn.execute(
                "INSERT INTO person (id, code, display_name, created_at, is_sample) VALUES (?, ?, ?, ?, ?);",
                (person_id, code_clean, display_name.strip() if display_name else None, now_iso, is_samp_val)
            )

        return True, {
            "id": person_id,
            "code": code_clean,
            "display_name": display_name.strip() if display_name else None,
            "created_at": now_iso,
            "is_sample": bool(is_samp_val),
        }, None
    finally:
        conn.close()


def list_people(include_sample: bool = True) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        query = """
            SELECT p.id, p.code, p.display_name, p.created_at, p.is_sample,
                   COUNT(s.id) AS session_count,
                   MAX(s.started_at) AS last_session_at
            FROM person p
            LEFT JOIN session s ON p.id = s.person_id
        """
        if not include_sample:
            query += " WHERE p.is_sample = 0"
        query += " GROUP BY p.id ORDER BY p.code ASC;"
        
        rows = conn.execute(query).fetchall()
        res = []
        for r in rows:
            d = dict(r)
            d["is_sample"] = bool(d.get("is_sample", 0))
            res.append(d)
        return res
    finally:
        conn.close()


def get_person_by_id(person_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM person WHERE id = ?;", (person_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["is_sample"] = bool(d.get("is_sample", 0))
        return d
    finally:
        conn.close()


# Session Querying & Baseline Computation
from wearable_calculations import (
    compute_session_metrics,
    compute_change_from_baseline,
)
from wearable_config import BASELINE_MIN_VALID_SECONDS


def get_person_baseline(person_id: str) -> Dict[str, Any]:
    """
    Computes median tremor_share and median tremor_strength across baseline sessions
    with valid_seconds >= BASELINE_MIN_VALID_SECONDS.
    """
    conn = get_db_connection()
    try:
        baseline_sessions = conn.execute("""
            SELECT id, started_at
            FROM session
            WHERE person_id = ? AND type = 'baseline' AND ended_at IS NOT NULL
            ORDER BY started_at ASC;
        """, (person_id,)).fetchall()

        valid_shares = []
        valid_strengths = []
        last_recorded_at = None

        for s in baseline_sessions:
            s_id = s["id"]
            readings = conn.execute("SELECT t_ms, rms, freq, tremor, alert, btn FROM reading WHERE session_id = ? ORDER BY ts ASC;", (s_id,)).fetchall()
            m = compute_session_metrics([dict(r) for r in readings])
            if m["valid_seconds"] >= BASELINE_MIN_VALID_SECONDS and m["tremor_share"] is not None:
                valid_shares.append(m["tremor_share"])
                if m["tremor_strength"] is not None:
                    valid_strengths.append(m["tremor_strength"])
                last_recorded_at = s["started_at"]

        if not valid_shares:
            return {
                "person_id": person_id,
                "tremor_share": None,
                "tremor_strength": None,
                "sessions_used": 0,
                "recorded_at": None,
            }

        return {
            "person_id": person_id,
            "tremor_share": round(float(np.median(valid_shares)), 1),
            "tremor_strength": round(float(np.median(valid_strengths)), 4) if valid_strengths else None,
            "sessions_used": len(valid_shares),
            "recorded_at": last_recorded_at,
        }
    finally:
        conn.close()


def list_sessions(person_id: Optional[str] = None, include_sample: bool = True) -> List[Dict[str, Any]]:
    """
    Returns historical sessions enriched with Section 5 calculation metrics.
    """
    conn = get_db_connection()
    try:
        if person_id:
            query = """
                SELECT s.*, p.code AS person_code
                FROM session s
                JOIN person p ON s.person_id = p.id
                WHERE s.person_id = ?
            """
            params = [person_id]
            if not include_sample:
                query += " AND s.is_sample = 0"
            query += " ORDER BY s.started_at DESC;"
            rows = conn.execute(query, params).fetchall()
        else:
            query = """
                SELECT s.*, p.code AS person_code
                FROM session s
                JOIN person p ON s.person_id = p.id
            """
            if not include_sample:
                query += " WHERE s.is_sample = 0"
            query += " ORDER BY s.started_at DESC;"
            rows = conn.execute(query).fetchall()

        # Cache baseline per person
        baseline_cache: Dict[str, Dict[str, Any]] = {}
        enriched_list = []

        for r in rows:
            s_dict = dict(r)
            s_id = s_dict["id"]
            p_id = s_dict["person_id"]
            s_dict["is_sample"] = bool(s_dict.get("is_sample", 0))

            if p_id not in baseline_cache:
                baseline_cache[p_id] = get_person_baseline(p_id)
            baseline = baseline_cache[p_id]

            readings = conn.execute("SELECT t_ms, rms, freq, tremor, alert, btn FROM reading WHERE session_id = ? ORDER BY ts ASC;", (s_id,)).fetchall()
            metrics = compute_session_metrics([dict(x) for x in readings])

            change_obj = compute_change_from_baseline(metrics["tremor_share"], baseline["tremor_share"])

            s_dict.update({
                "duration_s": metrics["duration_s"],
                "valid_seconds": metrics["valid_seconds"],
                "tremor_share": metrics["tremor_share"],
                "tremor_strength": metrics["tremor_strength"],
                "rest_share": metrics["rest_share"],
                "active_share": metrics["active_share"],
                "change_from_baseline": change_obj,
            })
            enriched_list.append(s_dict)

        return enriched_list
    finally:
        conn.close()


def create_alert(
    person_id: str,
    reason: str,
    source: str,
    session_id: Optional[str] = None,
    ts: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        alert_id = f"alt_{uuid.uuid4().hex[:10]}"
        now_iso = ts or datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute(
                """
                INSERT INTO alert (id, person_id, session_id, ts, reason, source)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (alert_id, person_id, session_id, now_iso, reason, source)
            )
        person = conn.execute("SELECT code FROM person WHERE id = ?;", (person_id,)).fetchone()
        p_code = person["code"] if person else ""
        return {
            "id": alert_id,
            "person_id": person_id,
            "person_code": p_code,
            "session_id": session_id,
            "ts": now_iso,
            "reason": reason,
            "source": source,
        }
    finally:
        conn.close()


def list_alerts(
    person_id: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        if session_id:
            rows = conn.execute("""
                SELECT a.*, p.code AS person_code
                FROM alert a
                JOIN person p ON a.person_id = p.id
                WHERE a.session_id = ?
                ORDER BY a.ts DESC
                LIMIT ?;
            """, (session_id, limit)).fetchall()
        elif person_id:
            rows = conn.execute("""
                SELECT a.*, p.code AS person_code
                FROM alert a
                JOIN person p ON a.person_id = p.id
                WHERE a.person_id = ?
                ORDER BY a.ts DESC
                LIMIT ?;
            """, (person_id, limit)).fetchall()
        else:
            rows = conn.execute("""
                SELECT a.*, p.code AS person_code
                FROM alert a
                JOIN person p ON a.person_id = p.id
                ORDER BY a.ts DESC
                LIMIT ?;
            """, (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_session_alerts(session_id: str) -> List[Dict[str, Any]]:
    return list_alerts(session_id=session_id, limit=500)


def get_session_timeline(session_id: str, max_points: int = 500) -> Dict[str, Any]:
    """
    Returns session metadata, aggregated metrics, baseline comparison,
    associated alerts, and an evenly downsampled RMS timeseries for charts.
    """
    conn = get_db_connection()
    try:
        sess_row = conn.execute("""
            SELECT s.*, p.code AS person_code, p.display_name AS person_display_name
            FROM session s
            JOIN person p ON s.person_id = p.id
            WHERE s.id = ?;
        """, (session_id,)).fetchone()

        if not sess_row:
            return {}

        sess = dict(sess_row)
        sess["is_sample"] = bool(sess.get("is_sample", 0))
        p_id = sess["person_id"]
        baseline = get_person_baseline(p_id)

        readings_rows = conn.execute("""
            SELECT ts, t_ms, x, y, z, hp, rms, freq, tremor, alert, btn
            FROM reading
            WHERE session_id = ?
            ORDER BY ts ASC;
        """, (session_id,)).fetchall()

        readings = [dict(r) for r in readings_rows]
        metrics = compute_session_metrics(readings)
        change_obj = compute_change_from_baseline(metrics["tremor_share"], baseline["tremor_share"])

        alerts = get_session_alerts(session_id)

        # Downsample timeline points if large
        n = len(readings)
        step = max(1, n // max_points) if n > max_points else 1
        
        timeline_points = []
        for idx in range(0, n, step):
            r = readings[idx]
            timeline_points.append({
                "ts": r["ts"],
                "t_s": round(r["t_ms"] / 1000.0, 1),
                "rms": round(r["rms"], 4),
                "freq": round(r["freq"], 2),
                "tremor": r["tremor"],
                "alert": r["alert"],
                "btn": r["btn"],
            })

        return {
            "session": sess,
            "metrics": metrics,
            "change_from_baseline": change_obj,
            "baseline": baseline,
            "alerts": alerts,
            "timeline": timeline_points,
            "total_readings": n,
        }
    finally:
        conn.close()


def get_session_by_id(session_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("""
            SELECT s.*, p.code AS person_code
            FROM session s
            JOIN person p ON s.person_id = p.id
            WHERE s.id = ?;
        """, (session_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["is_sample"] = bool(d.get("is_sample", 0))
        return d
    finally:
        conn.close()


# Streaming CSV Generation
def stream_session_csv(session_id: str) -> Iterator[str]:
    """
    Streams CSV rows for a single session:
    First line: '# ' + DISCLAIMER_TEXT
    If sample: '# SAMPLE DATA: synthetic, generated for demonstration'
    Header: person_code,session_id,timestamp_iso,t_ms,x,y,z,hp,rms,freq,tremor,alert,btn,session_type,label
    """
    conn = get_db_connection()
    try:
        sess = get_session_by_id(session_id)
        yield f"# {DISCLAIMER_TEXT}\n"
        if sess and sess.get("is_sample"):
            yield "# SAMPLE DATA: synthetic, generated for demonstration\n"
        header = "person_code,session_id,timestamp_iso,t_ms,x,y,z,hp,rms,freq,tremor,alert,btn,session_type,label\n"
        yield header

        if not sess:
            return

        cursor = conn.execute("""
            SELECT r.ts, r.t_ms, r.x, r.y, r.z, r.hp, r.rms, r.freq, r.tremor, r.alert, r.btn
            FROM reading r
            WHERE r.session_id = ?
            ORDER BY r.ts ASC;
        """, (session_id,))

        p_code = sess["person_code"]
        s_type = sess["type"]
        s_label = sess["label"] or ""

        for row in cursor:
            line = (
                f"{p_code},{session_id},{row['ts']},{row['t_ms']},"
                f"{row['x']:.4f},{row['y']:.4f},{row['z']:.4f},{row['hp']:.4f},{row['rms']:.4f},{row['freq']:.2f},"
                f"{row['tremor']},{row['alert']},{row['btn']},{s_type},{s_label}\n"
            )
            yield line
    finally:
        conn.close()


def stream_person_csv(person_id: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> Iterator[str]:
    """
    Streams CSV rows across all sessions for a person.
    If sample: adds '# SAMPLE DATA: synthetic, generated for demonstration'
    """
    conn = get_db_connection()
    try:
        person = get_person_by_id(person_id)
        yield f"# {DISCLAIMER_TEXT}\n"
        if person and person.get("is_sample"):
            yield "# SAMPLE DATA: synthetic, generated for demonstration\n"
        header = "person_code,session_id,timestamp_iso,t_ms,x,y,z,hp,rms,freq,tremor,alert,btn,session_type,label\n"
        yield header

        if not person:
            return

        query = """
            SELECT s.id AS session_id, s.type AS session_type, s.label AS label,
                   r.ts, r.t_ms, r.x, r.y, r.z, r.hp, r.rms, r.freq, r.tremor, r.alert, r.btn
            FROM session s
            JOIN reading r ON s.id = r.session_id
            WHERE s.person_id = ?
        """
        params = [person_id]

        if from_date:
            query += " AND r.ts >= ?"
            params.append(f"{from_date}T00:00:00")
        if to_date:
            query += " AND r.ts <= ?"
            params.append(f"{to_date}T23:59:59")

        query += " ORDER BY r.ts ASC;"

        cursor = conn.execute(query, params)
        p_code = person["code"]

        for row in cursor:
            s_label = row["label"] or ""
            line = (
                f"{p_code},{row['session_id']},{row['ts']},{row['t_ms']},"
                f"{row['x']:.4f},{row['y']:.4f},{row['z']:.4f},{row['hp']:.4f},{row['rms']:.4f},{row['freq']:.2f},"
                f"{row['tremor']},{row['alert']},{row['btn']},{row['session_type']},{s_label}\n"
            )
            yield line
    finally:
        conn.close()

def get_participant_report_summary(
    person_id: str,
    range_type: str = "7d",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes multi-day (7d/30d/90d/Custom) aggregated analytics, daily trends,
    weekly summary tables, notable events, time-of-day distributions, and elevated risk episodes.
    """
    from datetime import datetime, timezone, timedelta, date

    person = get_person_by_id(person_id)
    if not person:
        return {}

    baseline = get_person_baseline(person_id)
    base_share = float(baseline.get("tremor_share") or 0.0)

    # Determine date cutoffs relative to to_date or today
    now = datetime.now(timezone.utc)
    ref_end_date = None
    if to_date:
        try:
            ref_end_date = datetime.strptime(to_date, "%Y-%m-%d").date()
        except ValueError:
            ref_end_date = now.date()
    else:
        ref_end_date = now.date()

    calc_from_date = from_date
    calc_to_date = to_date or ref_end_date.isoformat()

    if not from_date:
        if range_type == "7d":
            calc_from_date = (ref_end_date - timedelta(days=6)).isoformat()
        elif range_type == "30d":
            calc_from_date = (ref_end_date - timedelta(days=29)).isoformat()
        elif range_type == "90d":
            calc_from_date = (ref_end_date - timedelta(days=89)).isoformat()
        elif range_type == "all":
            calc_from_date = None

    conn = get_db_connection()
    try:
        # 1. Fetch filtered sessions
        sess_query = """
            SELECT * FROM session
            WHERE person_id = ?
        """
        params = [person_id]
        if calc_from_date:
            sess_query += " AND started_at >= ?"
            params.append(f"{calc_from_date}T00:00:00")
        if calc_to_date:
            sess_query += " AND started_at <= ?"
            params.append(f"{calc_to_date}T23:59:59")

        sess_query += " ORDER BY started_at ASC;"
        sess_rows = [dict(r) for r in conn.execute(sess_query, params).fetchall()]
        sess_ids = [s["id"] for s in sess_rows]

        # 2. Batch compute session metrics with indexed SQL aggregation
        session_metrics_map: Dict[str, Dict[str, Any]] = {}
        if sess_ids:
            for chunk_start in range(0, len(sess_ids), 400):
                chunk = sess_ids[chunk_start:chunk_start+400]
                placeholders = ",".join("?" for _ in chunk)
                stats_rows = conn.execute(f"""
                    SELECT session_id,
                           COUNT(*) as total_samples,
                           SUM(CASE WHEN alert = 0 AND btn = 0 THEN 1 ELSE 0 END) as valid_samples,
                           SUM(CASE WHEN tremor = 1 AND alert = 0 AND btn = 0 THEN 1 ELSE 0 END) as tremor_samples,
                           AVG(CASE WHEN tremor = 1 AND alert = 0 AND btn = 0 THEN rms ELSE NULL END) as tremor_rms,
                           AVG(CASE WHEN tremor = 1 AND alert = 0 AND btn = 0 THEN freq ELSE NULL END) as tremor_freq,
                           SUM(CASE WHEN rms < {REST_RMS_G} AND alert = 0 AND btn = 0 THEN 1 ELSE 0 END) as rest_samples
                    FROM reading
                    WHERE session_id IN ({placeholders})
                    GROUP BY session_id;
                """, chunk).fetchall()

                for st_r in stats_rows:
                    tot = st_r["total_samples"]
                    val = st_r["valid_samples"] or 0
                    t_samp = st_r["tremor_samples"] or 0
                    t_share = round((t_samp / val) * 100.0, 1) if val > 0 else 0.0
                    t_rms = round(float(st_r["tremor_rms"]), 4) if st_r["tremor_rms"] is not None else 0.0
                    t_freq = round(float(st_r["tremor_freq"]), 2) if st_r["tremor_freq"] is not None else 0.0
                    r_samp = st_r["rest_samples"] or 0
                    r_share = round((r_samp / val) * 100.0, 1) if val > 0 else 0.0
                    a_share = round(100.0 - r_share, 1) if val > 0 else 0.0
                    dur_s = round(tot * 0.1, 1)

                    session_metrics_map[st_r["session_id"]] = {
                        "duration_s": dur_s,
                        "valid_seconds": round(val * 0.1, 1),
                        "tremor_share": t_share,
                        "tremor_strength": t_rms,
                        "dominant_frequency": t_freq,
                        "rest_share": r_share,
                        "active_share": a_share,
                        "total_readings": tot,
                    }

        # 3. Fetch alerts
        alert_query = """
            SELECT a.*, p.code as person_code
            FROM alert a
            JOIN person p ON a.person_id = p.id
            WHERE a.person_id = ?
        """
        alert_params = [person_id]
        if calc_from_date:
            alert_query += " AND a.ts >= ?"
            alert_params.append(f"{calc_from_date}T00:00:00")
        if calc_to_date:
            alert_query += " AND a.ts <= ?"
            alert_params.append(f"{calc_to_date}T23:59:59")

        alert_query += " ORDER BY a.ts DESC;"
        alert_rows = [dict(r) for r in conn.execute(alert_query, alert_params).fetchall()]

        # 4. Aggregate by Date (YYYY-MM-DD)
        daily_map: Dict[str, Dict[str, Any]] = {}
        time_of_day = {
            "Morning (06:00-12:00)": {"seconds": 0.0, "tremor_weighted": 0.0, "alerts": 0},
            "Afternoon (12:00-18:00)": {"seconds": 0.0, "tremor_weighted": 0.0, "alerts": 0},
            "Evening (18:00-24:00)": {"seconds": 0.0, "tremor_weighted": 0.0, "alerts": 0},
            "Night (00:00-06:00)": {"seconds": 0.0, "tremor_weighted": 0.0, "alerts": 0},
        }

        risk_incidents: List[Dict[str, Any]] = []
        total_rest_seconds = 0.0
        total_active_seconds = 0.0

        for s in sess_rows:
            s_id = s["id"]
            st = s.get("started_at") or ""
            date_str = st[:10] if len(st) >= 10 else "Unknown"

            m = session_metrics_map.get(s_id, {
                "duration_s": 0.0,
                "valid_seconds": 0.0,
                "tremor_share": 0.0,
                "tremor_strength": 0.0,
                "dominant_frequency": 0.0,
                "rest_share": 0.0,
                "active_share": 0.0,
                "total_readings": 0,
            })

            dur = m["duration_s"]
            t_share = m["tremor_share"]
            t_strength = m["tremor_strength"]
            t_freq = m["dominant_frequency"]
            rest_share = m["rest_share"]
            active_share = m["active_share"]
            tot_readings = m["total_readings"]

            total_rest_seconds += (rest_share / 100.0) * dur
            total_active_seconds += (active_share / 100.0) * dur

            if date_str not in daily_map:
                daily_map[date_str] = {
                    "date": date_str,
                    "sessions_count": 0,
                    "monitored_seconds": 0.0,
                    "total_readings": 0,
                    "tremor_weighted_sum": 0.0,
                    "strength_weighted_sum": 0.0,
                    "freq_weighted_sum": 0.0,
                    "peak_tremor_share": 0.0,
                    "alert_count": 0,
                }

            d = daily_map[date_str]
            d["sessions_count"] += 1
            d["monitored_seconds"] += dur
            d["total_readings"] += tot_readings
            d["tremor_weighted_sum"] += t_share * dur
            d["strength_weighted_sum"] += t_strength * dur
            d["freq_weighted_sum"] += t_freq * dur
            if t_share > d["peak_tremor_share"]:
                d["peak_tremor_share"] = t_share

            # Time of day bucket
            try:
                hour = datetime.fromisoformat(st.replace("Z", "+00:00")).hour
                if 6 <= hour < 12:
                    bucket = "Morning (06:00-12:00)"
                elif 12 <= hour < 18:
                    bucket = "Afternoon (12:00-18:00)"
                elif 18 <= hour < 24:
                    bucket = "Evening (18:00-24:00)"
                else:
                    bucket = "Night (00:00-06:00)"
                
                time_of_day[bucket]["seconds"] += dur
                time_of_day[bucket]["tremor_weighted"] += t_share * dur
            except Exception:
                pass

            # Detect Elevated Risk Session Incidents (e.g. >= baseline + 15% or high strength)
            delta = t_share - base_share
            if delta >= 12.0 or t_share >= 35.0:
                time_part = st[11:19] if len(st) >= 19 else "00:00:00"
                risk_incidents.append({
                    "id": f"risk_sess_{s['id']}",
                    "date": date_str,
                    "time": time_part,
                    "ts": st,
                    "type": "Elevated Tremor Episode",
                    "severity": "High" if delta >= 20.0 or t_share >= 45.0 else "Elevated",
                    "duration_seconds": round(dur, 1),
                    "tremor_share": round(t_share, 1),
                    "baseline_delta": round(delta, 1),
                    "tremor_strength": round(t_strength, 4),
                    "dominant_frequency": round(t_freq, 2),
                    "reason": f"Tremor share reached {t_share:.1f}% (+{delta:+.1f}% vs personal baseline {base_share:.1f}%)",
                    "session_id": s["id"],
                    "label": s.get("label") or "Routine",
                })

        # Process alerts into risk incidents & counts
        for a in alert_rows:
            ats = a.get("ts") or ""
            adate = ats[:10] if len(ats) >= 10 else "Unknown"
            atime = ats[11:19] if len(ats) >= 19 else "00:00:00"

            if adate in daily_map:
                daily_map[adate]["alert_count"] += 1

            # Time of day alert
            try:
                hour = datetime.fromisoformat(ats.replace("Z", "+00:00")).hour
                if 6 <= hour < 12:
                    time_of_day["Morning (06:00-12:00)"]["alerts"] += 1
                elif 12 <= hour < 18:
                    time_of_day["Afternoon (12:00-18:00)"]["alerts"] += 1
                elif 18 <= hour < 24:
                    time_of_day["Evening (18:00-24:00)"]["alerts"] += 1
                else:
                    time_of_day["Night (00:00-06:00)"]["alerts"] += 1
            except Exception:
                pass

            src = a.get("source") or "band"
            risk_incidents.append({
                "id": f"alert_{a['id']}",
                "date": adate,
                "time": atime,
                "ts": ats,
                "type": "Haptic Cue / Alert Trigger" if src == "band" else ("Elevated Risk Alert" if src == "rule" else "Test Signal"),
                "severity": "High" if src in ("band", "rule") else "Informational",
                "duration_seconds": 15.0,
                "tremor_share": None,
                "baseline_delta": None,
                "tremor_strength": None,
                "dominant_frequency": None,
                "reason": a.get("reason") or "Real-time tremor threshold exceeded on wearable band",
                "session_id": a.get("session_id") or "",
                "label": "Alert Event",
            })

        # Format daily trends list
        daily_trends = []
        for d_key in sorted(daily_map.keys()):
            item = daily_map[d_key]
            m_sec = item["monitored_seconds"]
            avg_t = round(item["tremor_weighted_sum"] / m_sec, 1) if m_sec > 0 else 0.0
            avg_s = round(item["strength_weighted_sum"] / m_sec, 4) if m_sec > 0 else 0.0
            avg_f = round(item["freq_weighted_sum"] / m_sec, 2) if m_sec > 0 else 0.0
            
            # Risk status evaluation
            if avg_t >= (base_share + 15.0) or item["alert_count"] >= 3:
                risk_status = "Elevated"
            elif avg_t >= (base_share + 8.0) or item["alert_count"] >= 1:
                risk_status = "Slightly Elevated"
            else:
                risk_status = "Typical"

            daily_trends.append({
                "date": d_key,
                "sessions_count": item["sessions_count"],
                "monitored_minutes": round(m_sec / 60.0, 1),
                "monitored_seconds": round(m_sec, 1),
                "avg_tremor_share": avg_t,
                "peak_tremor_share": round(item["peak_tremor_share"], 1),
                "avg_tremor_strength": avg_s,
                "avg_frequency": avg_f,
                "alert_count": item["alert_count"],
                "risk_status": risk_status,
                "baseline_comparison": round(avg_t - base_share, 1),
            })

        # Compute 7-day Moving Average for daily trends
        for idx, d in enumerate(daily_trends):
            window_start = max(0, idx - 6)
            window_slice = daily_trends[window_start:idx + 1]
            w_sum = sum(w["avg_tremor_share"] * w["monitored_seconds"] for w in window_slice)
            w_sec = sum(w["monitored_seconds"] for w in window_slice)
            d["moving_avg_7d"] = round(w_sum / w_sec, 1) if w_sec > 0 else d["avg_tremor_share"]

        # Weekly summary table for multi-week / 90d reports
        weekly_summary = []
        if daily_trends:
            chunk_size = 7
            for w_idx in range(0, len(daily_trends), chunk_size):
                chunk = daily_trends[w_idx:w_idx + chunk_size]
                w_sec = sum(c["monitored_seconds"] for c in chunk)
                w_t_sum = sum(c["avg_tremor_share"] * c["monitored_seconds"] for c in chunk)
                w_alerts = sum(c["alert_count"] for c in chunk)
                w_share = round(w_t_sum / w_sec, 1) if w_sec > 0 else 0.0
                week_num = (w_idx // chunk_size) + 1
                start_label = chunk[0]["date"]
                end_label = chunk[-1]["date"]

                weekly_summary.append({
                    "week_number": week_num,
                    "date_range": f"{start_label} – {end_label}",
                    "monitored_minutes": round(w_sec / 60.0, 1),
                    "avg_tremor_share": w_share,
                    "baseline_delta": round(w_share - base_share, 1),
                    "alert_count": w_alerts,
                    "sessions_count": sum(c["sessions_count"] for c in chunk),
                })

        # Notable Events: Alert days & Highest Share Days
        alert_days = [d for d in daily_trends if d["alert_count"] > 0]
        highest_share_days = sorted(daily_trends, key=lambda x: x["avg_tremor_share"], reverse=True)[:5]

        # Format time-of-day summary
        time_of_day_list = []
        for slot, slot_data in time_of_day.items():
            s_sec = slot_data["seconds"]
            time_of_day_list.append({
                "slot": slot,
                "monitored_minutes": round(s_sec / 60.0, 1),
                "avg_tremor_share": round(slot_data["tremor_weighted"] / s_sec, 1) if s_sec > 0 else 0.0,
                "alert_count": slot_data["alerts"],
            })

        # Sort risk incidents newest first
        risk_incidents.sort(key=lambda x: x["ts"], reverse=True)

        # Global totals
        total_seconds = sum(d["monitored_seconds"] for d in daily_trends)
        total_readings = sum(item["total_readings"] for item in daily_map.values())
        overall_avg_tremor = (
            round(sum(d["avg_tremor_share"] * d["monitored_seconds"] for d in daily_trends) / total_seconds, 1)
            if total_seconds > 0 else 0.0
        )
        overall_avg_strength = (
            round(sum(d["avg_tremor_strength"] * d["monitored_seconds"] for d in daily_trends) / total_seconds, 4)
            if total_seconds > 0 else 0.0
        )

        total_rest_pct = round((total_rest_seconds / total_seconds) * 100.0, 1) if total_seconds > 0 else 0.0
        total_active_pct = round((total_active_seconds / total_seconds) * 100.0, 1) if total_seconds > 0 else 0.0

        return {
            "person": person,
            "is_sample": bool(person.get("is_sample", 0)),
            "range": range_type,
            "from_date": calc_from_date,
            "to_date": calc_to_date,
            "baseline": baseline,
            "total_sessions": len(sess_rows),
            "total_monitored_minutes": round(total_seconds / 60.0, 1),
            "total_readings": total_readings,
            "days_with_data": len(daily_map),
            "overall_avg_tremor_share": overall_avg_tremor,
            "overall_avg_tremor_strength": overall_avg_strength,
            "rest_share_pct": total_rest_pct,
            "active_share_pct": total_active_pct,
            "total_alerts": len(alert_rows),
            "total_risk_incidents": len(risk_incidents),
            "daily_trends": daily_trends,
            "weekly_summary": weekly_summary,
            "notable_events": {
                "alert_days": alert_days,
                "highest_share_days": highest_share_days,
            },
            "time_of_day": time_of_day_list,
            "risk_incidents": risk_incidents,
        }
    finally:
        conn.close()


# Global singleton
db_session_manager = SessionStorageService()
init_db()
