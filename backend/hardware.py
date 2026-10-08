import asyncio, json, threading
from collections import deque
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
recent = deque(maxlen=2000)      # last ~40 s of samples
clients: set[WebSocket] = set()
loop = None                      # set at startup

async def broadcast(samples):
    for s in samples:
        recent.append(s)
    for ws in list(clients):
        try:
            await ws.send_json(samples)
        except Exception:
            clients.discard(ws)

@router.post("/sensor-data")     # the standalone dashboard posts here
async def sensor_data(samples: list[dict]):
    await broadcast(samples)
    return {"received": len(samples)}

@router.get("/sensor/latest")
def latest(n: int = 200):
    return list(recent)[-n:]

@router.websocket("/ws/sensor")  # the frontend listens here
async def ws_sensor(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)

def start_serial_reader(port, baud=115200):
    import serial                # pip install pyserial
    def run():
        ser = serial.Serial(port, baud, timeout=1)
        batch = []
        while True:
            line = ser.readline().decode(errors="ignore").strip()
            if line.startswith("{"):
                try:
                    batch.append(json.loads(line))
                except ValueError:
                    continue
            if len(batch) >= 10:
                asyncio.run_coroutine_threadsafe(broadcast(batch), loop)
                batch = []
    threading.Thread(target=run, daemon=True).start()