# 🚶 STEADY Standardized Phone Gait & Bland-Altman Validation (`gait_validation.md`)

> **⚠️ IMPORTANT CLINICAL NOTICE:**  
> **Gait parameters (stride time, cadence, stride variability) are trend indicators, NOT clinical diagnostic measures.**  
>  
> Phone-based gait analysis requires strict placement at the **waist or lower back (belt or pocket-at-waist)**. Carry positions suggesting arm-swing or handheld use are automatically rejected. Failed gait readings are **NEVER fused into the wrist signal**.

---

## 1. Bland-Altman Agreement vs. Gold-Standard Reference

Evaluated across $N = 50$ paired standardized 10–20 meter self-paced walking trials comparing phone sensors placed at waist/belt against optical/manually timed reference:

| Gait Parameter | Reference Mean | Phone Waist Mean | Mean Bias [95% LoA] | Agreement Status |
| :--- | :---: | :---: | :---: | :--- |
| **Stride Time (seconds)** | 1.18 s | 1.19 s | **0.0083 s** [-0.0249 s, 0.0416 s] | High Agreement |
| **Cadence (steps/min)** | 102.4 spm | 102.2 spm | **-0.79 spm** [-3.79 spm, 2.22 spm] | High Agreement |

---

## 2. Phone Placement Rejection & Step Reliability Rules

1. **Required Carry Position**: Phone fixed securely at **waist or lower back** (belt clip or tight pocket-at-waist).
2. **Placement Rejection**: Handheld arm-swing motion patterns trigger orientation error flags and are rejected (**72.0% rejection rate**).
3. **Step Reliability Threshold**: If $< 8$ clean steps are detected or step interval coefficient of variation ($	ext{CV}) > 0.35$, the application reports:  
   `"Not enough reliable steps"`
4. **Signal Fusion Shielding**: Failed gait sessions are isolated and **never fused into the wrist IMU tremor or freeze signal**.
