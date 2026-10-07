# 🏆 STEADY — Complete Hackathon Pitch & Presentation Guide

> **Project Name:** STEADY — Parkinson's Movement Companion  
> **Tagline:** The AI-Powered Movement Companion Re-engineering Neurological Rehabilitation & Fall Prevention for Parkinson’s Patients.

---

## ⚡ 1. The 30-Second Elevator Pitch

> *"Over 10 million people worldwide live with Parkinson’s Disease, facing daily debilitating mobility barriers like Freeze of Gait (FoG) and severe tremor episodes. Existing health apps are passive trackers—they record symptoms after the fall happens. **STEADY** is an active, real-time closed-loop movement companion. Combining computer vision, Web Audio rhythm entrainment, EEG/IMU bio-signal analysis, and voice-assisted coaching, STEADY detects freeze episodes instantly, delivers personalized rhythmic auditory cues to restore motor rhythm, and enforces intelligent 'Calm Stops' before fatigue leads to falls."*

---

## 🔍 2. Market Gap Analysis & Competitor Comparison

| Feature / Capability | Passively Logged Apps (e.g., Apple Health, Symptom Logs) | Wearable Hardware Trackers ($500+) | **STEADY (Our Solution)** |
| :--- | :--- | :--- | :--- |
| **Real-Time Gait Unfreezing** | ❌ None (Logs after the fall) | ⚠️ Requires costly hardware | **✅ Instant Emergency Freeze Assist (Zero extra hardware)** |
| **Computer Vision Form Tracking** | ❌ None | ❌ None | **✅ MediaPipe + Spatial Region Optical Flow via standard web camera** |
| **Rhythm Entrainment Engine** | ❌ None | ⚠️ Static click tracks | **✅ Adaptive Web Audio Cue Engine with Phase-Offset & Cue Fatigue Detection** |
| **Fall Prevention Safeguards** | ❌ None | ❌ None | **✅ Automatic 'Calm Stop' triggered when motion amplitude drops >25%** |
| **Multi-Modal Bio-Signals** | ❌ None | ⚠️ Closed proprietary sensors | **✅ FastAPI Backend analyzing IMU Accelerometer + EEG Beta Band Power** |
| **Hands-Free Accessibility** | ❌ Poor (requires small buttons) | ❌ None | **✅ 100% Voice-Guided Navigation & Emergency Speech Activation** |

---

## 🚀 3. Detailed Feature Breakdown & Technology Stack

### 1. 🆘 Emergency Freeze Assist (Instant Gait Unfreezing)
* **What it does:** When a patient experiences "Freeze of Gait" (feeling glued to the floor), a single tap or voice command triggers Freeze Assist. It instantly broadcasts a high-visibility visual pulse and a precise rhythmic auditory metronome tuned to their baseline cadence.
* **Why it's unique:** Integrates 4 evidence-based neurological unfreezing strategies (line-stepping, weight-shifting, knee-marching, vocal counting) combined with live audio pacing to bypass damaged basal ganglia pathways.
* **Tech Stack:** Web Audio API (Lookahead Scheduler), CSS Glassmorphism Animations, React Hooks.

### 2. 👁️ Vision-Based Kinematic Form Tracker
* **What it does:** Uses any standard smartphone or laptop webcam to track joint movements during daily exercises (Big Reach, High Knees, Sit-to-Stand) in real-time.
* **Why it's unique:** No depth camera or expensive wearable required. It calculates 3D spatial region motion displacement to provide live form coaching ("Reach higher", "Lift knees higher").
* **Tech Stack:** `@mediapipe/tasks-vision`, HTML5 Canvas Optical Frame Difference Engine, Next.js / React 19.

### 3. 🎵 Adaptive Cue Engine & Rhythm Entrainment Score
* **What it does:** Plays real-time metronome beats synchronized with user movement. It calculates instantaneous phase-offset to show a **Rhythm Entrainment Score %** (how well the patient matches the beat).
* **Why it's unique:** Features **Cue Fatigue Detection**—if a patient's responsiveness to a specific tempo or sound drops by ≥15% over time, the system detects sensory adaptation and recommends a new cue modality (audio, visual, or haptic).
* **Tech Stack:** Web Audio API, `localStorage` cue persistence algorithms, Recharts visualization.

