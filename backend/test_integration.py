"""
Comprehensive End-to-End API Integration Test Suite for STEADY
Validates all 12 API v1 endpoints and chains:
1. upload -> session -> baseline chain
2. diary -> forecast chain
3. video -> gait features chain
4. cue-sessions test -> adapt -> prescription chain
5. danger-zones -> freeze-episodes linkage chain
6. severity meter readings ("Compared to your usual")
7. dose logs tracking
8. voice checks loudness & non-motor aggregation
9. clinician pre-visit report generation
10. Strict multi-tenant per-user authentication isolation
"""

import os
import io
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
backend_dir = os.path.dirname(os.path.abspath(__file__))


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    print("[PASSED] GET /health passed")


def test_upload_session_and_baseline_chain():
    # User 1 performs an IMU upload
    headers = {"X-User-ID": "user_sarah_test"}
    imu_file_path = os.path.join(backend_dir, "demo_imu_tremor.csv")
    
    with open(imu_file_path, "rb") as f:
        res = client.post(
            "/api/v1/sessions/upload",
            headers=headers,
            files={"imu_file": ("demo_imu_tremor.csv", f, "text/csv")},
            data={"baseline_amplitude": "0.20"}
        )

    assert res.status_code == 200, f"Upload error: {res.text}"
    session_data = res.json()
    assert session_data["id"].startswith("ses_")
    assert session_data["user_id"] == "user_sarah_test"
    assert "storage://" in session_data["imu_file_ref"]
    assert session_data["metrics"]["tremor_frequency_hz"] > 4.0
    assert session_data["confidence"]["tier"] in ["high", "medium"]
    assert session_data["label"] == "Compared to your usual"
    session_id = session_data["id"]
    print(f"[PASSED] POST /api/v1/sessions/upload passed: Session {session_id} created with storage ref {session_data['imu_file_ref']}")

    # Check baseline updated
    res_base = client.get("/api/v1/baseline", headers=headers)
    assert res_base.status_code == 200
    base_data = res_base.json()
    assert base_data["user_id"] == "user_sarah_test"
    assert base_data["total_sessions_count"] >= 1
    assert "average_tremor_amplitude" in base_data
    print(f"[PASSED] GET /api/v1/baseline passed: Recomputed baseline with {base_data['total_sessions_count']} sessions")

    # Check session by ID
    res_single = client.get(f"/api/v1/sessions/{session_id}", headers=headers)
    assert res_single.status_code == 200
    assert res_single.json()["id"] == session_id
    print(f"[PASSED] GET /api/v1/sessions/{session_id} passed")

    # Upload video for session
    fake_video = io.BytesIO(b"FAKE_VIDEO_CONTENT_BYTE_STREAM")
    res_vid = client.post(
        f"/api/v1/sessions/{session_id}/video",
        headers=headers,
        files={"video_file": ("movement_reach.mp4", fake_video, "video/mp4")}
    )
    assert res_vid.status_code == 200
    assert "video_file_ref" in res_vid.json()
    assert "gait_features" in res_vid.json()
    print(f"[PASSED] POST /api/v1/sessions/{session_id}/video passed: Video reference and gait angles saved")


def test_diary_and_forecast_chain():
    headers = {"X-User-ID": "user_sarah_test"}

    # Log two more sessions to ensure >= 3 sessions for calibrated forecast
    imu_file_path = os.path.join(backend_dir, "demo_imu_tremor.csv")
    for _ in range(2):
        with open(imu_file_path, "rb") as f:
            client.post(
                "/api/v1/sessions/upload",
                headers=headers,
                files={"imu_file": ("demo_imu_tremor.csv", f, "text/csv")}
            )

    # 1. Post Diary check-in
    res_diary = client.post(
        "/api/v1/diary",
        headers=headers,
        json={
            "mood": "Great",
            "mood_score_1_5": 4,
            "fatigue_score_1_5": 2,
            "pain_score_1_5": 1,
            "anxiety_score_1_5": 1,
            "sleep_score_1_5": 4,
            "notes": "Felt energized after morning stretch"
        }
    )
    assert res_diary.status_code == 200
    diary_data = res_diary.json()
    assert diary_data["mood"] == "Great"
    assert diary_data["composite_nonmotor_index"] >= 1.0
    print(f"[PASSED] POST /api/v1/diary passed: Non-motor burden {diary_data['composite_nonmotor_index']}")

    # 2. Log a medication dose
    res_dose = client.post(
        "/api/v1/dose-logs",
        headers=headers,
        json={
            "medication_name": "Levodopa / Carbidopa",
            "dosage_mg": 100,
            "state_at_dose": "Optimal",
            "dose_hour": 7.5
        }
    )
    assert res_dose.status_code == 200
    print("[PASSED] POST /api/v1/dose-logs passed")

    # 3. Retrieve Day Forecast
    res_fc = client.get("/api/v1/forecast/today", headers=headers)
    assert res_fc.status_code == 200
    fc_data = res_fc.json()
    assert fc_data["has_sufficient_data"] is True
    assert fc_data["best_window"] is not None
    assert len(fc_data["timeline"]) > 0
    assert fc_data["confidence"]["tier"] in ["high", "medium"]
    print(f"[PASSED] GET /api/v1/forecast/today passed: Best mobility window {fc_data['best_window']['window_label']}")


