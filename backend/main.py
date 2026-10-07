"""
STEADY Backend API
Main application entry point.
Mounts:
- REST API v1 (`/api/v1/...`)
- Direct IMU / EEG analysis endpoints (`/analyze/imu`, `/analyze/eeg`)
- Health check (`/health`)
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1 import api_v1_router
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

# Mount API v1 router and root SOS router
app.include_router(api_v1_router)
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
