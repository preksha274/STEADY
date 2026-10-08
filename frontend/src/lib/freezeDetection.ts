"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { logFreezeEpisode } from "./freezeEpisodes";

export const FOG_PROTOTYPE_DISCLAIMER =
  "Automatic freeze detection (prototype) — in production this runs on the Steady Band's wrist IMU; this demo uses your phone's accelerometer to show the same algorithm.";

export const LOCOMOTION_BAND_HZ = [0.5, 3.0] as const;
export const FREEZE_BAND_HZ = [3.0, 8.0] as const;
export const DEFAULT_FREEZE_THRESHOLD = 2.5;

export interface FreezeConfidence {
  score: number; // 0 - 100
  tier: "high" | "medium" | "low";
  reason?: string;
}

export interface FreezeDetectionResult {
  isFreezeDetected: boolean;
  isPreFreezeWarning: boolean;
  freezeIndexTrend: number; // rate of increase per second (e.g. +0.35/sec)
  preFreezeStatus: "none" | "building" | "escalated" | "resolved";
  freezeIndex: number;
  locomotionPower: number;
  freezePower: number;
  confidence: FreezeConfidence;
  isEnabled: boolean;
  isRunning: boolean;
  threshold: number;
  sampleCount: number;
  sampleRateHz: number;
  label: string;
  toggleEnabled: (val?: boolean) => void;
  setThreshold: (val: number) => void;
  requestPermission: () => Promise<boolean>;
  simulateTrendSequence?: (type: "escalating" | "resolving") => void;
}

export interface AccelSample {
  t: number; // Timestamp ms
  z: number; // Vertical acceleration (or magnitude detrended)
}

/**
 * Fast Cooley-Tukey Radix-2 FFT in-place for Float64 arrays.
 */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = re[i];
      re[i] = re[j];
      re[j] = tempR;
      const tempI = im[i];
      im[i] = im[j];
      im[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wR = Math.cos(angle);
    const wI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curR = 1.0;
      let curI = 0.0;
      for (let k = 0; k < half; k++) {
        const pos = i + k;
        const match = pos + half;
        const uR = re[pos];
        const uI = im[pos];
        const vR = re[match] * curR - im[match] * curI;
        const vI = re[match] * curI + im[match] * curR;
        re[pos] = uR + vR;
        im[pos] = uI + vI;
        re[match] = uR - vR;
        im[match] = uI - vI;
        const nextR = curR * wR - curI * wI;
        const nextI = curR * wI + curI * wR;
        curR = nextR;
        curI = nextI;
      }
    }
  }
}

/**
 * Compute next power of 2 for FFT array allocation
 */
function nextPowerOfTwo(n: number): number {
  let count = 1;
  while (count < n) {
    count <<= 1;
  }
  return count;
}

/**
 * Computes Welch Power Spectral Density & Bachlin Freeze Index
 */
