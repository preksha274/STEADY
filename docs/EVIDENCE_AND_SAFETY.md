# STEADY Evidence, Risk Analysis & Safety Governance Document

> **Document Status**: Production Safety Standard  
> **Last Updated**: 2026-10-07  
> **Target Audience**: Clinical Reviewers, Safety Auditors, Engineering Team  
> **Regulatory Notice**: Not a medical device. SOS alerts designated guardians; emergency services are not contacted. Privacy compliance requires formal legal and ethics review before prospective clinical trial use.

---

## Executive Summary

STEADY is an open-source digital health platform for Parkinson's disease movement tracking, non-invasive cueing, and personal trend monitoring. To prevent patient harm, cognitive overload, or diagnostic misinterpretation, STEADY implements a rigorous **Safety By Design** framework with explicit hardware watchdog monitors, cue storm protections, non-diagnostic plain-language framing, and granular revocable privacy controls.

---

## 1. Safety Gap Mitigations & Verification Status

### 1.1 Band Watchdog & Connection Monitoring
* **Requirement**: If no sensor samples arrive for 5 seconds, display a persistent banner `"Band not connected: Freeze Assist is OFF"`, trigger phone sound/vibration alerts, and report battery level with low-battery warnings.
* **Implementation**:
  - `sensorSourceManager` tracks inter-packet latency ($>5000\text{ ms}$).
  - Mounted global banner [`BandWatchdogBanner.tsx`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/components/BandWatchdogBanner.tsx) displays persistent status across all pages.
  - Triggers phone audio chime and haptic pulse pattern (`[300, 100, 300, 100, 300]`).
  - Monitors telemetry battery level and displays warnings when battery drops below $20\%$.
* **Status**: `VERIFIED`

### 1.2 Motion-Aware Cue Restrictions (Visual Cues Walking Restriction)
* **Requirement**: Disable visual cues while the user is actively walking; allow visual cues only at rest. Default to audio or haptic cueing.
* **Implementation**:
  - [`CueEngine.start()`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/lib/cueEngine.ts) inspects locomotion state. If `isWalking === true` and `type === "visual"`, automatically reroutes to `"audio"` or `"vibration"`.
  - Displays explicit safety notice: `"Visual cues disabled while walking for safety; defaulting to audio/haptic."` to prevent visual distraction and fall hazards during gait.
* **Status**: `VERIFIED`

### 1.3 Medication Reminders & Notification Reliability
* **Requirement**: Enforce user-entered times ONLY (no algorithmic or AI-injected dose time suggestions). Include mandatory statement `"Not a substitute for your prescribed schedule"`, and display clear warnings when notifications are blocked or service fails.
* **Implementation**:
  - [`settings/page.tsx`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/app/settings/page.tsx) strictly requires manual user time input.
  - Renders mandatory disclaimer: *"User-entered times only — Not a substitute for your prescribed schedule."*
  - Checks browser `Notification.permission` and displays warning banner if lock-screen alerts are blocked by OS/browser permissions.
* **Status**: `VERIFIED`

### 1.4 Forgiving Cancel Control & Tremor Simulation Testing
* **Requirement**: Provide a large, forgiving tap target for cue cancellation; add a secondary cancellation route (double-tap/shake or long-press 2s timeout); test responsiveness under simulated tremor.
* **Implementation**:
  - [`FreezeAssistModal.tsx`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/components/FreezeAssistModal.tsx) provides a $64\text{px}$ height, full-width touch cancellation button.
  - Supports double-tap and 2-second hold/press cancellation routes.
  - Features an interactive dev simulator testing cancellation target responsiveness during $5.5\text{ Hz}$ simulated hand tremor.
* **Status**: `VERIFIED`

### 1.5 Cue Storm Protection & Auto-Pause
* **Requirement**: Enforce a minimum 30s cooldown between cues, max 2 cues per 5-minute window, and auto-pause after 3 consecutive cancels with `"Freeze Assist paused: want to adjust sensitivity?"`.
* **Implementation**:
  - [`CueEngine.ts`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/lib/cueEngine.ts) enforces a $30\text{s}$ inter-cue cooldown and throttles activations exceeding 2 cues in 5 minutes.
  - Automatically enters auto-paused state upon 3 consecutive cancels and prompts the user to adjust sensitivity.
* **Status**: `VERIFIED`

### 1.6 Statistical Terminology & Multi-Modal Framing
* **Requirement**: Rename confidence method across all UI and docs to `"personal reference range (90th percentile band)"`. Replace `"fused"` with `"shown together"` where signals are displayed in proximity without single-score fusion.
* **Implementation**:
  - Updated all UI components ([`today/page.tsx`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/app/today/page.tsx), [`confidence.ts`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/lib/confidence.ts), [`plainLanguage.ts`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/lib/plainLanguage.ts)) to display `{count} Signals Shown Together` and reference `personal reference range (90th percentile band)`.