def test_cue_sessions_and_prescription():
    headers = {"X-User-ID": "user_sarah_test"}

    # Start cue session
    res_start = client.post(
        "/api/v1/cue-sessions",
        headers=headers,
        json={"cue_type": "audio_beat", "target_tempo_bpm": 88}
    )
    assert res_start.status_code == 200
    cue_id = res_start.json()["id"]

    # Adapt step
    res_step = client.patch(
        f"/api/v1/cue-sessions/{cue_id}",
        headers=headers,
        json={
            "measured_cadence_spm": 92.0,
            "current_sync_pct": 86.0,
            "current_stride_smoothness": 0.88
        }
    )
    assert res_step.status_code == 200
    assert res_step.json()["current_tempo_bpm"] == 90
    print(f"[PASSED] POST / PATCH /api/v1/cue-sessions passed: Nudged tempo to {res_step.json()['current_tempo_bpm']} BPM")

    # Prescription export
    res_rx = client.get("/api/v1/cue-sessions/prescription", headers=headers)
    assert res_rx.status_code == 200
    assert res_rx.json()["optimal_tempo_bpm"] == 90
    print(f"[PASSED] GET /api/v1/cue-sessions/prescription passed: Modality {res_rx.json()['recommended_cue_modality']}")


def test_danger_zones_and_freeze_episodes():
    headers = {"X-User-ID": "user_sarah_test"}

    # 1. Create a danger zone
    res_zone = client.post(
        "/api/v1/danger-zones",
        headers=headers,
        json={
            "room_name": "Kitchen",
            "spot_name": "Island Turn",
            "risk_level": "medium",
            "hazard_trigger": "Quick pivot",
            "freeze_count": 0
        }
    )
    assert res_zone.status_code == 200
    zone_id = res_zone.json()["id"]

    # 2. Log a freeze episode linked to this danger zone
    res_freeze = client.post(
        "/api/v1/freeze-episodes",
        headers=headers,
        json={
            "danger_zone_id": zone_id,
            "location_label": "Kitchen island turn",
            "duration_s": 12.0,
            "effective_unfreeze_strategy": "Auditory Metronome 88 BPM"
        }
    )
    assert res_freeze.status_code == 200
    assert res_freeze.json()["danger_zone_id"] == zone_id

    # 3. Verify danger zone freeze count incremented
    zones_list = client.get("/api/v1/danger-zones", headers=headers).json()["danger_zones"]
    target_zone = next(z for z in zones_list if z["id"] == zone_id)
    assert target_zone["freeze_count"] == 1
    print(f"[PASSED] Danger Zones & Freeze Episode Linkage passed: Incremented freeze count to {target_zone['freeze_count']}")


def test_severity_readings():
    headers = {"X-User-ID": "user_sarah_test"}
    res = client.get("/api/v1/severity", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["label"] == "Compared to your usual"
    assert len(data["readings"]) == 3
    for r in data["readings"]:
        assert r["tier_label"] in ["Mild", "Moderate", "High"]
        assert "confidence" in r
    print("[PASSED] GET /api/v1/severity passed: Verified 3 symptoms with 'Compared to your usual' framing")


def test_voice_checks_and_pre_visit_report():
    headers = {"X-User-ID": "user_sarah_test"}

    # Voice check
    res_vc = client.post(
        "/api/v1/voice-checks",
        headers=headers,
        json={
            "pain_score_1_5": 2,
            "fatigue_score_1_5": 2,
            "anxiety_score_1_5": 1,
            "sleep_score_1_5": 4,
            "notes": "Voice loud and steady this morning"
        }
    )
    assert res_vc.status_code == 200
    assert "voice_metrics" in res_vc.json()
    assert "not a diagnostic" in res_vc.json()["disclaimer"].lower()
    print("[PASSED] POST /api/v1/voice-checks passed")

    # Pre-visit clinical report
    res_rep = client.post(
        "/api/v1/reports/pre-visit",
        headers=headers,
        json={"clinician_name": "Dr. Sarah Adams", "reporting_period_days": 14}
    )
    assert res_rep.status_code == 200
    rep_data = res_rep.json()
    assert "key_findings" in rep_data
    assert "symptom_trends" in rep_data
    assert "disclaimer" in rep_data
    print(f"[PASSED] POST /api/v1/reports/pre-visit passed: Report {rep_data['report_id']} generated")


def test_multi_tenant_auth_isolation():
    # User A records a session
    headers_a = {"X-User-ID": "user_alice"}
    imu_file_path = os.path.join(backend_dir, "demo_imu_short.csv")
    with open(imu_file_path, "rb") as f:
        res_a = client.post(
            "/api/v1/sessions/upload",
            headers=headers_a,
            files={"imu_file": ("demo_imu_short.csv", f, "text/csv")}
        )
    session_a_id = res_a.json()["id"]

    # User B queries their sessions
    headers_b = {"X-User-ID": "user_bob"}
    res_b_list = client.get("/api/v1/sessions", headers=headers_b)
    user_b_sessions = res_b_list.json()["sessions"]
    # User B must NOT see User A's session
    assert all(s["id"] != session_a_id for s in user_b_sessions)

    # User B attempts to access User A's session by direct ID -> must 404
    res_b_direct = client.get(f"/api/v1/sessions/{session_a_id}", headers=headers_b)
    assert res_b_direct.status_code == 404
    print("[PASSED] Strict multi-tenant per-user isolation verified: Cross-user access blocked!")


if __name__ == "__main__":
    print("\n--- RUNNING STEADY API INTEGRATION TEST SUITE ---")
    test_health()
    test_upload_session_and_baseline_chain()
    test_diary_and_forecast_chain()
    test_cue_sessions_and_prescription()
    test_danger_zones_and_freeze_episodes()
    test_severity_readings()
    test_voice_checks_and_pre_visit_report()
    test_multi_tenant_auth_isolation()
    print("\n========================================================")
    print("ALL API V1 ENDPOINTS & INTEGRATION CHAINS PASSED!")
    print("========================================================")
