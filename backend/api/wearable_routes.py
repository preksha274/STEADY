"""
STEADY API - Wearable Ingestion, People, Sessions & CSV Export Endpoints
Handles:
1. Ingestion status and band vibration control:
   - GET /api/wearable/status
   - POST /api/wearable/vibrate
   - WebSocket /ws/wearable
2. People management:
   - POST /api/people
   - GET /api/people
3. Session lifecycle & queries:
   - POST /api/sessions/start
   - POST /api/sessions/{id}/stop
   - GET /api/sessions
   - GET /api/sessions/active
4. Streaming CSV exports:
   - GET /api/sessions/{id}/export.csv
   - GET /api/people/{id}/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
"""

import asyncio
import time
from typing import Set, Dict, Any, Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status, Query
from fastapi.responses import StreamingResponse

from wearable_serial import serial_source
from wearable_db import (
    db_session_manager,
    create_person,
    list_people,
    get_person_by_id,
    list_sessions,
    get_session_by_id,
    stream_session_csv,
    stream_person_csv,
)

from wearable_alerts import alert_engine
from wearable_replay import replay_source

router = APIRouter(tags=["Wearable"])

# WebSocket clients for /ws/wearable
wearable_ws_clients: Set[WebSocket] = set()
_main_event_loop: Optional[asyncio.AbstractEventLoop] = None

# Stream diagnostics counters
_stats_readings_parsed: int = 0
_stats_readings_broadcast: int = 0
_stats_last_log_time: float = time.time()


def set_wearable_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_event_loop
    _main_event_loop = loop


async def broadcast_wearable_payload(payload: Dict[str, Any]) -> None:
    global _stats_readings_broadcast
    for ws in list(wearable_ws_clients):
        try:
            await ws.send_json(payload)
            _stats_readings_broadcast += 1
        except Exception:
            wearable_ws_clients.discard(ws)


def on_alert_generated(alert_doc: Dict[str, Any]) -> None:
    """Invoked when AlertEngine generates any alert (band, rule, or test)."""
    if _main_event_loop and not _main_event_loop.is_closed():
        asyncio.run_coroutine_threadsafe(
            broadcast_wearable_payload({"type": "alert", "alert": alert_doc}),
            _main_event_loop
        )


def on_hardware_reading_received(reading: Dict[str, Any]) -> None:
    """Invoked on every valid telemetry sample from serial stream or replay engine."""
    global _stats_readings_parsed, _stats_last_log_time
    _stats_readings_parsed += 1

    # Periodic 5-second diagnostics log
    now = time.time()
    if (now - _stats_last_log_time) >= 5.0:
        rps = serial_source.get_readings_per_second()
        print(
            f"[STREAM 5s LOG] Parsed: {_stats_readings_parsed} | "
            f"Broadcast: {_stats_readings_broadcast} | "
            f"WS Clients: {len(wearable_ws_clients)} | "
            f"Band: {serial_source.get_state()} ({rps} rps) | "
            f"Latest RMS: {reading.get('rms', 0):.4f}g"
        )
        _stats_last_log_time = now

    # 1. Forward to active session storage manager for batched SQLite persistence
    db_session_manager.handle_incoming_reading(reading)

    # 2. Process reading through AlertEngine (band edge detection & baseline elevated rule)
    alert_engine.process_reading(reading)

    # 3. Broadcast reading to live frontend clients
    if _main_event_loop and not _main_event_loop.is_closed():
        asyncio.run_coroutine_threadsafe(broadcast_wearable_payload(reading), _main_event_loop)


# Connect callbacks
serial_source.set_on_reading(on_hardware_reading_received)
replay_source.set_on_reading(on_hardware_reading_received)
alert_engine.set_vibrate_sender(serial_source.send_command)
alert_engine.set_on_alert(on_alert_generated)



# ===========================================================================
# 1. Hardware Status & Ingestion Controls
# ===========================================================================

@router.websocket("/ws/wearable")
async def websocket_wearable(websocket: WebSocket):
    await websocket.accept()
    wearable_ws_clients.add(websocket)
    try:
        # Send initial status payload
        status_info = serial_source.get_status()
        await websocket.send_json({"type": "status", "status": status_info})
        while True:
            # Keep-alive loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        wearable_ws_clients.discard(websocket)


@router.get("/api/wearable/status")
def get_wearable_status() -> Dict[str, Any]:
    return serial_source.get_status()


@router.get("/api/wearable/latest")
def get_wearable_latest(n: int = Query(50, ge=1, le=300)) -> List[Dict[str, Any]]:
    """Returns the most recent N live readings from the band buffer."""
    return serial_source.get_latest_readings(n=n)


