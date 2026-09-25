# STEADY Backend API & AI Signal-Processing Engine

FastAPI backend and isolated, typed Python signal-processing modules (`steady_ai`) for STEADY — a Parkinson's Movement Companion.

## Modules in `steady_ai`

1. **Motion Feature Extraction (`steady_ai.motion`)**
   - Dominant tremor frequency (3–8 Hz FFT/Welch), tremor amplitude (RMS), signal variability, gyro RMS, and gait cadence/symmetry.
2. **EEG Band-Power Extraction (`steady_ai.eeg`)**
   - Delta, Theta, Alpha, Beta (13–30 Hz), Gamma powers with multi-channel artifact diagnostics (flatline, 50/60Hz mains line noise, high-voltage artifacts).
3. **Pose Estimation & Move Coach Live Rules (`steady_ai.pose`)**
   - MediaPipe/MoveNet landmark processing: trunk inclination angle, arm swing range & asymmetry, knee flexion.
   - Transparent rule-based coaching feedback ("Stand taller", "Bigger reach", "Steady pace", "Symmetric arm swing").
4. **Data-Quality & Confidence Scoring (`steady_ai.confidence`)**
   - Tiered confidence (`HIGH`, `MEDIUM`, `LOW`) and specific quality issues (`QualityIssue` enum) directly rendered by UI `ConfidenceBadge`s.
5. **Personal Response Curve & Day Forecast (`steady_ai.forecast`)**
   - Circadian + Levodopa pharmacokinetic curve model, uncertainty bands, and explicit thin-history blocking.
6. **Live Cue Designer Adaptation Loop (`steady_ai.cue_adaptation`)**
   - 1D hill-climbing tempo optimization and habituation/cue-fatigue detection with modality rotation.
7. **Severity Meter Scoring (`steady_ai.severity`)**
   - Blended baseline deviation with 1–5 self-ratings into Mild/Moderate/High tiers framed as *"Compared to your usual"*.
8. **Freeze Index — Experimental (`steady_ai.freeze_index`)**
   - 3–8 Hz to 0.5–3 Hz power ratio (FOG index) flagged explicitly as experimental with safety disclaimers.
9. **Voice Loudness & Non-Motor Check (`steady_ai.voice_nonmotor`)**
   - 3-second sustained-vowel loudness (RMS dBFS) and pitch stability measurement + Pain/Fatigue/Anxiety check-in aggregator.
10. **Research Benchmark Datasets (`steady_ai.datasets`)**
    - High-fidelity generators and loaders for 2025 Gait Assessment, Oxford Voice, and NEMAR PD-EEG datasets.

## Testing & Verification

```bash
# Run isolated AI module test suite (all 10 modules)
python test_steady_ai.py

# Run FastAPI integration endpoint test suite
python test_api.py

# Start FastAPI server on port 8000
uvicorn main:app --reload --port 8000
```
