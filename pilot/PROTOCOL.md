# 📋 Ethics-Approved Pilot Protocol: STEADY Feasibility & Finger-Tap Validation Study

* **Protocol Version**: 1.0 (Draft for IRB Review)
* **Target Sample Size**: 5 – 10 participants with Idiopathic Parkinson's Disease (Hoen & Yahr Stage I-III)
* **Study Type**: Observational Feasibility, Usability, & Digital Biomarker Agreement Study
* **Clinical Setting**: Outpatient Movement Disorders Clinic (Clinician Present)

---

## 1. Study Aims & Objectives

### Primary Objectives
1. **Feasibility & Technical Reliability**: Evaluate mobile sensor data completion rates, BLE connectivity stability, and software crash-free rates across daily movement monitoring.
2. **Usability & Patient Experience**: Evaluate system usability via the System Usability Scale (SUS) and monthly Burden Rating (1-5 scale) among adults with Parkinson's.
3. **Finger-Tap Biomarker Agreement**: Measure statistical agreement (Cohen's weighted $\kappa$, Mean Absolute Difference) between the STEADY computer-vision finger-tap algorithm and concurrent 0-4 UPDRS Part III (Item 3.4) scores assigned live by a board-certified neurologist.

### Explicit Disclaimer
* **No Efficacy Claims**: This feasibility pilot is NOT designed or powered to demonstrate clinical efficacy, disease modification, or therapeutic benefit.
* **No Automated Medical Decisions**: The STEADY application is an exploratory digital health tool. It does NOT generate clinical diagnoses, alter medication schedules, or provide diagnostic claims.

---

## 2. Participant Eligibility Criteria

### Inclusion Criteria
* Age $\ge 40$ years at screening.
* Formal diagnosis of Idiopathic Parkinson's Disease according to UK Brain Bank Criteria.
* Hoehn and Yahr Stage I – III (able to walk independently or with single-point assist).
* Able to read, understand, and sign plain-language informed consent in English.
* Willing to perform 3-minute structured movement sessions in clinic.

### Exclusion Criteria
* Severe cognitive impairment (Mini-Mental State Examination MMSE < 24 or MoCA < 21) preventing informed consent or app operation.
* Severe visual impairment uncorrectable with lenses that prevents viewing smartphone screen.
* Co-existing neuromuscular or orthopedic condition substantially confounding gait (e.g. recent hip replacement, severe osteoarthritis).

---

## 3. Session Procedure & Workflow

Each study participant completes a single 45-minute clinic session with a research clinician present:

1. **Informed Consent & Onboarding (10 min)**:
   - Clinician presents plain-language consent form.
   - Participant receives anonymous Participant ID (e.g., `ST-PLT-004`).
2. **System Setup & Orientation (5 min)**:
   - Pair BLE wrist/ankle IMU sensors or orient smartphone camera on table mount.
   - Orient participant to large-button touch interface and voice readout.
3. **Structured Digital Biomarker Tasks (20 min)**:
   - **Finger-Tapping Test (MDS-UPDRS 3.4)**: Participant performs 10 seconds of rapid index-thumb tapping. Algorithm records tap rate, count, and amplitude decrement while neurologist simultaneously scores 0-4 on clinician interface.
   - **Postural Tremor Test**: 10-second forward arm extension.
   - **Timed 10-Meter Walk & Turn**: Natural walk while smartphone/wearable logs gait cadence and freezing index.
   - **Sustained Vowel Vocalization**: 3-second sustained `/a/` phonation.
4. **Usability & Burden Questionnaire (10 min)**:
   - Participant completes 5-item burden assessment and SUS usability rating.

---

## 4. Participant Safety & Discontinuation

* **Voluntary Participation**: Participants may pause, skip tasks, or withdraw from the study at any time without penalty or change to standard medical care.
* **Clinician Presence**: A board-certified neurologist or trained clinical researcher is physically present throughout all session steps.
* **Fall Prevention**: All walking and tapping tasks take place in clear, unobstructed clinic corridors with safety standby.

---

## 5. Data Management, Privacy, & Governance

* **Anonymized Participant IDs**: No Personally Identifiable Information (PII) such as full names, social security numbers, or addresses are stored in trial datasets. All logs are keyed to Participant IDs (e.g., `ST-PLT-001`).
* **Local Storage First**: All raw sensor waveforms, video frames, and audio features are processed locally on-device. No raw video or audio files leave the device without explicit participant opt-in.
* **Data Access Permissions**: Only authorized study investigators listed on IRB documentation hold access keys to anonymized trial datasets.
* **Data Retention Period**: Anonymized numerical feature logs and agreement matrices are retained for 5 years post-study completion according to institutional data governance policy.
