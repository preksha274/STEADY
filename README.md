# STEADY — Parkinson's Movement Companion & Forecast Engine

**STEADY** is an accessible, offline-first digital movement companion engineered for individuals with Parkinson's disease, their families, and clinicians. It pairs phone-sensor IMU motion signal processing, pose estimation, and adaptive rhythmic sensory cueing with daily mobility forecasting and voice-guided assistance.

---

## 🌟 Key Features

1. **Daily Mobility Forecast & Optimal Window**
   - Gaussian Process-inspired response curve model calibrated from medication timing and symptom logs.
   - Transparent 3-tier confidence progression: `<3d` (Population Prior) $\to$ `3–6d` (Typical Pattern) $\to$ `≥7d` (Personalized Pattern).

2. **TremorScope & Signal Processing (Pure Typed AI Layer)**
   - IMU accelerometer & gyroscope feature extraction: tremor amplitude, dominant peak frequency (3–8 Hz), entropy, and standardized confidence reports.
   - EEG spectral band power extraction (Delta, Theta, Alpha, Beta) with sensor quality checks.

3. **Move Coach with 8 Evidence-Based Therapeutic Poses**
   - **Big Overhead & Lateral Reach (LSVT BIG)**: Counteracts bradykinesia and small movements.
   - **High Marching & Step Clearance**: Freezing of gait (FOG) prevention and foot clearance.
   - **Axial Torso & Trunk Rotation**: Relieves axial trunk rigidity and helps turning stability.
   - **Sit-to-Stand Chair Transfers**: Lower extremity strength and sit-to-stand transitions.
   - **Heel-to-Toe Rocking Balance**: Center-of-mass control and dynamic balance.
   - **Clock & Lateral Side Stepping**: Multi-directional reactive stepping.
   - **Posture Reset & Scapular Squeeze**: Counteracts stooped posture (camptocormia).
   - **Finger Tap & Hand Open-Close**: MDS-UPDRS fine motor agility tracking.
   - Real-time skeleton landmark overlay, audio metronome pacing, and live spoken feedback.

4. **Bidirectional Voice Guide & Assistant**
   - Web Speech API integration with Text-to-Speech (TTS) coaching and hands-free voice commands.
   - Spoken commands: *"Help I am frozen"*, *"Start Move Coach"*, *"Log medication"*, *"What is my forecast today?"*, *"Check vocal tremor"*.

5. **Instant Freeze Assist**
   - One-tap emergency visual laser cue overlay, haptic pulse, and rhythmic metronome pacing to break freezing of gait (FOG) episodes.

6. **Doctor-Reported Clinical Scores (MDS-UPDRS Record)**
   - Dedicated manual entry screen for scores assessed by a clinician in an appointment.
   - Pure separation: Never factored into AI predictions, non-diagnostic, no questionnaires on sign-in.

---

## 🔬 Algorithmic Validation Ladder (Non-Clinical Verification)

All validation suites reside in `backend/validation/` and prove algorithmic correctness:

| Validation Layer | Target Module | Benchmark / Condition | Key Result |
| :--- | :--- | :--- | :--- |
| **Synthetic Signal Recovery** | `TremorScope` | 54 conditions (3–8 Hz, 20–100 Hz Fs, 0–2.0 SNR noise) | **100.0% Pass** (within $\pm 0.3\,\text{Hz}$) |
| **Real Cohort Separation** | IMU Gait & EEG Pipelines | 2025 Gait Benchmark & BCI EEG Dataset (PD vs Control) | Tremor amplitude: $d = 276.86, p < 0.001$<br>Beta power: $d = 306.68, p < 0.001$ |
| **Adaptive Loop (Bandit)** | `Live Cue Designer` | Virtual patient hill-climbing adapt loop vs random | **100% Convergence**; **66.2% regret reduction** |
| **Forecast Backtest** | `Response Curve + Day Forecast` | 3-week trajectory with 14d vs 7d vs 3d history | **MAE = 0.141**; Optimal window accuracy: **71.4%** |
| **Cold-Start Transitions** | `steady_ai.forecast` | `<3d`, `3–6d`, `≥7d` operational regimes | Validated population prior fallback $\to$ personalized |
| **Demo Patient Seeding** | Database & Frontend state | 3-week history (42 sessions, 63 doses, 21 diary logs) | Seeded with inspectable lineage flag `is_simulated_demo: true` |

To run the complete validation suite:
```bash
cd backend
python validation/run_all_validations.py
```

---

## 🚀 Quick Start Guide

### 1. Backend Server (Python FastAPI)

```bash
cd backend

# Create & activate virtual environment (Windows PowerShell)
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed demo patient dataset
python validation/seed_demo_patient.py

# Start FastAPI server
uvicorn main:app --reload --port 8000
```
- API Server: `http://localhost:8000`
- Interactive API Docs (Swagger): `http://localhost:8000/docs`

---

### 2. Frontend Application (Next.js + TypeScript + Tailwind CSS)

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start Next.js development server
npm run dev
```
- Web Application: `http://localhost:3000`
- Build for Production: `npm run build`

---

## 📡 Key REST API Endpoints (`/api/v1`)

- `POST /api/v1/sessions/upload` — Ingest IMU/EEG movement session
- `POST /api/v1/sessions/{id}/video` — MirrorMotion pose estimation & gait kinematics
- `GET /api/v1/forecast/today` — Daily mobility forecast & best window
- `POST /api/v1/cue-sessions/adapt` — Live Cue Designer adaptive test loop
- `POST /api/v1/clinical-scores` — Store doctor-reported MDS-UPDRS score
- `GET /api/v1/clinical-scores?patient_id=` — Retrieve doctor-reported assessment history
- `POST /api/v1/danger-zones` — Home hazard spot spatial mapping
- `POST /api/v1/freeze-episodes` — Freezing of gait episode logging

---

## ⚖️ Non-Diagnostic Disclaimer
STEADY is an informational movement companion and forecast engine. It does not provide medical diagnoses, treatment plans, or clinical disease staging. Always consult a qualified neurologist or healthcare professional for clinical management.
