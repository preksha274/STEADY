# 🎤 STEADY Voice Pacing & Acoustic Sampling Protocol (`voice_protocol.md`)

> **⚠️ IMPORTANT DESIGN & METHODOLOGICAL NOTICE:**  
> **THIS VOICE SAMPLING PROTOCOL IS AN INTERNAL STEADY DESIGN, NOT AN ESTABLISHED CLINICAL STANDARD OR DIAGNOSTIC TEST.**  
>  
> Voice acoustics are analyzed strictly as **within-person longitudinal trends over time**, never as cross-person diagnostic scores or UPDRS motor severity tracking measures.

---

## 1. Standardized Vocal Sampling Protocol

The STEADY Voice Check protocol consists of 2-3 standardized takes:

1. **Sustained Vowel ("Aaah")**:
   - **Duration**: 5.0 seconds per take.
   - **Takes**: 2-3 consecutive takes (the take with optimal SNR is selected for feature extraction).
   - **Target Frequency Range**: Fundamental pitch ($F_0$) extracted between 80 Hz and 350 Hz.

2. **Standardized Short Reading Phrase**:
   - **Phrase**: *"The quick brown fox jumps over the lazy dog."*
   - **Purpose**: Evaluates speech cadence and articulatory loudness stability during connected speech.

---

## 2. On-Screen Patient Positioning & Environment Guidance

Before initiating recording, the application enforces on-screen posture and acoustic environment guidance:

* 📏 **Distance Guidance**: Hold the mobile phone microphone **15–20 cm (6 inches)** directly in front of the mouth.
* 🤫 **Quiet-Room Guidance**: Ensure background noise is minimized (fan/AC turned off, quiet room with background noise $< 35\text{ dB}$).
* 📐 **Microphone Angle**: Hold phone at a 45-degree angle to prevent direct breath pop plosives on the microphone capsule.

---

## 3. Audio Pre-Checks & Quality Rejection Rules

Every recording frame undergoes automated real-time acoustic pre-checks prior to feature calculation:

| Acoustic Pre-Check | Passing Threshold | Failing Action / Label |
| :--- | :---: | :--- |
| **Signal-to-Noise Ratio (SNR)** | $\ge 12.0\text{ dB}$ | Rejected: *"Too noisy, please move to a quieter room"* |
| **Voiced Duration** | $\ge 3.0\text{ seconds}$ | Rejected: *"Too short, please sustain 'aaah' for 5s"* |
| **Microphone Clipping Ratio** | $\le 1.0\%$ clipped samples | Rejected: *"Too loud / Clipped, hold phone slightly further away"* |

---

## 4. Hardware Route Logging & Trend Scoping

Acoustic features (especially Shimmer and Harmonics-to-Noise Ratio) are highly sensitive to microphone hardware characteristics. STEADY enforces strict hardware route logging:

* **Logged Parameters**: Phone hardware model, Operating System, Browser user-agent, Microphone route (`Built-in Mic`, `Wired Headset`, `Bluetooth Mic`), and Ambient noise level ($\text{dB}$).
* **Trend Isolation Policy**: Longitudinal trends are calculated **strictly within the same device model and microphone route**.
* **Device Change Trigger**: If a different microphone or device is detected, the application displays:  
  `"Device changed, trend restarted"`  
  and resets the baseline calculation to prevent hardware-induced false degradation flags.
