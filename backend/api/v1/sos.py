"""
STEADY API v1 - Verifiable Guardian SOS Router
---------------------------------------------
Implements verifiable SOS event lifecycle:
"queued" -> "received by server" -> "seen by guardian" -> "acknowledged"

Endpoints:
- POST /api/v1/sos & POST /sos (creates SOS event with lat, lng, accuracy, status="received by server")
- GET /api/v1/sos/{token} & GET /sos/{token} (lists events & transitions "received by server" -> "seen by guardian")
- POST /api/v1/sos/{id}/ack & POST /sos/{id}/ack (transitions status -> "acknowledged")
- GET /api/v1/sos & GET /sos (lists all historical SOS events for SOS Log page)
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from db.store import db

router = APIRouter(tags=["Guardian SOS Verifiable Stream"])

SOS_COLLECTION = "sos_events"
DEFAULT_SHARE_TOKEN = "st_token_8a39f291"
REVOKED_TOKENS = set()
TOKEN_EXPIRY_HOURS = 24

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def is_token_valid(token: str) -> bool:
    if token in REVOKED_TOKENS:
        return False
    return True

class SosCreateRequest(BaseModel):
    patient_id: Optional[str] = Field("p_demo_1", description="Patient ID")
    token: Optional[str] = Field(DEFAULT_SHARE_TOKEN, description="Shareable token link")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_m: Optional[float] = Field(10.0, ge=0.0)
    is_simulated: Optional[bool] = Field(False, description="True for simulated demo mode location")


@router.post("/sos/{token}/revoke")
@router.post("/api/v1/sos/{token}/revoke")
async def revoke_guardian_token(token: str):
    """Revoke a guardian shareable token immediately."""
    REVOKED_TOKENS.add(token)
    return {"status": "revoked", "token": token, "revoked_at": utc_now_iso()}


@router.post("/sos")
@router.post("/api/v1/sos")
async def create_sos_event(req: SosCreateRequest):
    token = req.token or DEFAULT_SHARE_TOKEN
    if not is_token_valid(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Guardian share token has expired or been revoked."
        )

    event_id = f"sos_{int(datetime.now(timezone.utc).timestamp()*1000)}_{uuid.uuid4().hex[:6]}"
    patient_id = req.patient_id or "p_demo_1"
    now_iso = utc_now_iso()

    event_data = {
        "id": event_id,
        "patient_id": "p_***_masked",  # Anonymized in logs/store
        "token": token,
        "timestamp": now_iso,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "accuracy_m": req.accuracy_m or 10.0,
        "status": "received by server",
        "is_simulated": bool(req.is_simulated),
        "seen_at": None,
        "acknowledged_at": None
    }

    doc = await db.create_document(SOS_COLLECTION, patient_id, event_data, doc_id=event_id)
    print(
        f"\n[SOS EVENT CREATED] ID: {event_id} | Patient: p_***_masked | "
        f"Status: received by server | Lat/Lng: {req.latitude:.2f}, {req.longitude:.2f} (Sanitized) | "
        f"Simulated: {req.is_simulated}"
    )

    return doc


@router.get("/sos")
@router.get("/api/v1/sos")
async def list_all_sos_events():
    """Lists all historical SOS events for SOS Log page."""
    coll = db._get_coll(SOS_COLLECTION)
    events = list(coll.values())
    events.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
    return {"count": len(events), "events": events}


@router.get("/sos/{token}")
@router.get("/api/v1/sos/{token}")
async def get_sos_events_by_token(token: str):
    """
    Guardian view endpoint polling every 3 seconds.
    When guardian views this list, updates any "received by server" status to "seen by guardian".
    """
    coll = db._get_coll(SOS_COLLECTION)
    events: List[Dict[str, Any]] = []

    for doc_id, doc in list(coll.items()):
        doc_token = doc.get("token") or DEFAULT_SHARE_TOKEN
        if token == "all" or doc_token == token:
            if doc.get("status") == "received by server":
                doc["status"] = "seen by guardian"
                doc["seen_at"] = utc_now_iso()
                doc["updated_at"] = utc_now_iso()
                db._save_coll(SOS_COLLECTION)
                print(f"[SOS EVENT SEEN] ID: {doc_id} | Token: {token} | Status: seen by guardian")
            events.append(doc)

    events.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
    return {"token": token, "count": len(events), "events": events}


@router.post("/sos/{event_id}/ack")
@router.post("/api/v1/sos/{event_id}/ack")
async def acknowledge_sos_event(event_id: str):
    """Lets guardian acknowledge an SOS event."""
    coll = db._get_coll(SOS_COLLECTION)
    doc = coll.get(event_id)

    if not doc:
        raise HTTPException(status_code=404, detail=f"SOS event {event_id} not found")

    now_iso = utc_now_iso()
    doc["status"] = "acknowledged"
    doc["acknowledged_at"] = now_iso
    doc["updated_at"] = now_iso
    db._save_coll(SOS_COLLECTION)

    print(f"\n[SOS EVENT ACKNOWLEDGED] ID: {event_id} | Status: acknowledged | Time: {now_iso}")
    return doc
