# 🔔 STEADY Alert-Burden Specification & Engineering Target (`ALERT_BURDEN.md`)

> **⚠️ IMPORTANT METHODOLOGICAL & DESIGN DISCLAIMER:**  
> **ALERT-BURDEN TARGETS ARE DEFINED AS STEADY INTERNAL ENGINEERING DESIGN TARGETS TO MINIMIZE ALARM FATIGUE AND USER OVERBURDEN, NOT EVIDENCE-BASED OR CLINICALLY VALIDATED MEDICAL THRESHOLDS.**  
>  
> These targets represent internal software thresholds chosen to ensure a smooth, non-intrusive patient experience during continuous daily monitoring.

---

## 1. Alert Burden Targets & Configurable Thresholds

To prevent user alarm fatigue and minimize burden for individuals with Parkinson's disease or caregivers, STEADY enforces configurable alert-burden design targets:

| Metric Parameter | Default Engineering Target | Configurable Range | Description / Purpose |
| :--- | :---: | :---: | :--- |
| **Max False Alerts / Waking Hour** | **$\le 0.5$ / hour** | $0.1 - 2.0$ / hr | Limits unexpected alerts during active waking hours |
| **Max False Alerts / Waking Day** | **$\le 8.0$ / day** | $2.0 - 16.0$ / day | Target for a full 16-hour waking day |
| **Consecutive Window Requirement** | **3 windows (1.5s)** | $1 - 5$ windows | Requires $N$ consecutive positive detection windows before cueing |
| **Context Suppression Gating** | **ACTIVE** | Enabled / Disabled | Suppresses alerts during voluntary arm gestures (typing, eating, waving) |

---

## 2. False Alert Logging Protocol

False alerts per monitored hour are systematically logged across all evaluation phases:

1. **Bench & Automated Signal Tests**:
   - `eval_band_bench.py` simulates 100 voluntary arm movement and resting windows.
   - Evaluates false alert count against the target of $\le 0.5$ false alerts per monitored hour.

2. **Healthy-Volunteer Sessions**:
   - Continuous 60-minute healthy volunteer monitoring sessions are logged.
   - Any alert triggered during voluntary activity or rest in a healthy individual is flagged as a **False Alert Label** and recorded in `/validation/REPORT.md`.

3. **In-App Real-Time Logging**:
   - Every alert raised by the app includes a prominent **"Cancel Alert / False Alarm"** button.
   - Manually cancelled alerts are logged in session stats as `alertsCancelled` and stored in local history to continuously refine user context gating.

---

## 3. Configuration & Customization

The alert burden target can be customized in app settings (`/settings` or `/data-health`) depending on patient sensitivity:
- **Strict / Low Burden Mode**: $\le 0.2$ false alerts/hr (Requires 4 consecutive windows + walking context).
- **Balanced Mode (Default)**: $\le 0.5$ false alerts/hr (Requires 3 consecutive windows).
- **Sensitive Mode**: $\le 1.0$ false alerts/hr (Requires 2 consecutive windows).