* **Status**: `VERIFIED`

### 1.7 Softened Alert Text & Non-Diagnostic Formatting
* **Requirement**: Use neutral color palettes (amber/slate/indigo instead of loud red), phrase alerts as `"different from your usual"`, append `"Not a diagnosis. Talk to your doctor if you're worried"`, and provide an option to hide the Day Forecast.
* **Implementation**:
  - [`dailyFlags.ts`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/lib/dailyFlags.ts) and [`plainLanguage.ts`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/lib/plainLanguage.ts) format alerts with neutral styling.
  - Appended mandatory disclaimer to all metric cards. Added settings toggle to hide Day Forecast.
* **Status**: `VERIFIED`

### 1.8 Security, Token Management & Data Erasure
* **Requirement**: Require tokens on all API endpoints, add expiry and revocation for guardian links, serve over HTTPS, sanitize PII in logs, and provide a `"Delete My Data"` button.
* **Implementation**:
  - Backend [`main.py`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/backend/main.py) and [`sos.py`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/backend/api/v1/sos.py) enforce token validation, 24h token expiry, and token revocation endpoint (`POST /sos/{token}/revoke`).
  - Anonymized patient IDs and location coordinates in backend console logs.
  - Added full `"Delete My Data"` wipe button in [`settings/page.tsx`](file:///c:/Users/nppre/OneDrive/Desktop/STEADY_TEST/STEADY/frontend/src/app/settings/page.tsx).
* **Status**: `VERIFIED`

---

## 2. Hazard Analysis & Mitigation Matrix

| Hazard ID | Hazard Description | Severity | Mitigation Strategy | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **HAZ-HW-01** | **Battery Overheating & Thermal Runaway**<br>Lithium-polymer battery overheating during continuous BLE transmission or charging. | High | Hardware thermistor cut-off circuit on PCB disabling charging $>45^\circ\text{C}$. | **PLANNED** *(Requires hardware PCB spin v2)* |
| **HAZ-HW-02** | **Skin Irritation & Biocompatibility**<br>Allergic reaction or contact dermatitis from prolonged wearable strap contact. | Medium | Selection of medical-grade silicone/textile materials complying with ISO 10993. | **PLANNED** *(Requires ISO 10993 lab testing)* |
| **HAZ-HW-03** | **Motor Driver Overcurrent & Thermal Cut-Out**<br>Haptic ERM motor driver drawing excessive current during continuous vibration. | Medium | Software 10s maximum vibration burst limit; hardware current limiting resistor ($<100\text{ mA}$). | **VERIFIED** *(Enforced in `steadyBandAdapter.ts`)* |
| **HAZ-SW-01** | **Cue Storm & Sensory Overload**<br>Rapid repetitive cue triggering causing panic or gait freezing escalation. | High | 30s inter-cue cooldown, max 2 cues / 5 min, auto-pause after 3 consecutive cancels. | **VERIFIED** *(Enforced in `CueEngine.ts`)* |
| **HAZ-SW-02** | **Visual Distraction During Locomotion**<br>Patient looking down at flashing screen while walking, causing trips or falls. | High | Visual cues strictly disabled while walking; auto-fallback to audio/haptic modalities. | **VERIFIED** *(Enforced in `CueEngine.ts`)* |
| **HAZ-SW-03** | **Loss of Sensor Telemetry (Silent Disconnect)**<br>Band disconnects during monitoring, leaving user believing safety assist is active. | High | 5s sample watchdog; persistent banner `"Band not connected: Freeze Assist is OFF"`; phone audio/haptic chime. | **VERIFIED** *(Enforced in `BandWatchdogBanner.tsx`)* |
| **HAZ-SW-04** | **Diagnostic Misinterpretation**<br>Patient mistaking non-invasive trend flags for clinical disease progression or diagnosis. | Medium | Softened neutral alert styling; exact phrase *"different from your usual"*; mandatory disclaimer *"Not a diagnosis"*. | **VERIFIED** *(Enforced in `dailyFlags.ts` & `plainLanguage.ts`)* |
| **HAZ-SEC-01** | **Unauthorized Guardian Link Access**<br>Stale or leaked guardian link exposing live patient location indefinitely. | High | 24h token expiration; 1-tap token revocation; patient-facing access audit log. | **VERIFIED** *(Enforced in `sos.py` & `consent.ts`)* |

---

## 3. Plain Language & Medical Disclaimer Requirements

All patient-facing screens MUST include the following standard plain-language disclosures:

1. **General Medical Disclaimer**:  
   > *"Not a medical device. SOS alerts your guardian; emergency services are not contacted."*

2. **Non-Diagnostic Trend Notice**:  
   > *"Not a diagnosis. Talk to your doctor if you're worried."*

3. **Privacy Compliance & Ethics Notice**:  
   > *"Note: Privacy compliance needs formal legal and ethics review before real prospective clinical use."*
