"""
STEADY API v1 - Guardian Links Router
Pairing-code based linking between a patient and a caregiver (guardian).

Flow:
  1. Patient generates a short, single-use, expiring pairing code.
  2. Guardian submits the code to create a patient <-> guardian relationship.
  3. Either participant may later remove the link.

Authorization is enforced locally (see api.v1.guardian_common): a guardian may
only ever see patients they are actively linked to, and a patient may only
manage links that involve themselves.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import AuthenticatedUser, get_current_user
from db.store import db

from .guardian_common import (
    GUARDIAN_LINKS,
    PAIRING_CODES,
    find_link,
    find_pairing_code,
    get_links_for_guardian,
    get_links_for_patient,
    is_linked,
    is_participant,
)

router = APIRouter(prefix="/guardian-links", tags=["Guardian Links"])

# Ambiguous characters (0/O, 1/I) removed for easy verbal/typed sharing.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6
_DEFAULT_EXPIRY_MINUTES = 10
_MAX_EXPIRY_MINUTES = 60


class PairingCodeRequest(BaseModel):
    expires_in_minutes: int = Field(_DEFAULT_EXPIRY_MINUTES, ge=1, le=_MAX_EXPIRY_MINUTES)


class PairRequest(BaseModel):
    code: str = Field(..., description="Pairing code shown on the patient's device")
    guardian_label: Optional[str] = Field(None, description="Optional display label for the guardian")
    patient_label: Optional[str] = Field(None, description="Optional display label for the patient")


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


@router.post("/pairing-code")
async def create_pairing_code(
    body: Optional[PairingCodeRequest] = None,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Patient generates a short-lived, single-use pairing code.
    """
    expires_in = body.expires_in_minutes if body else _DEFAULT_EXPIRY_MINUTES
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in)

    # Ensure the code is globally unique among stored codes.
    for _ in range(5):
        code = _generate_code()
        if find_pairing_code(code) is None:
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not allocate a pairing code. Please retry.",
        )

    doc = await db.create_document(
        PAIRING_CODES,
        user_id=user.user_id,
        data={
            "code": code,
            "patient_id": user.user_id,
            "expires_at": expires_at.isoformat(),
            "expires_in_minutes": expires_in,
            "used": False,
            "used_at": None,
            "guardian_id": None,
        },
        doc_id=code,
    )
    return {
        "code": doc["code"],
        "patient_id": user.user_id,
        "expires_at": doc["expires_at"],
        "expires_in_minutes": expires_in,
    }


@router.post("/pair", status_code=status.HTTP_201_CREATED)
async def pair_guardian(
    body: PairRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Guardian submits a pairing code to link themselves to the patient.
    Rejects invalid, expired, reused and duplicate codes.
    """
    code_doc = find_pairing_code(body.code)
    if not code_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid pairing code."
        )

    if code_doc.get("used"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This pairing code has already been used.",
        )

    expires_at = _parse_iso(code_doc.get("expires_at"))
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="This pairing code has expired."
        )

    patient_id = code_doc.get("patient_id")
    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pairing code is not associated with a patient.",
        )

    if patient_id == user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A patient cannot link to themselves.",
        )

    if is_linked(user.user_id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already linked to this patient.",
        )

    # Mark the code single-use.
    await db.update_document(
        PAIRING_CODES,
        user_id=patient_id,
        doc_id=code_doc["id"],
        updates={
            "used": True,
            "used_at": datetime.now(timezone.utc).isoformat(),
            "guardian_id": user.user_id,
        },
    )

    link = await db.create_document(
        GUARDIAN_LINKS,
        user_id=patient_id,
        data={
            "patient_id": patient_id,
            "guardian_id": user.user_id,
            "guardian_email": user.email,
            "guardian_label": body.guardian_label,
            "patient_label": body.patient_label,
            "status": "active",
            "code": code_doc["id"],
        },
    )
    return link


@router.get("/status")
async def get_link_status(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Summarises the caller's Guardian relationships and inferred role:
    'patient', 'guardian', or 'both'.
    """
    as_patient = get_links_for_patient(user.user_id)
    as_guardian = get_links_for_guardian(user.user_id)

    if as_patient and as_guardian:
        role = "both"
    elif as_guardian:
        role = "guardian"
    else:
        role = "patient"

    return {
        "user_id": user.user_id,
        "role": role,
        "guardian_link_count": len(as_guardian),  # patients this user watches
        "patient_link_count": len(as_patient),    # guardians watching this user
    }


@router.get("/patients")
async def get_linked_patients(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Guardian: returns the patients linked to the current user.
    """
    links = get_links_for_guardian(user.user_id)
    patients: List[Dict[str, Any]] = [
        {
            "link_id": link["id"],
            "patient_id": link.get("patient_id"),
            "patient_label": link.get("patient_label"),
            "linked_at": link.get("created_at"),
        }
        for link in links
    ]
    return {"count": len(patients), "patients": patients}


@router.get("/guardians")
async def get_linked_guardians(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Patient: returns the guardians linked to the current user.
    """
    links = get_links_for_patient(user.user_id)
    guardians: List[Dict[str, Any]] = [
        {
            "link_id": link["id"],
            "guardian_id": link.get("guardian_id"),
            "guardian_email": link.get("guardian_email"),
            "guardian_label": link.get("guardian_label"),
            "linked_at": link.get("created_at"),
        }
        for link in links
    ]
    return {"count": len(guardians), "guardians": guardians}


@router.delete("/{link_id}")
async def unlink(
    link_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Removes a guardian link. Only a participant in the link (patient or the
    linked guardian) may remove it.
    """
    link = find_link(link_id)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Guardian link not found."
        )
    if not is_participant(link, user.user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this guardian link.",
        )

    deleted = await db.delete_document(
        GUARDIAN_LINKS, user_id=link.get("patient_id"), doc_id=link_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Guardian link not found."
        )
    return {"status": "unlinked", "link_id": link_id}