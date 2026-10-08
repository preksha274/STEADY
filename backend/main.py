"""
STEADY Backend API
Main application entry point.
Mounts:
- REST API v1 (`/api/v1/...`)
- Wearable API (`/api/...`, `/ws/wearable`)
- Direct IMU / EEG analysis endpoints (`/analyze/imu`, `/analyze/eeg`)
- Live ESP32 wearable stream (`/ws/wearable`, `/ws/hardware`, `/hardware/latest`, `/hardware/ingest`)
- Health check (`/health`)
"""

import os
import asyncio
import threading
import time
from collections import deque

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1 import api_v1_router
from api.wearable_routes import (
    router as wearable_api_router,
    wearable_ws_clients,
    set_wearable_event_loop,
)
from wearable_serial import serial_source
from wearable_config import SERIAL_PORT, SERIAL_BAUD
from steady_ai import extract_motion_features, extract_eeg_features
from fastapi import File, UploadFile, Form, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse
import json
from typing import Optional

from api.v1.sos import router as sos_router

app = FastAPI(
    title="STEADY Backend API",
    description="Parkinson's Movement Companion AI & Multi-Tenant Data API",
    version="1.0.0"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API routers
app.include_router(api_v1_router)
app.include_router(wearable_api_router)
app.include_router(sos_router)


SENSOR_INDEX_HTML = os.path.join(os.path.dirname(__file__), "sensor_gateway", "index.html")


@app.get("/sensor")
@app.get("/gateway")
async def get_sensor_page():
    if os.path.exists(SENSOR_INDEX_HTML):
        return FileResponse(SENSOR_INDEX_HTML, media_type="text/html")
    return HTMLResponse("<h3>sensor_gateway/index.html not found</h3>", status_code=404)


@app.websocket("/sensor")
@app.websocket("/ws/sensor")
async def websocket_sensor_stream(websocket: WebSocket):
    await websocket.accept()
    client_ip = websocket.client.host if websocket.client else "unknown"
    print(f"\n[PHONE CONNECTED] Sensor stream active from {client_ip}")

    count = 0
    try:
        while True:
            msg = await websocket.receive_text()
            count += 1
            if count % 30 == 0:
                try:
                    payload = json.loads(msg)
                    acc = payload.get("accelerometer", {})
                    mag = payload.get("net_magnitude", 0)
                    print(
                        f"[LIVE KINEMATICS] #{count:05d} | "
                        f"Net Accel: {mag:5.2f} m/s2 | "
                        f"ax={acc.get('x',0):+5.2f}, ay={acc.get('y',0):+5.2f}, az={acc.get('z',0):+5.2f}"
                    )
                except Exception:
                    pass
    except WebSocketDisconnect:
        print(f"\n[PHONE DISCONNECTED] Mobile device {client_ip} disconnected (Total samples: {count})")
    except Exception as e:
        print(f"\n[STREAM ERROR] {client_ip}: {e}")


# ---------------------------------------------------------------------------
# ESP32 wearable (Steady Band) live stream & DSP analytics
# ---------------------------------------------------------------------------
from steady_ai.hardware_stream import dsp_processor
from steady_ai.wearable_storage import wearable_storage

hw_clients: set = set()
hw_loop = None


async def hw_broadcast(telemetry_payload: dict):
    for ws in list(hw_clients):
        try:
            await ws.send_json(telemetry_payload)
        except Exception:
            hw_clients.discard(ws)


@app.post("/sensor-data")
@app.post("/hardware/ingest")
async def hardware_ingest(samples: list[dict]):
    # Validate, inject server UTC timestamp & session ID, and persist compressed raw chunk
    valid_samples = wearable_storage.ingest_samples(samples)
    telemetry = dsp_processor.ingest_batch(valid_samples if valid_samples else samples)
    # Include session metadata and quality counters in telemetry response
    telemetry["session_id"] = wearable_storage.active_session_id
    telemetry["bad_lines_count"] = wearable_storage.bad_lines_count
    await hw_broadcast(telemetry)
    return {
        "received": len(samples),
        "valid": len(valid_samples),
        "session_id": wearable_storage.active_session_id,
        "bad_lines_count": wearable_storage.bad_lines_count,
        "metrics": telemetry["metrics"]
    }


@app.get("/hardware/latest")
def hardware_latest(n: int = 200):
    return list(dsp_processor.buffer)[-n:]


@app.get("/hardware/metrics")
def hardware_metrics():
    metrics = dsp_processor._calculate_live_metrics()
    metrics["session_id"] = wearable_storage.active_session_id
    metrics["bad_lines_count"] = wearable_storage.bad_lines_count
    return metrics


@app.get("/hardware/summaries")
def hardware_summaries(days: int = 7):
    return dsp_processor.get_summaries(days=days)


@app.websocket("/ws/hardware")
async def websocket_hardware(websocket: WebSocket):
    await websocket.accept()
    hw_clients.add(websocket)
    try:
        # Send initial metrics on connect with server UTC timestamp and session ID
        await websocket.send_json({
            "type": "hardware_initial",
            "session_id": wearable_storage.active_session_id,
            "server_timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "bad_lines_count": wearable_storage.bad_lines_count,
            "metrics": dsp_processor._calculate_live_metrics(),
            "latest_samples": list(dsp_processor.buffer)[-50:]
        })
        while True:
            msg_text = await websocket.receive_text()
            try:
                msg_json = json.loads(msg_text)
                batch = []
                if isinstance(msg_json, list):
                    batch = msg_json
                elif isinstance(msg_json, dict) and msg_json.get("type") == "samples":
                    batch = msg_json.get("data", [])
                
                if batch:
                    valid_samples = wearable_storage.ingest_samples(batch)
                    telemetry = dsp_processor.ingest_batch(valid_samples if valid_samples else batch)
                    telemetry["session_id"] = wearable_storage.active_session_id
                    telemetry["bad_lines_count"] = wearable_storage.bad_lines_count
                    await hw_broadcast(telemetry)
            except Exception as e:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        hw_clients.discard(websocket)


def start_serial_reader(port: str, baud: int = 460800):
    try:
        import serial  # pip install pyserial
    except ImportError:
        print("[HARDWARE] pyserial missing. Run: pip install pyserial")
        return

    def run():
        while True:
            try:
                ser = serial.Serial(port, baud, timeout=1)
                print(f"[HARDWARE] Reading Steady Band on {port} at {baud} baud")
                batch = []
                while True:
                    line = ser.readline().decode(errors="ignore").strip()
                    if line.startswith("S,"):
                        parts = line.split(",")
                        if len(parts) >= 11:
                            try:
                                sample = {
                                    "ms": int(parts[1]),
                                    "ax": float(parts[2]),
                                    "ay": float(parts[3]),
                                    "az": float(parts[4]),
                                    "hp": float(parts[5]),
                                    "rms": float(parts[6]),
                                    "freq": float(parts[7]),
                                    "tremor": int(parts[8]),
                                    "state": int(parts[9]),
                                    "drops": int(parts[10]),
                                }
                                batch.append(sample)
                            except ValueError:
                                wearable_storage.bad_lines_count += 1
                        else:
                            wearable_storage.bad_lines_count += 1
                    elif line.startswith("{"):
                        try:
                            batch.append(json.loads(line))
                        except ValueError:
                            wearable_storage.bad_lines_count += 1
                    elif line and not line.startswith("H,") and not line.startswith("A,"):
                        wearable_storage.bad_lines_count += 1

                    if batch and (len(batch) >= 25 or not line):
                        valid_samples = wearable_storage.ingest_samples(batch)
                        telemetry = dsp_processor.ingest_batch(valid_samples if valid_samples else batch)
                        telemetry["session_id"] = wearable_storage.active_session_id
                        telemetry["bad_lines_count"] = wearable_storage.bad_lines_count
                        asyncio.run_coroutine_threadsafe(hw_broadcast(telemetry), hw_loop)
                        batch = []
            except Exception as e:
                print(f"[HARDWARE] Serial problem on {port}: {e}. Retrying in 2 s "
                      f"(is the Arduino Serial Monitor closed?)")
                time.sleep(2)

    threading.Thread(target=run, daemon=True).start()


@app.on_event("startup")
async def hardware_startup():
    global hw_loop
    hw_loop = asyncio.get_running_loop()
    set_wearable_event_loop(hw_loop)
    
    # Start serial reading source in background
    port = os.getenv("SERIAL_PORT", SERIAL_PORT)
    serial_source.port = port
    serial_source.baud = SERIAL_BAUD
    serial_source.start()
    print(f"[WEARABLE] Steady serial ingestion initialized on {port} at {SERIAL_BAUD} baud.")


@app.on_event("shutdown")
async def hardware_shutdown():
    serial_source.stop()
    print("[WEARABLE] Steady serial reader stopped.")


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "STEADY Backend API",
        "version": "1.0.0"
    }