export function computeFreezeIndexFromBuffer(
  samples: AccelSample[],
  targetWindowSec: number = 4.0
): {
  freezeIndex: number;
  locomotionPower: number;
  freezePower: number;
  confidence: FreezeConfidence;
  sampleRateHz: number;
} {
  const fallback = {
    freezeIndex: 0,
    locomotionPower: 0,
    freezePower: 0,
    confidence: { score: 0, tier: "low" as const, reason: "Insufficient samples" },
    sampleRateHz: 0,
  };

  if (samples.length < 24) {
    return fallback;
  }

  const durationMs = samples[samples.length - 1].t - samples[0].t;
  if (durationMs < 1000) {
    return fallback;
  }

  const durationSec = durationMs / 1000;
  const sampleRateHz = Math.max(10, Math.min(200, (samples.length - 1) / durationSec));

  // Extract acceleration array
  const rawValues = samples.map((s) => s.z);

  // Mean subtraction (Detrending)
  const meanVal = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
  const detrended = rawValues.map((v) => v - meanVal);

  // Compute Standard Deviation for confidence estimation
  const variance =
    detrended.reduce((acc, v) => acc + v * v, 0) / (detrended.length || 1);
  const stdDev = Math.sqrt(variance);

  // Apply Hanning Window to reduce spectral leakage
  const Nwin = detrended.length;
  const Nfft = Math.max(128, nextPowerOfTwo(Nwin));
  const re = new Float64Array(Nfft);
  const im = new Float64Array(Nfft);

  let winPowerSum = 0;
  for (let i = 0; i < Nwin; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (Nwin - 1)));
    re[i] = detrended[i] * hann;
    im[i] = 0.0;
    winPowerSum += hann * hann;
  }

  // FFT calculation
  fftInPlace(re, im);

  // Compute One-sided Power Spectral Density (PSD)
  const numBins = Math.floor(Nfft / 2);
  const psd = new Float64Array(numBins);
  const freqs = new Float64Array(numBins);

  const df = sampleRateHz / Nfft;
  const normFactor = 2.0 / (sampleRateHz * (winPowerSum || 1));

  for (let k = 0; k < numBins; k++) {
    freqs[k] = k * df;
    const mag2 = re[k] * re[k] + im[k] * im[k];
    psd[k] = mag2 * normFactor;
  }

  // Integrate Power in Locomotion Band (0.5 - 3.0 Hz) and Freeze Band (3.0 - 8.0 Hz)
  let locomotionPower = 0.0;
  let freezePower = 0.0;

  for (let k = 1; k < numBins; k++) {
    const f = freqs[k];
    const prevF = freqs[k - 1];
    const bandWidth = f - prevF;
    const pAvg = (psd[k] + psd[k - 1]) / 2;

    if (f >= LOCOMOTION_BAND_HZ[0] && f <= LOCOMOTION_BAND_HZ[1]) {
      locomotionPower += pAvg * bandWidth;
    }
    if (f >= FREEZE_BAND_HZ[0] && f <= FREEZE_BAND_HZ[1]) {
      freezePower += pAvg * bandWidth;
    }
  }

  locomotionPower = Math.max(1e-6, locomotionPower);
  freezePower = Math.max(1e-6, freezePower);

  const freezeIndex = freezePower / locomotionPower;

  // Confidence Calculation
  let confScore = 85;
  let tier: "high" | "medium" | "low" = "high";

  if (Nwin < 60) {
    confScore -= 25;
    tier = "medium";
  }
  if (stdDev < 0.1) {
    confScore -= 30;
    tier = "low";
  }
  if (sampleRateHz < 20) {
    confScore -= 20;
    if (tier === "high") tier = "medium";
  }

  return {
    freezeIndex: Number(freezeIndex.toFixed(3)),
    locomotionPower: Number(locomotionPower.toFixed(6)),
    freezePower: Number(freezePower.toFixed(6)),
    confidence: {
      score: Math.max(10, Math.min(99, confScore)),
      tier,
      reason: stdDev < 0.1 ? "Device stationary" : undefined,
    },
    sampleRateHz: Number(sampleRateHz.toFixed(1)),
  };
}

/**
 * Storage helpers for explicit Settings toggle
 */
export function getStoredAutoFreezeDetectionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem("steady_auto_freeze_detection");
    if (stored !== null) {
      return stored === "true";
    }
    const legacy = localStorage.getItem("movepilot_auto_freeze_detection");
    if (legacy !== null) {
      return legacy === "true";
    }
  } catch (e) {
    console.error("Failed to read auto freeze detection setting", e);
  }
  return false; // Gated behind explicit user toggle in Settings
}

export function setStoredAutoFreezeDetectionEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("steady_auto_freeze_detection", String(enabled));
    window.dispatchEvent(
      new CustomEvent("steady_auto_freeze_detection_changed", {
        detail: { enabled },
      })
    );
  } catch (e) {
    console.error("Failed to save auto freeze detection setting", e);
  }
}

export interface UseFreezeDetectionOptions {
  activeSession?: boolean; // Force active during gait session
  threshold?: number;
  windowDurationMs?: number; // ~4000ms sliding window
  sustainDurationMs?: number; // ~500-1000ms sustain requirement
  onFreezeDetected?: (info: { freezeIndex: number; confidence: FreezeConfidence }) => void;
  onPreFreezeWarning?: (info: { freezeIndex: number; trendRate: number }) => void;
}

/**
 * React hook: useFreezeDetection()
 * Passive background or active gait session FOG detection with early pre-freeze warning trend analysis
 */