@router.post("/api/wearable/ingest")
def api_wearable_ingest(readings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Allows Web Serial in browser to forward live telemetry into the database & alert engine."""
    for r in readings:
        on_hardware_reading_received(r)
    return {"status": "ok", "count": len(readings)}


@router.post("/api/wearable/vibrate")

def trigger_vibration() -> Dict[str, Any]:
    status_data = serial_source.get_status()
    if not status_data["connected"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Band is not connected (current state: {status_data['state']}). Connect band to {status_data['port']} and try again."
        )

    success = serial_source.send_command("V")
    if not success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Failed to transmit vibration command over serial port."
        )

    alert_doc = alert_engine.trigger_test_alert()
    return {
        "status": "ok",
        "command": "V",
        "message": "Vibration command sent to band.",
        "alert": alert_doc
    }



class TestAlertRequest(BaseModel):
    person_id: Optional[str] = None
    session_id: Optional[str] = None


@router.post("/api/alerts/test")
@router.post("/api/wearable/alerts/test")
def trigger_test_alert(req: Optional[TestAlertRequest] = None) -> Dict[str, Any]:
    p_id = req.person_id if req else None
    s_id = req.session_id if req else None
    alert_doc = alert_engine.trigger_test_alert(person_id=p_id, session_id=s_id)
    return {
        "status": "ok",
        "alert": alert_doc
    }


# ===========================================================================
# 2. People Endpoints
# ===========================================================================

class PersonCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=12, description="Short unique identifier, e.g. P01")
    display_name: Optional[str] = Field(None, max_length=50, description="Optional pseudonym/label")


@router.post("/api/people", status_code=status.HTTP_201_CREATED)
def api_create_person(req: PersonCreateRequest) -> Dict[str, Any]:
    success, person_doc, error = create_person(req.code, req.display_name)
    if not success:
        if "already exists" in (error or ""):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return person_doc


@router.get("/api/people")
def api_list_people(include_sample: bool = Query(True)) -> List[Dict[str, Any]]:
    return list_people(include_sample=include_sample)


@router.get("/api/people/{person_id}/baseline")
def api_get_person_baseline(person_id: str) -> Dict[str, Any]:
    from wearable_db import get_person_baseline
    person = get_person_by_id(person_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Person '{person_id}' not found.")
    return get_person_baseline(person_id)


@router.get("/api/people/{person_id}/report")
@router.get("/api/reports/summary")
def api_get_person_report(
    person_id: str,
    range: str = Query("7d", pattern="^(7d|30d|90d|all)$"),
    from_date: Optional[str] = Query(None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: Optional[str] = Query(None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> Dict[str, Any]:
    from wearable_db import get_participant_report_summary
    person = get_person_by_id(person_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Person '{person_id}' not found.")
    return get_participant_report_summary(person_id=person_id, range_type=range, from_date=from_date, to_date=to_date)


@router.get("/api/alerts")
def api_list_alerts(
    person_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> List[Dict[str, Any]]:
    from wearable_db import list_alerts
    return list_alerts(person_id=person_id, limit=limit)



# ===========================================================================
# 3. Session Endpoints
# ===========================================================================

class SessionStartRequest(BaseModel):
    person_id: str
    type: str = Field("normal", pattern="^(normal|baseline)$")
    label: Optional[str] = Field(None, pattern="^(still|typing|walking|shaking|other)$")
    note: Optional[str] = None
    source: str = Field("live", pattern="^(live|replay)$")


@router.post("/api/sessions/start", status_code=status.HTTP_201_CREATED)
def api_start_session(req: SessionStartRequest) -> Dict[str, Any]:
    alert_engine.reset_window()
    success, session_doc, error = db_session_manager.start_session(
        person_id=req.person_id,
        session_type=req.type,
        label=req.label,
        note=req.note,
        source=req.source
    )
    if not success:
        if "already active" in (error or ""):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error)
        if "not found" in (error or ""):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return session_doc


@router.post("/api/sessions/{session_id}/stop")
def api_stop_session(session_id: str) -> Dict[str, Any]:
    alert_engine.reset_window()
    success, stopped_session = db_session_manager.stop_session(session_id)
    if not success or not stopped_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")
    return stopped_session


@router.get("/api/sessions")
def api_list_sessions(
    person_id: Optional[str] = Query(None),
    include_sample: bool = Query(True),
) -> List[Dict[str, Any]]:
    return list_sessions(person_id=person_id, include_sample=include_sample)


@router.get("/api/sessions/active")
def api_get_active_session() -> Dict[str, Any]:
    active = db_session_manager.get_active_session()
    return {
        "active": active is not None,
        "session": active
    }


@router.get("/api/sessions/{session_id}/alerts")
def api_get_session_alerts(session_id: str) -> List[Dict[str, Any]]:
    from wearable_db import get_session_alerts
    return get_session_alerts(session_id)


@router.get("/api/sessions/{session_id}/timeline")
def api_get_session_timeline(session_id: str) -> Dict[str, Any]:
    from wearable_db import get_session_timeline
    res = get_session_timeline(session_id)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")
    return res




# ===========================================================================
# 4. Streaming CSV Export Endpoints
# ===========================================================================

@router.get("/api/sessions/{session_id}/export.csv")
def export_session_csv(session_id: str):
    sess = get_session_by_id(session_id)
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    filename = f"steady_session_{sess['person_code']}_{session_id}.csv"
    return StreamingResponse(
        stream_session_csv(session_id),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )


@router.get("/api/people/{person_id}/export.csv")
def export_person_csv(
    person_id: str,
    from_date: Optional[str] = Query(None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: Optional[str] = Query(None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
):

    person = get_person_by_id(person_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Person '{person_id}' not found.")

    filename = f"steady_all_data_{person['code']}.csv"
    return StreamingResponse(
        stream_person_csv(person_id, from_date=from_date, to_date=to_date),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )


# ===========================================================================
# 5. Validation & Replay Endpoints (Phase 8)
# ===========================================================================

class ReplayLoadRequest(BaseModel):
    preset: Optional[str] = None  # 'demo_short' | 'demo_tremor'
    csv_text: Optional[str] = None
    filename: Optional[str] = "dataset.csv"


@router.post("/api/replay/load")
def api_replay_load(req: ReplayLoadRequest) -> Dict[str, Any]:
    import os
    text = req.csv_text or ""
    filename = req.filename or "dataset.csv"

    if req.preset == "demo_short":
        path = os.path.join(os.path.dirname(__file__), "..", "demo_imu_short.csv")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
            filename = "demo_imu_short.csv"
    elif req.preset == "demo_tremor":
        path = os.path.join(os.path.dirname(__file__), "..", "demo_imu_tremor.csv")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
            filename = "demo_imu_tremor.csv"

    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No CSV text or valid preset provided.")

    ok, count, err, parse_meta = replay_source.load_csv(text, filename)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Failed to load CSV.")

    return {
        "status": "ok",
        "filename": filename,
        "sample_count": count,
        "meta": parse_meta,
    }


class CommitSessionRequest(BaseModel):
    person_id: str
    session_type: str = "normal"
    label: Optional[str] = None
    note: Optional[str] = "Imported from CSV validation"


@router.post("/api/replay/commit_session")
def api_replay_commit_session(req: CommitSessionRequest) -> Dict[str, Any]:
    if not replay_source.samples:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No dataset loaded to commit.")

    success, session_doc, error = db_session_manager.start_session(
        person_id=req.person_id,
        session_type=req.session_type,
        label=req.label,
        note=req.note,
        source="replay"
    )
    if not success or not session_doc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error or "Failed to create session.")

    for s in replay_source.samples:
        db_session_manager.handle_incoming_reading(s)

    _, final_sess = db_session_manager.stop_session(session_doc["id"])
    return {
        "status": "ok",
        "session": final_sess,
        "message": f"Successfully committed {len(replay_source.samples)} samples as session {final_sess.get('id', '')}.",
    }


class ReplayStartRequest(BaseModel):
    speed: float = Field(1.0, ge=0.1, le=20.0)
    person_id: Optional[str] = None
    session_type: str = Field("normal", pattern="^(normal|baseline)$")
    label: Optional[str] = None


@router.post("/api/replay/start")
def api_replay_start(req: ReplayStartRequest) -> Dict[str, Any]:
    if not replay_source.samples:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No replay dataset loaded. Call /api/replay/load first.")

    # If person_id provided, start a session tagged as source='replay'
    if req.person_id:
        db_session_manager.start_session(
            person_id=req.person_id,
            session_type=req.session_type,
            label=req.label,
            source="replay"
        )

    ok = replay_source.start_replay(speed=req.speed)
    if not ok:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to start replay worker.")

    return {"status": "ok", "speed": req.speed, "state": "playing"}


@router.post("/api/replay/pause")
def api_replay_pause() -> Dict[str, Any]:
    replay_source.pause_replay()
    return {"status": "ok", "state": "paused"}


@router.post("/api/replay/resume")
def api_replay_resume() -> Dict[str, Any]:
    replay_source.resume_replay()
    return {"status": "ok", "state": "playing"}


@router.post("/api/replay/stop")
def api_replay_stop() -> Dict[str, Any]:
    replay_source.stop_replay()
    active_sess = db_session_manager.get_active_session()
    if active_sess and active_sess.get("source") == "replay":
        db_session_manager.stop_session()
    return {"status": "ok", "state": "idle"}


@router.get("/api/replay/status")
def api_replay_status() -> Dict[str, Any]:
    return replay_source.get_status()


# ===========================================================================
# 6. Sample Person Management (DEMO01 / Synthetic 90-Day History)
# ===========================================================================

@router.post("/api/sample-person/load")
def api_load_sample_person() -> Dict[str, Any]:
    from wearable_sample_generator import generate_sample_person
    result = generate_sample_person()
    return result


@router.delete("/api/sample-person/remove")
@router.post("/api/sample-person/remove")
def api_remove_sample_person() -> Dict[str, Any]:
    from wearable_sample_generator import remove_sample_person
    result = remove_sample_person()
    return result


@router.get("/api/sample-person/status")
def api_sample_person_status() -> Dict[str, Any]:
    from wearable_sample_generator import get_sample_person_status
    return get_sample_person_status()