### 4. 🛑 Dynamic "Calm Stop" Fall Prevention
* **What it does:** Continuously measures movement amplitude during exercise sessions. If joint displacement shrinks by >25% due to fatigue, STEADY safely terminates the session before a fall occurs.
* **Why it's unique:** Prioritizes patient safety over aggressive completion; prevents over-exertion which is the #1 cause of exercise-induced falls in Parkinson's care.
* **Tech Stack:** Moving average smoothing buffer, amplitude degradation thresholds.

### 5. 🧠 Multi-Tenant AI Bio-Signal Backend
* **What it does:** Processes raw IMU (accelerometer/gyroscope) CSV files and multi-channel EEG data to detect tremor frequencies (4–7 Hz Parkinsonian band) and EEG Beta Band power elevation.
* **Why it's unique:** Gives clinicians objective quantitative biometrics alongside patient self-reports.
* **Tech Stack:** Python 3.13, FastAPI, NumPy, SciPy (FFT / PSD spectral analysis), Pandas, Uvicorn.

### 6. 🎙️ Hands-Free Voice Companion & Live Coaching
* **What it does:** Provides 100% voice-guided operation. Patients can say *"I'm frozen"* or *"Start routine"* without struggling with small touch targets during tremor episodes.
* **Why it's unique:** Uses smart audio ducking—when the voice coach speaks, the metronome beat volume automatically dips to 25% and smoothly recovers.
* **Tech Stack:** Web Speech Synthesis & Recognition API, custom ducking timer logic.

---

## ⚖️ 4. Hackathon Judging Criteria Mapping

1. **Innovation & Originality (25%):**
   * Solves a critical, overlooked problem: *Freeze of Gait*. Instead of passive monitoring, STEADY acts as an active neurological bypass using rhythmic auditory stimulation.
2. **Technical Complexity & Architecture (25%):**
   * Multi-layered stack: Next.js 16 frontend + FastAPI Python backend + Web Audio API scheduler + MediaPipe Pose computer vision + Web Speech API.
3. **User Experience & Accessibility (20%):**
   * Tailored for motor impairment: high-contrast dark UI, large emergency touch targets, voice-driven commands, and high-legibility typography.
4. **Real-World Impact & Feasibility (20%):**
   * Zero extra hardware needed. Any patient with a smartphone or laptop browser gets immediate access to clinical-grade movement care.
5. **Completeness & Polish (10%):**
   * Fully functional frontend and backend, live health endpoints, zero console errors, smooth micro-animations.

---

## 🎤 5. The 2-Minute Live Demo Presentation Script

* **[0:00 - 0:20] The Hook & Problem**
  * *"Hi judges! Imagine walking across your living room and suddenly your feet feel completely glued to the floor. You try to step, lose balance, and fall. This is Freeze of Gait, affecting over 60% of Parkinson's patients. Existing apps only log falls AFTER they happen. Meet **STEADY**—the real-time AI companion that prevents falls and unfreezes gait."*

* **[0:20 - 0:55] Feature 1: Emergency Freeze Assist**
  * *"Let’s demo our core feature: **Freeze Assist**. With a single tap or simply saying 'I'm frozen', STEADY activates our Web Audio rhythm engine. It delivers an 88 BPM auditory metronome and visual pulse. By tapping into the brain's auditory motor pathways, patients sync their steps to the beat and break out of the freeze instantly."*

* **[0:55 - 1:30] Feature 2: Camera Form Tracking & Calm Stop**
  * *"Next, let's look at our **Move Module**. Using standard camera vision via MediaPipe, STEADY tracks joint displacement in real-time without hardware wearables. Notice how it provides live audio feedback ('Reach higher!'). Even more importantly, if my movement amplitude drops by over 25% due to muscle fatigue, STEADY automatically triggers a **Calm Stop** to prevent a fall."*

* **[1:30 - 1:50] Feature 3: FastAPI Bio-Signal Backend & Cue Lab**
  * *"Under the hood, our FastAPI backend processes raw IMU and EEG bio-signals, performing FFT power spectral analysis to detect tremor frequencies and beta band suppression. In our **Cue Lab**, STEADY monitors cue fatigue—if a patient stops responding to a cue, it dynamically recalibrates their pacing."*

* **[1:50 - 2:00] Closing & Call to Action**
  * *"STEADY bridges the gap between hardware-less accessibility and clinical precision. It turns any device into a life-saving movement companion. Thank you!"*
