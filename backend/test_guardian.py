"""
Focused backend tests for the STEADY Guardian safety system.

Covers: guardian linking, safe zones, geofencing, location pings + auth,
alerts, SOS, prolonged inactivity, night awareness, freeze integration and the
guardian dashboard.

Run standalone (recommended, isolated temp data dir via conftest.py):
    cd backend
    python test_guardian.py
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from main import app
from db.store import db
from api.v1.guardian_common import (
    PAIRING_CODES,
    save_settings,
    is_within_night_window,
)
from steady_ai.geofence import (
    haversine_m,
    is_point_in_circle,
    evaluate_safe_zones,
    determine_transition,
)

client = TestClient(app)

# Unique suffix so repeated runs never collide in the (temp) data store.
RUN = uuid.uuid4().hex[:8]


def uid(name: str) -> str:
    return f"gtest_{name}_{RUN}"


def h(user_id: str) -> dict:
    return {"X-User-ID": user_id}


def _new_pairing_code(patient: str) -> str:
    res = client.post(
        "/api/v1/guardian-links/pairing-code", json={"expires_in_minutes": 10}, headers=h(patient)
    )
    assert res.status_code == 200, res.text
    return res.json()["code"]


def _pair(patient: str, guardian: str):
    code = _new_pairing_code(patient)
    res = client.post("/api/v1/guardian-links/pair", json={"code": code}, headers=h(guardian))
    assert res.status_code == 201, res.text
    return code, res.json()


# ---------------------------------------------------------------------------
# Geofence pure functions
# ---------------------------------------------------------------------------
def test_geofence_pure_functions():
    print("\n--- GEOFENCE PURE FUNCTIONS ---")
    dist = haversine_m(0.0, 0.0, 0.0, 1.0)
    assert 111000 < dist < 111400, dist
    assert is_point_in_circle(0.0, 0.0, 0.0, 0.0, 100)
    assert not is_point_in_circle(0.0, 0.0, 0.0, 1.0, 100)

    zones = [
        {"id": "z1", "latitude": 0.0, "longitude": 0.0, "radius_m": 1000, "enabled": True},
        {"id": "z2", "latitude": 10.0, "longitude": 10.0, "radius_m": 500, "enabled": False},
    ]
    result = evaluate_safe_zones(0.0, 0.0, zones)
    assert result["inside"] is True
    assert "z1" in result["matched_zone_ids"]
    assert "z2" not in result["matched_zone_ids"]  # disabled zone ignored

    assert determine_transition(True, False) == "EXIT"
    assert determine_transition(False, True) == "ENTER"
    assert determine_transition(True, True) == "NONE"
    assert determine_transition(False, False) == "NONE"
    assert determine_transition(None, False) == "NONE"
    print("[PASSED] haversine / inside-circle / evaluation / transitions")


# ---------------------------------------------------------------------------
# Guardian linking
# ---------------------------------------------------------------------------
def test_guardian_linking():
    print("\n--- GUARDIAN LINKING ---")
    patient = uid("patient_link")
    guardian = uid("guardian_link")

    code = _new_pairing_code(patient)
    assert len(code) == 6

    # invalid code
    assert client.post("/api/v1/guardian-links/pair", json={"code": "ZZZZZZ"}, headers=h(guardian)).status_code == 404

    # successful pairing
    res = client.post("/api/v1/guardian-links/pair", json={"code": code}, headers=h(guardian))
    assert res.status_code == 201, res.text
    link = res.json()
    assert link["patient_id"] == patient and link["guardian_id"] == guardian

    # reused code (single-use)
    other = uid("guardian_other")
    assert client.post("/api/v1/guardian-links/pair", json={"code": code}, headers=h(other)).status_code == 409

    # duplicate link (new code, same guardian)
    code2 = _new_pairing_code(patient)
    assert client.post("/api/v1/guardian-links/pair", json={"code": code2}, headers=h(guardian)).status_code == 409

    # self-pair rejected
    code3 = _new_pairing_code(patient)
    assert client.post("/api/v1/guardian-links/pair", json={"code": code3}, headers=h(patient)).status_code == 400

    # listing
    patients = client.get("/api/v1/guardian-links/patients", headers=h(guardian)).json()
    assert patients["count"] >= 1
    guardians = client.get("/api/v1/guardian-links/guardians", headers=h(patient)).json()
    assert guardians["count"] >= 1

    # status role
    status = client.get("/api/v1/guardian-links/status", headers=h(guardian)).json()
    assert status["role"] in ("guardian", "both")

    # unauthorized unlink (stranger)
    assert client.delete(f"/api/v1/guardian-links/{link['id']}", headers=h(uid("stranger"))).status_code == 403

    # authorized unlink by guardian participant
    assert client.delete(f"/api/v1/guardian-links/{link['id']}", headers=h(guardian)).status_code == 200
    assert client.get("/api/v1/guardian-links/patients", headers=h(guardian)).json()["count"] == 0
    print("[PASSED] pairing-code / pair / invalid / reused / duplicate / self / unlink / unauthorized")


def test_expired_pairing_code():
    print("\n--- EXPIRED PAIRING CODE ---")
    patient = uid("patient_exp")
    guardian = uid("guardian_exp")
    code = _new_pairing_code(patient)

    # Force the code to be expired.
    past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    asyncio.run(
        db.update_document(PAIRING_CODES, user_id=patient, doc_id=code, updates={"expires_at": past})
    )

    res = client.post("/api/v1/guardian-links/pair", json={"code": code}, headers=h(guardian))
    assert res.status_code == 410, res.text
    print("[PASSED] expired pairing code rejected with 410")


# ---------------------------------------------------------------------------
# Safe zones
# ---------------------------------------------------------------------------
def test_safe_zones_crud_and_validation():
    print("\n--- SAFE ZONES ---")
    patient = uid("patient_sz")

    # validation: latitude out of range
    assert client.post("/api/v1/safe-zones", json={"name": "Home", "latitude": 999, "longitude": 0, "radius_m": 100}, headers=h(patient)).status_code == 422
    # validation: longitude out of range
    assert client.post("/api/v1/safe-zones", json={"name": "Home", "latitude": 0, "longitude": 999, "radius_m": 100}, headers=h(patient)).status_code == 422
    # validation: non-positive radius
    assert client.post("/api/v1/safe-zones", json={"name": "Home", "latitude": 0, "longitude": 0, "radius_m": 0}, headers=h(patient)).status_code == 422
    # validation: radius above reasonable maximum
    assert client.post("/api/v1/safe-zones", json={"name": "Home", "latitude": 0, "longitude": 0, "radius_m": 999999}, headers=h(patient)).status_code == 422

    # create
    res = client.post(
        "/api/v1/safe-zones",
        json={"name": "Home", "latitude": 37.7749, "longitude": -122.4194, "radius_m": 200},
        headers=h(patient),
    )
    assert res.status_code == 201, res.text
    zone = res.json()
    assert zone["patient_id"] == patient and zone["enabled"] is True

    # list
    listing = client.get("/api/v1/safe-zones", headers=h(patient)).json()
    assert listing["count"] >= 1

    # get
    assert client.get(f"/api/v1/safe-zones/{zone['id']}", headers=h(patient)).status_code == 200

    # patch
    updated = client.patch(
        f"/api/v1/safe-zones/{zone['id']}",
        json={"name": "Home Updated", "enabled": False},
        headers=h(patient),
    ).json()
    assert updated["name"] == "Home Updated" and updated["enabled"] is False

    # delete
    assert client.delete(f"/api/v1/safe-zones/{zone['id']}", headers=h(patient)).status_code == 200
    assert client.get(f"/api/v1/safe-zones/{zone['id']}", headers=h(patient)).status_code == 404
    print("[PASSED] validation / create / list / get / patch / delete")


# ---------------------------------------------------------------------------
# Location pings + geofence transitions + authorization
# ---------------------------------------------------------------------------
def test_location_and_geofence_transitions():
    print("\n--- LOCATION PINGS & GEOFENCE ---")
    patient = uid("patient_loc")
    guardian = uid("guardian_loc")
    _pair(patient, guardian)

    client.post(
        "/api/v1/safe-zones",
        json={"name": "Home", "latitude": 37.7749, "longitude": -122.4194, "radius_m": 250},
        headers=h(patient),
    )

    inside = {"latitude": 37.7749, "longitude": -122.4194}
    outside = {"latitude": 37.8049, "longitude": -122.4094}

    # invalid coordinates
    assert client.post("/api/v1/location-pings", json={"latitude": 200, "longitude": 0}, headers=h(patient)).status_code == 422

    # first ping inside -> records state, no alert
    r1 = client.post("/api/v1/location-pings", json=inside, headers=h(patient)).json()
    assert r1["geofence"]["inside"] is True
    assert r1["geofence"]["transition"] == "NONE"
    assert r1["geofence"]["alerts_created"] == []

    # inside -> outside => EXIT breach (one alert)
    r2 = client.post("/api/v1/location-pings", json=outside, headers=h(patient)).json()
    assert r2["geofence"]["transition"] == "EXIT"
    assert len(r2["geofence"]["alerts_created"]) == 1

    # outside -> outside => no duplicate
    r3 = client.post("/api/v1/location-pings", json=outside, headers=h(patient)).json()
    assert r3["geofence"]["transition"] == "NONE"
    assert r3["geofence"]["alerts_created"] == []

    # guardian can read latest + history for linked patient
    assert client.get(f"/api/v1/location-pings/latest?patient_id={patient}", headers=h(guardian)).status_code == 200
    assert client.get(f"/api/v1/location-pings/history?patient_id={patient}", headers=h(guardian)).status_code == 200

    # stranger cannot read a patient's location
    assert client.get(f"/api/v1/location-pings/latest?patient_id={patient}", headers=h(uid("stranger_loc"))).status_code == 403

    # outside -> inside => ENTER, breach resolved
    r4 = client.post("/api/v1/location-pings", json=inside, headers=h(patient)).json()
    assert r4["geofence"]["transition"] == "ENTER"

    alerts = client.get(f"/api/v1/alerts?patient_id={patient}", headers=h(guardian)).json()["alerts"]
    breaches = [a for a in alerts if a["type"] == "SAFE_ZONE_BREACH"]
    assert breaches and all(a["resolved"] for a in breaches)
    print("[PASSED] valid/invalid ping / latest / history auth / inside-outside-inside transitions")


def test_multiple_safe_zones_overall_state():
    print("\n--- MULTIPLE SAFE ZONES ---")
    patient = uid("patient_multi")
    client.post("/api/v1/safe-zones", json={"name": "A", "latitude": 10.0, "longitude": 10.0, "radius_m": 200}, headers=h(patient))
    client.post("/api/v1/safe-zones", json={"name": "B", "latitude": 50.0, "longitude": 50.0, "radius_m": 200}, headers=h(patient))

    # outside both -> initial state
    client.post("/api/v1/location-pings", json={"latitude": 0.0, "longitude": 0.0}, headers=h(patient))
    # inside zone B -> ENTER (inside if inside ANY enabled zone)
    r = client.post("/api/v1/location-pings", json={"latitude": 50.0, "longitude": 50.0}, headers=h(patient)).json()
    assert r["geofence"]["inside"] is True and r["geofence"]["transition"] == "ENTER"
    # move to zone A -> still inside -> no transition
    r2 = client.post("/api/v1/location-pings", json={"latitude": 10.0, "longitude": 10.0}, headers=h(patient)).json()
    assert r2["geofence"]["inside"] is True and r2["geofence"]["transition"] == "NONE"
    # outside both -> EXIT
    r3 = client.post("/api/v1/location-pings", json={"latitude": 0.0, "longitude": 0.0}, headers=h(patient)).json()
    assert r3["geofence"]["transition"] == "EXIT"
    print("[PASSED] overall transition across multiple safe zones")


# ---------------------------------------------------------------------------
# Alerts: authorization + resolution
# ---------------------------------------------------------------------------
def test_alert_authorization_and_resolution():
    print("\n--- ALERTS AUTH & RESOLUTION ---")
    patient = uid("patient_alert")
    guardian = uid("guardian_alert")
    stranger = uid("stranger_alert")
    _pair(patient, guardian)

    # invalid alert type rejected
    assert client.post("/api/v1/alerts", json={"type": "BOGUS", "message": "x"}, headers=h(patient)).status_code == 400

    # create manual alert
    res = client.post(
        "/api/v1/alerts",
        json={"type": "NIGHT_ACTIVITY", "priority": "AWARENESS", "message": "Test awareness alert"},
        headers=h(patient),
    )
    assert res.status_code == 201, res.text
    alert_id = res.json()["id"]

    # linked guardian may view
    guardian_list = client.get(f"/api/v1/alerts?patient_id={patient}", headers=h(guardian)).json()
    assert guardian_list["count"] >= 1

    # stranger cannot view patient alerts (list or single)
    assert client.get(f"/api/v1/alerts?patient_id={patient}", headers=h(stranger)).status_code == 403
    assert client.get(f"/api/v1/alerts/{alert_id}", headers=h(stranger)).status_code == 403

    # linked guardian may resolve
    resolved = client.patch(
        f"/api/v1/alerts/{alert_id}/resolve", json={"note": "Checked in"}, headers=h(guardian)
    ).json()
    assert resolved["resolved"] is True and resolved["resolved_at"]

    # stranger cannot resolve
    assert client.patch(f"/api/v1/alerts/{alert_id}/resolve", headers=h(stranger)).status_code == 403
    print("[PASSED] create / guardian view / stranger 403 / resolve")


# ---------------------------------------------------------------------------
# SOS
# ---------------------------------------------------------------------------
def test_sos_attaches_latest_location():
    print("\n--- SOS ---")
    patient = uid("patient_sos")
    # Record a known latest location first.
    client.post("/api/v1/location-pings", json={"latitude": 12.34, "longitude": 56.78}, headers=h(patient))

    res = client.post("/api/v1/alerts/sos", headers=h(patient))
    assert res.status_code == 201, res.text
    body = res.json()
    alert = body["alert"]
    assert alert["type"] == "SOS" and alert["priority"] == "CRITICAL"
    assert alert["message"] == "SOS requested by patient."
    assert body["location_attached"] is True
    assert alert["metadata"]["location"]["latitude"] == 12.34
    print("[PASSED] SOS creates CRITICAL alert with latest location attached")


# ---------------------------------------------------------------------------
# Prolonged inactivity
# ---------------------------------------------------------------------------
def test_inactivity_threshold_dedup_reset():
    print("\n--- PROLONGED INACTIVITY ---")
    patient = uid("patient_inact")

    # Configure a short threshold and a stale activity reference.
    client.patch("/api/v1/guardian/settings", json={"inactivity_threshold_min": 15}, headers=h(patient))
    stale = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    asyncio.run(save_settings(patient, {"last_activity_at": stale, "inactivity_alert_active": False}))

    # First check -> HIGH alert created
    r1 = client.post("/api/v1/alerts/inactivity-check", headers=h(patient)).json()
    assert r1["inactive"] is True and r1["alert_created"] is True

    # Immediate re-check -> no duplicate
    r2 = client.post("/api/v1/alerts/inactivity-check", headers=h(patient)).json()
    assert r2["inactive"] is True and r2["alert_created"] is False

    # Activity resumes -> condition reset, alert resolved
    client.post("/api/v1/alerts/activity", json={"significant": False}, headers=h(patient))
    r3 = client.post("/api/v1/alerts/inactivity-check", headers=h(patient)).json()
    assert r3["inactive"] is False

    alerts = client.get("/api/v1/alerts", headers=h(patient)).json()["alerts"]
    inact = [a for a in alerts if a["type"] == "PROLONGED_INACTIVITY"]
    assert inact and all(a["resolved"] for a in inact)
    assert inact[0]["message"] == "Prolonged inactivity detected. Please check on patient."
    print("[PASSED] threshold / duplicate prevention / reset on activity")


# ---------------------------------------------------------------------------
# Night awareness
# ---------------------------------------------------------------------------
def test_night_awareness_window_and_dedup():
    print("\n--- NIGHT AWARENESS ---")
    now = datetime.now()

    # A window that definitely contains "now".
    within_start = (now - timedelta(hours=1)).strftime("%H:%M")
    within_end = (now + timedelta(hours=1)).strftime("%H:%M")

    # A window that definitely does NOT contain "now".
    off_start, off_end = "03:00", "04:00"
    for sw, ew in [("03:00", "04:00"), ("13:00", "14:00")]:
        if not is_within_night_window(now, sw, ew):
            off_start, off_end = sw, ew
            break

    # Disabled -> no alert even with significant activity
    patient_off = uid("patient_night_off")
    client.patch(
        "/api/v1/guardian/settings",
        json={"night_awareness": {"enabled": False, "start_time": within_start, "end_time": within_end}},
        headers=h(patient_off),
    )
    off = client.post("/api/v1/alerts/activity", json={"significant": True}, headers=h(patient_off)).json()
    assert off["night_alert_id"] is None

    # Enabled + within window -> AWARENESS alert
    patient = uid("patient_night")
    client.patch(
        "/api/v1/guardian/settings",
        json={"night_awareness": {"enabled": True, "start_time": within_start, "end_time": within_end}},
        headers=h(patient),
    )
    r1 = client.post("/api/v1/alerts/activity", json={"significant": True}, headers=h(patient)).json()
    assert r1["night_alert_id"] is not None

    # Deduplicate within same night window
    r2 = client.post("/api/v1/alerts/activity", json={"significant": True}, headers=h(patient)).json()
    assert r2["night_alert_id"] is None

    # Enabled but OUTSIDE window -> no alert
    patient2 = uid("patient_night_out")
    client.patch(
        "/api/v1/guardian/settings",
        json={"night_awareness": {"enabled": True, "start_time": off_start, "end_time": off_end}},
        headers=h(patient2),
    )
    r3 = client.post("/api/v1/alerts/activity", json={"significant": True}, headers=h(patient2)).json()
    assert r3["night_alert_id"] is None

    alerts = client.get("/api/v1/alerts", headers=h(patient)).json()["alerts"]
    night = [a for a in alerts if a["type"] == "NIGHT_ACTIVITY"]
    assert len(night) == 1 and night[0]["message"] == "Night activity detected."
    print("[PASSED] enabled/disabled / time-window / deduplication")


# ---------------------------------------------------------------------------
# Freeze assist integration
# ---------------------------------------------------------------------------
def test_freeze_assist_alert_and_dedup():
    print("\n--- FREEZE ASSIST INTEGRATION ---")
    patient = uid("patient_freeze")

    res = client.post(
        "/api/v1/alerts/freeze-assist",
        json={"duration_s": 18, "location_label": "Hallway doorway"},
        headers=h(patient),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["created"] is True
    alert = body["alert"]
    assert alert["type"] == "FREEZE_ASSIST" and alert["priority"] == "HIGH"
    assert alert["message"] == "Freeze assistance may be required."

    # Duplicate prevention while unresolved
    dup = client.post("/api/v1/alerts/freeze-assist", json={}, headers=h(patient)).json()
    assert dup["created"] is False

    # After resolution a new freeze alert may be raised
    client.patch(f"/api/v1/alerts/{alert['id']}/resolve", headers=h(patient))
    again = client.post("/api/v1/alerts/freeze-assist", json={}, headers=h(patient)).json()
    assert again["created"] is True
    print("[PASSED] explicit freeze event creates HIGH alert / duplicate prevention")


# ---------------------------------------------------------------------------
# Guardian dashboard
# ---------------------------------------------------------------------------
def test_guardian_dashboard_linked_only():
    print("\n--- GUARDIAN DASHBOARD ---")
    patient_a = uid("patient_dash_a")
    patient_b = uid("patient_dash_b")
    guardian = uid("guardian_dash")
    _pair(patient_a, guardian)

    # Only patient_a is linked to the guardian.
    client.post("/api/v1/location-pings", json={"latitude": 1.0, "longitude": 2.0}, headers=h(patient_a))
    client.post("/api/v1/alerts/sos", headers=h(patient_a))

    # patient_b has data but is NOT linked to the guardian.
    client.post("/api/v1/location-pings", json={"latitude": 9.0, "longitude": 9.0}, headers=h(patient_b))

    dash = client.get("/api/v1/guardian/dashboard", headers=h(guardian)).json()
    assert dash["count"] == 1
    ids = [p["patient_id"] for p in dash["patients"]]
    assert patient_a in ids and patient_b not in ids

    entry = dash["patients"][0]
    assert entry["unresolved_alert_count"] >= 1
    assert entry["latest_location"]["latitude"] == 1.0
    assert "safe_zone_status" in entry and "recent_alerts" in entry
    assert "recent_activity" in entry and "night_awareness_status" in entry

    # A patient with no guardian links sees no linked patients.
    empty = client.get("/api/v1/guardian/dashboard", headers=h(patient_b)).json()
    assert empty["count"] == 0
    print("[PASSED] linked-patient-only dashboard aggregation")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
def run_all():
    tests = [
        test_geofence_pure_functions,
        test_guardian_linking,
        test_expired_pairing_code,
        test_safe_zones_crud_and_validation,
        test_location_and_geofence_transitions,
        test_multiple_safe_zones_overall_state,
        test_alert_authorization_and_resolution,
        test_sos_attaches_latest_location,
        test_inactivity_threshold_dedup_reset,
        test_night_awareness_window_and_dedup,
        test_freeze_assist_alert_and_dedup,
        test_guardian_dashboard_linked_only,
    ]
    for test in tests:
        test()
    print("\nALL GUARDIAN BACKEND TESTS PASSED!\n")


if __name__ == "__main__":
    run_all()