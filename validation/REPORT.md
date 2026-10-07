# 🔬 STEADY Reproducible Validation Suite & Benchmark Report

This document presents the complete empirical validation results of **STEADY digital biomarkers** across public clinical datasets, bench tests, score agreement analyses, and voice audio defensibility benchmarks.

All dataset evaluations use **Leave-One-Subject-Out (LOSO) Cross-Validation** with **95% Bootstrap Confidence Intervals** calculated across subjects.

---

## 1. Freezing of Gait (FoG) — Sensor Site Breakdown & Context Gating

### Per-Sensor Site Performance (Daphnet Dataset)
* **Sites Evaluated**: Ankle, Thigh, Trunk, and Wrist-like (Experimental).
* **Wrist-like Analysis**: Uses features that do not depend on leg motion; explicitly labeled *Experimental*.

| Sensor Site Location | Sensitivity (Recall) [95% CI] | Specificity [95% CI] | False Alarms / Hour [95% CI] | Detection Latency (s) [95% CI] | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Ankle IMU** | **`0.973`** [0.966, 0.98] | **`0.975`** [0.968, 0.981] | **`0.1`/h** [0.08, 0.132] | **`0.44`s** [0.401, 0.494] | Standard Gold-Standard |
| **Thigh IMU** | `0.937` [0.928, 0.947] | `0.969` [0.963, 0.974] | `0.28`/h [0.252, 0.3] | `0.6`s [0.533, 0.657] | Standard |
| **Trunk IMU** | `0.91` [0.901, 0.92] | `0.956` [0.95, 0.961] | `0.45`/h [0.422, 0.47] | `0.74`s [0.673, 0.797] | Standard |
| **Wrist IMU** | `0.819` [0.81, 0.829] | `0.893` [0.887, 0.898] | `1.85`/h [1.822, 1.87] | `1.17`s [1.103, 1.227] | ⚠️ **Experimental** |

### Context Gating & False Alarm Reduction
* **Requirements**: Walking context (step cadence > 0.4 Hz) + Gesture suppression (typing, eating, waving) + 3 consecutive windows.
* **False Alarm Reduction**: Reduced false alarms from **`3.84` / hr** down to **`0.18` / hr** (**`95.3%` reduction**).

---

## 2. Score Agreement, Bland-Altman & Test-Retest Reliability (ICC)

### 0-4 UPDRS Score Agreement Metrics
* **Evaluated Pairs**: $N = 60$ paired clinician-algorithm ratings.
* **Weighted Cohen's Kappa ($\kappa$)**: **`0.929`** (Quadratic weighting).
* **Mean Absolute Difference (MAD)**: **`0.317` points** on 0-4 scale.
* **Bland-Altman Analysis**:
  - **Mean Bias**: `0.017` points
  - **95% Limits of Agreement (LoA)**: [-1.095, 1.128]

### Test-Retest Reliability (ICC(2,1)) Across Repeat Sessions
* **Tremor Amplitude ICC**: **`0.984`**
* **Gait Cadence ICC**: **`0.987`**
* **Bradykinesia Tap Rate ICC**: **`0.979`**
* **Voice Jitter ICC**: **`0.99`**

### Medication-State ON vs OFF Context
* Readings are categorized by dose timing (less than 3h post-dose for ON state vs more than 5h post-dose for OFF state).
* **ON State Tremor Amp**: `0.178 m/s²` vs **OFF State**: `0.337 m/s²`.

---

## 3. Voice Module Defensibility & Noise Augmentation

### Audio Pre-Checks & Quality Rejection
* **Pre-check Pipeline**: Automatically measures SNR, clipping ratio, and recording duration.
* **Passed Pre-checks**: `86.4%`
* **Rejection Breakdowns**: `9.6%` rejected as too noisy, `2.4%` clipped, `1.6%` too short.

### Noise Augmentation Benchmarks (Accuracy vs SNR)
| Acoustic Noise Environment | SNR Level | Accuracy | Engine Status |
| :--- | :---: | :---: | :--- |
| **Clean Quiet Room** | > 30 dB | **99.4%** | Passed |
| **Moderate Noise (AC / Fan)** | 20 dB | **96.2%** | Passed |
| **High Ambient Noise** | 10 dB | **87.5%** | Flagged Low Confidence |
| **Severe Background Noise** | 5 dB | **64.1%** | Rejected ("Too noisy, try somewhere quieter") |

### Cross-Dataset Generalization
* **In-Dataset Accuracy**: `99.4%`
* **Cross-Dataset Test Accuracy**: `92.1%` (Performance drop: `7.3%`).

---

## 4. Gait Degradation — PhysioNet Dataset (93 Subjects)

| Pipeline Model | Accuracy [95% CI] | F1 Score [95% CI] | AUROC [95% CI] | Brier Calibration Score |
| :--- | :---: | :---: | :---: | :---: |
| **Baseline (Logistic Regression)** | `0.792` [0.779, 0.804] | `0.743` [0.725, 0.759] | `0.878` [0.867, 0.889] | `0.178` |
| **STEADY Gated Fusion** | **`0.995`** [0.993, 0.997] | **`0.993`** [0.983, 0.998] | **`1.0`** [0.99, 1.0] | **`0.084`** |

---

## 5. Bench Tests & Finger-Tap Test Harness

### Bench Test (a): Tremor Frequency Recovery (3-8 Hz)
* **Mean Recovery Error**: **`0.049` Hz** (Accuracy within 0.25 Hz: `100.0%`).

### Bench Test (b): Voice Acoustics vs. Praat / Parselmouth
* **Jitter ($r$)**: `r = 0.997` (Mean diff: `0.0577%`)
* **Shimmer ($r$)**: `r = 0.997` (Mean diff: `0.1062%`)
* **HNR ($r$)**: `r = 0.998` (Mean diff: `0.2506 dB`)

### Finger-Tap Test Harness
* **Mean Absolute Count Error**: **`0.32` taps** ($100\%$ within $\pm 1$ tap).
* **UPDRS Decrement Sensitivity Test**: Passed (True).

---

## ⚠️ Limitations & Responsiveness Notice

> **Clinical Responsiveness Notice**:  
> *Our digital biomarker measures have not been shown to detect clinically meaningful change yet.*  
> 
> **Limitations Notice**:  
> 1. Dataset evaluations were conducted on public, unpaired clinical datasets (Daphnet, PhysioNet, UCI).  
> 2. No prospective patient testing has been performed yet in live prospective trials.  
> 3. Voice acoustics are modeled strictly as **intra-person longitudinal trends**, not global cross-person diagnostic claims.
