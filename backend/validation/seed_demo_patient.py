"""
STEADY Demo Data Seeder - Step 6: Virtual Patient History Generation
Uses the VirtualLongitudinalPatient simulator to generate 21 days (3 weeks) of
realistic movement check-ins, medication logs, diary entries, and cue test records.

Explicitly flags all records with `is_simulated_demo: True` and `label: "Simulated demo patient"`
to prevent mixing synthetic demonstration data with real clinical telemetry.

Outputs seeded database files and updates frontend/public/demo/seeded_demo_patient.json.
DISCLAIMER: Synthetic patient trajectory for demonstration purposes only.
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timedelta, timezone

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from db.store import db
from steady_ai import (
    generate_gait_assessment_sample,
    extract_motion_features,
    generate_day_forecast,
    CueType
)
from validation.test_forecast_backtest import VirtualLongitudinalPatient
from validation.test_cue_bandit import VirtualPatientSimulator


async def seed_demo_patient(user_id: str = "user_sarah_default"):
    print("=========================================================================")
    print("STEADY DEMO DATA SEEDER: Generating 3 Weeks of Simulated Patient Trajectory")
    print("=========================================================================")

    patient_sim = VirtualLongitudinalPatient(seed=42)
    history_days = patient_sim.generate_3_weeks()

    cue_sim = VirtualPatientSimulator(optimal_cue=CueType.AUDIO_BEAT, optimal_tempo=88, seed=42)

    now = datetime.now(timezone.utc)
    seeded_sessions = []
    seeded_doses = []
    seeded_diary = []

    print(f"Seeding trajectory for User ID: '{user_id}'...")

    for day_info in history_days:
        day_num = day_info["day"]
        day_offset = 21 - day_num
        day_date = now - timedelta(days=day_offset)

        # 1. Seed Diary Entry
        diary_doc = {
            "mood": "Great" if day_info["mood"] >= 4 else ("Okay" if day_info["mood"] == 3 else "Tough"),
            "mood_score_1_5": day_info["mood"],
            "fatigue_score_1_5": day_info["fatigue"],
            "pain_score_1_5": max(1, 6 - day_info["sleep"]),
            "anxiety_score_1_5": 2,
            "sleep_score_1_5": day_info["sleep"],
            "notes": f"Simulated Day {day_num} check-in",
            "is_simulated_demo": True,
            "demo_tag": "Simulated Demo Patient",
            "created_at": (day_date.replace(hour=8, minute=15)).isoformat()
        }
        saved_diary = await db.create_document("diary_entries", user_id=user_id, data=diary_doc)
        seeded_diary.append(saved_diary)

        # 2. Seed Medication Doses (7:30 AM, 12:30 PM, 5:30 PM)
        for dose_h in day_info["doses"]:
            h = int(dose_h)
            m = int((dose_h - h) * 60)
            dose_doc = {
                "medication_name": "Levodopa / Carbidopa",
                "dosage_mg": 100,
                "state_at_dose": "Optimal" if dose_h < 15 else "Wearing Off",
                "dose_hour": dose_h,
                "timestamp_str": f"{h if h<=12 else h-12}:{m:02d} {'AM' if h<12 else 'PM'}",
                "is_simulated_demo": True,
                "demo_tag": "Simulated Demo Patient",
                "created_at": (day_date.replace(hour=h, minute=m)).isoformat()
            }
            saved_dose = await db.create_document("dose_logs", user_id=user_id, data=dose_doc)
            seeded_doses.append(saved_dose)

        # 3. Seed Morning & Afternoon Movement Sessions
        for sess_idx, s_hour in enumerate([9, 14]):
            sample_df = generate_gait_assessment_sample(
                condition="pd_tremor" if sess_idx == 0 else "healthy_control",
                duration_s=12.0,
                seed=day_num * 10 + sess_idx
            )
            features = extract_motion_features(sample_df)

            session_doc = {
                "type": "movement_checkin",
                "imu_file_ref": f"storage://{user_id}/imu/simulated_day_{day_num}_s{sess_idx}.csv",
                "metrics": features.metrics.model_dump(),
                "quality": features.quality.model_dump(),
                "confidence": features.confidence.model_dump(),
                "baseline_deviation_pct": features.baseline_deviation_pct,
                "label": "Compared to your usual (Simulated Demo)",
                "is_simulated_demo": True,
                "demo_tag": "Simulated Demo Patient",
                "created_at": (day_date.replace(hour=s_hour, minute=30)).isoformat()
            }
            saved_sess = await db.create_document("sessions", user_id=user_id, data=session_doc)
            seeded_sessions.append(saved_sess)

    # 4. Seed Cue Session Prescription
    cue_doc = {
        "cue_type": "audio_beat",
        "current_tempo_bpm": 88,
        "initial_tempo_bpm": 80,
        "winning_tempo_bpm": 88,
        "is_active": True,
        "is_simulated_demo": True,
        "demo_tag": "Simulated Demo Patient"
    }
    await db.create_document("cue_sessions", user_id=user_id, data=cue_doc)

    # 5. Compute & Persist Baseline
    baseline_doc = {
        "user_id": user_id,
        "average_tremor_amplitude": 0.22,
        "average_tremor_frequency_hz": 4.8,
        "average_gait_speed_mps": 0.98,
        "beta_band_power": 0.26,
        "total_sessions_count": len(seeded_sessions),
        "is_calibrated": True,
        "is_simulated_demo": True,
        "demo_tag": "Simulated Demo Patient",
        "label": "Personal baseline active (Simulated Demo)"
    }
    await db.create_document("baselines", user_id=user_id, data=baseline_doc, doc_id=f"base_{user_id}")

    # 6. Save demo payload to frontend/public/demo
    frontend_demo_dir = os.path.abspath(os.path.join(backend_dir, "..", "frontend", "public", "demo"))
    os.makedirs(frontend_demo_dir, exist_ok=True)
    out_json = os.path.join(frontend_demo_dir, "seeded_demo_patient.json")

    demo_payload = {
        "user_id": user_id,
        "patient_name": "Sarah (Simulated Demo Patient)",
        "is_simulated_demo": True,
        "demo_tag": "Simulated Demo Patient",
        "total_days_logged": 21,
        "total_sessions_logged": len(seeded_sessions),
        "baseline": baseline_doc,
        "recent_sessions_count": len(seeded_sessions),
        "last_updated": now.isoformat()
    }

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(demo_payload, f, indent=2)

    print(f"\n[PASSED] Successfully seeded 3 weeks ({len(seeded_sessions)} sessions, {len(seeded_doses)} doses, {len(seeded_diary)} diary entries)!")
    print(f"[PASSED] Seeded payload saved to: {out_json}")
    print("-------------------------------------------------------------------------\n")


if __name__ == "__main__":
    asyncio.run(seed_demo_patient())
