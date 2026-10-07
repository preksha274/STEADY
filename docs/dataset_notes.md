# 📚 STEADY Clinical & Sensor Dataset Documentation (`dataset_notes.md`)

This document details the public clinical and sensor datasets used to evaluate and benchmark **STEADY digital biomarkers**, including data sources, sampling rates, annotation granularities, licensing constraints, and evaluation limitations.

---

## Summary of Evaluated Datasets & Licenses

| Dataset Name | Primary Domain | Sampling Rate | Sensor Placement | Annotation Granularity | Licensing Status |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Parkinson@Home** | Tremor (ON/OFF Meds) | 200 Hz $\rightarrow$ 100 Hz | Wrist IMU | Continuous Video Events | ⚠️ **Verify before use** (Data Use Agreement) |
| **FoG-STAR** | Freezing of Gait | 60 Hz | Wrist, Ankle, Back | Continuous Video Events | Open Access (CC BY 4.0) |
| **PADS** | Tremor (Rest / Posture) | 100 Hz | Wrist IMU | Task-Level (PD vs Control) | ⚠️ **Non-Commercial (CC BY-NC-SA 4.0)** |
| **Daphnet FoG** | Freezing of Gait | 64 Hz | Ankle, Thigh, Trunk | Continuous Video Events | Open Access (PhysioNet License) |
| **PhysioNet Gait** | Gait & Stride Timing | 100 Hz | Under-foot Force | Subject-level UPDRS | Open Access (PhysioNet License) |
| **UCI Telemonitoring** | Voice & Acoustics | 44.1 kHz Audio | Microphone | Subject-level UPDRS | Open Access (CC BY 4.0) |

---

## Detailed Dataset Profiles & Limitations

### 1. Parkinson@Home Dataset
* **Source**: Radboud University Medical Center / Parkinson@Home Study.
* **Licence**: ⚠️ **Verify before use** (Requires Data Use Agreement / Restricted Academic Access).
* **Sampling Rate**: 200 Hz raw wrist accelerometer & gyroscope. Downsampled to **100 Hz** (via 4th-order Butterworth 20 Hz low-pass filter) to match Steady Band hardware specs.
* **Labels**: Continuous expert video annotations for tremor events, evaluated across **Medication ON** and **Medication OFF** states separately.
* **Limitations**: Unconstrained free-living home recordings. Contains high voluntary movement noise (cooking, eating, gestures) requiring context gating.

### 2. FoG-STAR Freezing of Gait Dataset
* **Source**: FoG-STAR Clinical Freezing of Gait Dataset.
* **Licence**: Open Access (Creative Commons Attribution 4.0 International).
* **Sampling Rate**: 60 Hz tri-axial IMU sensors.
* **Placements Evaluated**:
  * **Wrist IMU** (60 Hz): Labeled ⚠️ **Experimental** (uses leg-motion independent features like posture transition and tremor band power).
  * **Ankle IMU** (60 Hz): Lower-limb benchmark placement.
  * **Back/Trunk IMU** (60 Hz): Body-center benchmark placement.
* **Labels**: Expert-annotated Freezing of Gait (FoG) start and end timestamps.
* **Limitations**: Wrist placement lacks direct leg swing kinematics; sensitivity is lower (81.2%) compared to ankle (95.8%).

### 3. PADS (Parkinson's Disease Analysis Dataset)
* **Source**: PADS Open Parkinson's Repository.
* **Licence**: ⚠️ **Non-commercial (CC BY-NC-SA 4.0)** — Strictly prohibited for commercial product deployment without separate licensing.
* **Sampling Rate**: 100 Hz wrist IMU.
* **Tasks Evaluated**:
  1. *Rest Tremor Task*: Hands resting unsupported on lap/table.
  2. *Postural Tremor Task*: Arms held outstretched horizontally against gravity.
* **Labels**: **Task-level labels** (PD Patient vs Healthy Control subject), NOT continuous event-level annotations.
* **Limitations**: Cannot be used to measure continuous false alarm rate per hour because events are not timestamped at sub-second precision.

### 4. Daphnet Freezing of Gait Dataset
* **Source**: PhysioNet (Bachlin et al., 2010).
* **Licence**: PhysioNet Open Data License.
* **Sampling Rate**: 64 Hz (Ankle, Thigh, Trunk sensors).
* **Labels**: Continuous video-synchronized freezing of gait timestamps.
* **Limitations**: Laboratory walking protocol (360-degree turns, walking through doorways, obstacle navigation). Controlled lab environment presents lower noise than unconstrained daily life.

### 5. PhysioNet Gait in Parkinson's Disease
* **Source**: PhysioNet Database (Goldberger et al., 2000; Hausdorff et al., 2007).
* **Licence**: PhysioNet Open Data License.
* **Sampling Rate**: 100 Hz under-foot force sensors across 93 PD patients and 73 healthy controls.
* **Labels**: Stride timing, gait speed, swing duration, and clinical UPDRS total motor score.
* **Limitations**: 2-minute straight corridor walking tests; does not evaluate turning or unconstrained home gait.

### 6. UCI Parkinson's Telemonitoring & Voice Datasets
* **Source**: UCI Machine Learning Repository (Tsanas et al., 2010).
* **Licence**: Creative Commons Attribution 4.0 (CC BY 4.0).
* **Sampling Rate**: 44.1 kHz acoustic audio recordings.
* **Labels**: Total UPDRS and Motor UPDRS scores for 42 PD patients recorded over 6 months.
* **Limitations**: Evaluates sustained phonations (/a/ vowel), which do not capture natural conversational speech dynamics and are sensitive to acoustic background noise.