# Direct legacy/benchmark endpoints
@app.post("/analyze/imu")
async def analyze_imu(
    file: UploadFile = File(...),
    baseline_amplitude: Optional[float] = Form(None)
):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a CSV file."
        )
    try:
        content = await file.read()
        output = extract_motion_features(content, baseline_amplitude=baseline_amplitude)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process IMU data: {str(e)}"
        )

    return {
        "metrics": output.metrics.model_dump(),
        "quality": output.quality.model_dump(),
        "confidence": output.confidence.tier.value,
        "confidence_reason": output.confidence.reason,
        "confidence_report": output.confidence.model_dump(),
        "chart_data": {
            "signal": [p.model_dump() for p in output.chart_signal],
            "psd": [p.model_dump() for p in output.chart_psd],
        },
        "baseline_deviation_pct": output.baseline_deviation_pct,
        "label": output.label
    }


@app.post("/analyze/eeg")
async def analyze_eeg(
    file: UploadFile = File(...),
    sample_rate_hz: Optional[float] = Form(None)
):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a CSV file."
        )
    try:
        content = await file.read()
        output = extract_eeg_features(content, sample_rate_hz=sample_rate_hz)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process EEG data: {str(e)}"
        )

    return {
        "channel_count": output.channel_count,
        "channels": output.channels,
        "band_powers": output.band_powers.model_dump(),
        "quality": output.quality.model_dump(),
        "confidence": output.confidence.tier.value,
        "confidence_reason": output.confidence.reason,
        "confidence_report": output.confidence.model_dump(),
        "chart_data": {
            "psd": [p.model_dump() for p in output.chart_psd],
        },
        "beta_band_power": output.beta_band_power,
        "beta_relative_ratio": output.beta_relative_ratio
    }