export function useFreezeDetection(
  options: UseFreezeDetectionOptions = {}
): FreezeDetectionResult {
  const {
    activeSession = false,
    threshold: initThreshold = DEFAULT_FREEZE_THRESHOLD,
    windowDurationMs = 4000,
    sustainDurationMs = 700,
    onFreezeDetected,
    onPreFreezeWarning,
  } = options;

  const [isEnabled, setIsEnabled] = useState<boolean>(() =>
    getStoredAutoFreezeDetectionEnabled()
  );
  const [threshold, setThreshold] = useState<number>(initThreshold);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFreezeDetected, setIsFreezeDetected] = useState<boolean>(false);
  const [isPreFreezeWarning, setIsPreFreezeWarning] = useState<boolean>(false);
  const [freezeIndexTrend, setFreezeIndexTrend] = useState<number>(0);
  const [preFreezeStatus, setPreFreezeStatus] = useState<
    "none" | "building" | "escalated" | "resolved"
  >("none");

  const [freezeIndex, setFreezeIndex] = useState<number>(0);
  const [locomotionPower, setLocomotionPower] = useState<number>(0);
  const [freezePower, setFreezePower] = useState<number>(0);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [sampleRateHz, setSampleRateHz] = useState<number>(0);
  const [confidence, setConfidence] = useState<FreezeConfidence>({
    score: 0,
    tier: "low",
  });

  const bufferRef = useRef<AccelSample[]>([]);
  const freezeHistoryRef = useRef<Array<{ t: number; val: number }>>([]);
  const highFreezeStartTimeRef = useRef<number | null>(null);
  const isFreezeRef = useRef<boolean>(false);
  const isPreFreezeWarningRef = useRef<boolean>(false);

  // Sync setting change across tabs / components
  useEffect(() => {
    const handleStorageChange = () => {
      setIsEnabled(getStoredAutoFreezeDetectionEnabled());
    };
    window.addEventListener("steady_auto_freeze_detection_changed", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("steady_auto_freeze_detection_changed", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const toggleEnabled = useCallback((val?: boolean) => {
    const newVal = val !== undefined ? val : !isEnabled;
    setIsEnabled(newVal);
    setStoredAutoFreezeDetectionEnabled(newVal);
  }, [isEnabled]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        return permission === "granted";
      } catch (e) {
        console.error("iOS permission error for freeze detection", e);
        return false;
      }
    }
    return true;
  }, []);

  // Main Motion Capture & Freeze Index Evaluation Loop
  useEffect(() => {
    const shouldRun = isEnabled || activeSession;
    setIsRunning(shouldRun);

    if (!shouldRun || typeof window === "undefined") {
      bufferRef.current = [];
      freezeHistoryRef.current = [];
      setIsFreezeDetected(false);
      setIsPreFreezeWarning(false);
      setPreFreezeStatus("none");
      setFreezeIndex(0);
      setFreezeIndexTrend(0);
      highFreezeStartTimeRef.current = null;
      isPreFreezeWarningRef.current = false;
      isFreezeRef.current = false;
      return;
    }

    const handleMotionEvent = (event: DeviceMotionEvent) => {
      const accel = event.acceleration || event.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      const now = Date.now();
      const rawMag = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
      const netZ = event.acceleration?.z ?? (accel.z !== null ? Math.abs(accel.z) : rawMag - 9.8);

      bufferRef.current.push({ t: now, z: netZ });

      const cutoff = now - windowDurationMs;
      bufferRef.current = bufferRef.current.filter((s) => s.t >= cutoff);
      setSampleCount(bufferRef.current.length);

      if (bufferRef.current.length >= 24) {
        const result = computeFreezeIndexFromBuffer(bufferRef.current, windowDurationMs / 1000);
        setFreezeIndex(result.freezeIndex);
        setLocomotionPower(result.locomotionPower);
        setFreezePower(result.freezePower);
        setConfidence(result.confidence);
        setSampleRateHz(result.sampleRateHz);

        // 1. Track Freeze Index Trend over past 3-4 seconds
        freezeHistoryRef.current.push({ t: now, val: result.freezeIndex });
        const histCutoff = now - 4000;
        freezeHistoryRef.current = freezeHistoryRef.current.filter((h) => h.t >= histCutoff);

        let trendRate = 0;
        if (freezeHistoryRef.current.length >= 3) {
          const oldest = freezeHistoryRef.current[0];
          const newest = freezeHistoryRef.current[freezeHistoryRef.current.length - 1];
          const dtSec = (newest.t - oldest.t) / 1000;
          if (dtSec >= 0.8) {
            trendRate = Number(((newest.val - oldest.val) / dtSec).toFixed(3));
          }
        }
        setFreezeIndexTrend(trendRate);

        // 2. Early Pre-Freeze Warning Threshold Check (approaching threshold 2.5 with rapid upward trend)
        const PRE_FREEZE_MIN_INDEX = 1.6;
        const PRE_FREEZE_MIN_TREND = 0.20; // +0.20 per second rate of increase

        const isApproaching =
          result.freezeIndex >= PRE_FREEZE_MIN_INDEX &&
          result.freezeIndex < threshold &&
          trendRate >= PRE_FREEZE_MIN_TREND;

        if (isApproaching) {
          if (!isPreFreezeWarningRef.current) {
            isPreFreezeWarningRef.current = true;
            setIsPreFreezeWarning(true);
            setPreFreezeStatus("building");

            // Gentle haptic nudge
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try { navigator.vibrate([80, 40, 80]); } catch (e) {}
            }

            // Dispatch pre-warning event for subtle UI banner / notification
            window.dispatchEvent(
              new CustomEvent("steady_pre_freeze_warning", {
                detail: { freezeIndex: result.freezeIndex, trendRate },
              })
            );

            // Log early warning episode
            logFreezeEpisode({
              source: "pre-warning",
              freezeIndex: result.freezeIndex,
              trendRate,
              escalatedToFull: false,
              notes: `Rapid gait degradation trend (+${trendRate}/s) detected prior to full freeze threshold.`,
            });

            if (onPreFreezeWarning) {
              onPreFreezeWarning({ freezeIndex: result.freezeIndex, trendRate });
            }
          }
        }

        // 3. Full Threshold Escalation Check
        if (result.freezeIndex >= threshold) {
          if (highFreezeStartTimeRef.current === null) {
            highFreezeStartTimeRef.current = now;
          } else if (now - highFreezeStartTimeRef.current >= sustainDurationMs) {
            if (!isFreezeRef.current) {
              isFreezeRef.current = true;
              setIsFreezeDetected(true);
              if (isPreFreezeWarningRef.current) {
                setPreFreezeStatus("escalated");
              }
              if (onFreezeDetected) {
                onFreezeDetected({ freezeIndex: result.freezeIndex, confidence: result.confidence });
              }
            }
          }
        } else {
          highFreezeStartTimeRef.current = null;
          if (isFreezeRef.current) {
            isFreezeRef.current = false;
            setIsFreezeDetected(false);
          }
        }

        // 4. Trend Reversal / Normalization (Clears early warning if gait normalizes)
        if (result.freezeIndex < PRE_FREEZE_MIN_INDEX || trendRate <= 0.02) {
          if (isPreFreezeWarningRef.current && result.freezeIndex < threshold) {
            isPreFreezeWarningRef.current = false;
            setIsPreFreezeWarning(false);
            setPreFreezeStatus("resolved");
            window.dispatchEvent(new CustomEvent("steady_pre_freeze_resolved"));
          }
        }
      }
    };

    if ("DeviceMotionEvent" in window) {
      window.addEventListener("devicemotion", handleMotionEvent);
    }

    return () => {
      if ("DeviceMotionEvent" in window) {
        window.removeEventListener("devicemotion", handleMotionEvent);
      }
    };
  }, [
    isEnabled,
    activeSession,
    threshold,
    windowDurationMs,
    sustainDurationMs,
    onFreezeDetected,
    onPreFreezeWarning,
  ]);

  // Demo sequence simulation trigger for live testing
  const simulateTrendSequence = useCallback((type: "escalating" | "resolving") => {
    setIsPreFreezeWarning(true);
    setPreFreezeStatus("building");
    setFreezeIndex(2.15);
    setFreezeIndexTrend(0.42);

    window.dispatchEvent(
      new CustomEvent("steady_pre_freeze_warning", {
        detail: { freezeIndex: 2.15, trendRate: 0.42 },
      })
    );

    logFreezeEpisode({
      source: "pre-warning",
      freezeIndex: 2.15,
      trendRate: 0.42,
      escalatedToFull: type === "escalating",
      notes: type === "escalating"
        ? "Simulated pre-warning that escalated to full freeze."
        : "Simulated pre-warning that resolved naturally.",
    });

    if (type === "escalating") {
      setTimeout(() => {
        setFreezeIndex(2.95);
        setFreezeIndexTrend(0.65);
        setPreFreezeStatus("escalated");
        setIsFreezeDetected(true);
        if (onFreezeDetected) {
          onFreezeDetected({ freezeIndex: 2.95, confidence: { score: 92, tier: "high" } });
        }
      }, 2200);
    } else {
      setTimeout(() => {
        setFreezeIndex(1.10);
        setFreezeIndexTrend(-0.25);
        setPreFreezeStatus("resolved");
        setIsPreFreezeWarning(false);
        window.dispatchEvent(new CustomEvent("steady_pre_freeze_resolved"));
      }, 2500);
    }
  }, [onFreezeDetected]);

  return {
    isFreezeDetected,
    isPreFreezeWarning,
    freezeIndexTrend,
    preFreezeStatus,
    freezeIndex,
    locomotionPower,
    freezePower,
    confidence,
    isEnabled,
    isRunning,
    threshold,
    sampleCount,
    sampleRateHz,
    label: FOG_PROTOTYPE_DISCLAIMER,
    toggleEnabled,
    setThreshold,
    requestPermission,
    simulateTrendSequence,
  };
}
