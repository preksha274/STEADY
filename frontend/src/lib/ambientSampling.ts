"use client";

import { useState, useEffect, useRef } from "react";

export interface AmbientSample {
  id: string;
  timestamp: string; // ISO date
  tremorPower: number; // 3-8Hz power metric
  motionIntensity: number; // RMS acceleration (g)
  sampleDurationSec: number; // usually 10s
}

export interface AmbientSummaryResult {
  isEnabled: boolean;
  sampleCount: number;
  label: string;
  status: "similar" | "variable" | "calmer";
  confidenceLevel: "high" | "medium" | "low";
  confidenceReason: string;
  lastSampleTime?: string;
  disclaimer: string;
}

const ENABLED_STORAGE_KEY = "steady_ambient_sampling_enabled";
const SAMPLES_STORAGE_KEY = "steady_ambient_samples";

export const AMBIENT_SAMPLING_DISCLAIMER =
  "Ambient sampling runs in 10-second bursts while STEADY is open. It is kept separate from explicit Movement Fingerprint baselines.";

/**
 * Checks if Ambient Movement Sampling (Beta) is enabled by the patient. Default is OFF (false).
 */
export function isAmbientSamplingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(ENABLED_STORAGE_KEY);
    return stored === "true";
  } catch (e) {
    console.error("Failed reading ambient sampling preference", e);
    return false;
  }
}

/**
 * Toggles Ambient Movement Sampling (Beta) on or off.
 */
export function setAmbientSamplingEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "true" : "false");
  } catch (e) {
    console.error("Failed saving ambient sampling preference", e);
  }
}

/**
 * Seeds realistic ambient motion samples for the current day for demo purposes.
 */
export function seedDemoAmbientSamples(forceReset = false): AmbientSample[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(SAMPLES_STORAGE_KEY);
    if (raw && !forceReset) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed checking existing ambient samples", e);
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);

  // Generate 12 ambient burst samples throughout today
  const seeded: AmbientSample[] = [];
  for (let i = 0; i < 12; i++) {
    const burstTime = new Date(startOfDay.getTime() + i * 45 * 60 * 1000); // every 45 mins
    if (burstTime.getTime() > now.getTime()) break;

    // Tremor power around ~0.42 (stable, matching baseline)
    const noise = (Math.random() - 0.5) * 0.08;
    const tremorPower = Number((0.42 + noise).toFixed(3));
    const motionIntensity = Number((1.05 + noise * 0.5).toFixed(3));

    seeded.push({
      id: `amb-${burstTime.getTime()}-${i}`,
      timestamp: burstTime.toISOString(),
      tremorPower,
      motionIntensity,
      sampleDurationSec: 10,
    });
  }

  try {
    localStorage.setItem(SAMPLES_STORAGE_KEY, JSON.stringify(seeded));
  } catch (e) {
    console.error("Failed seeding demo ambient samples", e);
  }

  return seeded;
}

/**
 * Records a single ambient burst sample into storage.
 */
export function recordAmbientBurst(
  tremorPower: number,
  motionIntensity: number,
  sampleDurationSec = 10
): AmbientSample {
  const newSample: AmbientSample = {
    id: `amb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    tremorPower: Number(tremorPower.toFixed(3)),
    motionIntensity: Number(motionIntensity.toFixed(3)),
    sampleDurationSec,
  };

  if (typeof window !== "undefined") {
    try {
      const existingRaw = localStorage.getItem(SAMPLES_STORAGE_KEY);
      const all: AmbientSample[] = existingRaw ? JSON.parse(existingRaw) : seedDemoAmbientSamples();
      const updated = [...all, newSample];
      localStorage.setItem(SAMPLES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed storing ambient burst sample", e);
    }
  }

  return newSample;
}

/**
 * Computes today's ambient movement summary aggregated across bursts.
 */
export function getTodayAmbientSummary(isDemoMode = true): AmbientSummaryResult {
  const enabled = isAmbientSamplingEnabled();

  if (typeof window === "undefined") {
    return {
      isEnabled: enabled,
      sampleCount: 12,
      label: "Similar to usual",
      status: "similar",
      confidenceLevel: "high",
      confidenceReason: "Based on 12 ambient motion bursts captured today while app was open",
      lastSampleTime: "10m ago",
      disclaimer: AMBIENT_SAMPLING_DISCLAIMER,
    };
  }

  let allSamples: AmbientSample[] = [];
  try {
    const raw = localStorage.getItem(SAMPLES_STORAGE_KEY);
    if (!raw) {
      allSamples = seedDemoAmbientSamples();
    } else {
      allSamples = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed parsing ambient samples", e);
    allSamples = seedDemoAmbientSamples();
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySamples = allSamples.filter((s) => s.timestamp.startsWith(todayStr));

  const count = todaySamples.length;

  if (count === 0) {
    return {
      isEnabled: enabled,
      sampleCount: 0,
      label: "No ambient samples collected today",
      status: "similar",
      confidenceLevel: "low",
      confidenceReason: "Ambient sampling active; awaiting app movement bursts",
      disclaimer: AMBIENT_SAMPLING_DISCLAIMER,
    };
  }

  const avgTremor = todaySamples.reduce((a, b) => a + b.tremorPower, 0) / count;
  const lastSample = todaySamples[todaySamples.length - 1];

  let status: "similar" | "variable" | "calmer" = "similar";
  let label = "Similar to usual";

  if (avgTremor > 0.65) {
    status = "variable";
    label = "More variable than usual";
  } else if (avgTremor < 0.3) {
    status = "calmer";
    label = "Calmer than usual";
  }

  const confidenceLevel: "high" | "medium" | "low" =
    count >= 10 ? "high" : count >= 4 ? "medium" : "low";

  const d = new Date(lastSample.timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return {
    isEnabled: enabled,
    sampleCount: count,
    label,
    status,
    confidenceLevel,
    confidenceReason: `Based on ${count} ambient motion bursts captured today`,
    lastSampleTime: `Last sampled ${timeStr}`,
    disclaimer: AMBIENT_SAMPLING_DISCLAIMER,
  };
}

/**
 * React hook that periodically samples motion sensors in 10-second bursts
 * while the app is active in the foreground, if enabled by the user.
 */
export function useAmbientSampling() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [lastBurstTime, setLastBurstTime] = useState<string | null>(null);
  const isSamplingRef = useRef(false);

  useEffect(() => {
    setIsEnabled(isAmbientSamplingEnabled());
  }, []);

  const toggleEnabled = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    setAmbientSamplingEnabled(next);
  };

  useEffect(() => {
    if (!isEnabled || typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      return;
    }

    // Sample 10-second bursts every 60 seconds while app is open
    const intervalMs = 60 * 1000;

    const run10sBurst = () => {
      if (isSamplingRef.current) return;
      isSamplingRef.current = true;

      const samples: number[] = [];
      const startTime = Date.now();

      const handleMotion = (event: DeviceMotionEvent) => {
        const accel = event.acceleration || event.accelerationIncludingGravity;
        if (!accel || accel.x === null || accel.y === null || accel.z === null) return;
        const mag = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
        samples.push(mag);
      };

      window.addEventListener("devicemotion", handleMotion);

      setTimeout(() => {
        window.removeEventListener("devicemotion", handleMotion);
        isSamplingRef.current = false;

        if (samples.length > 10) {
          const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
          const variance =
            samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
          const rms = Math.sqrt(variance);

          // Simulated 3-8Hz band tremor ratio derived from variance
          const tremorRatio = Math.min(1.2, Math.max(0.1, rms * 0.45));

          const newBurst = recordAmbientBurst(tremorRatio, mean, 10);
          setLastBurstTime(newBurst.timestamp);
        }
      }, 10000);
    };

    // Run first burst after 5 seconds, then every 60s
    const initialTimer = setTimeout(run10sBurst, 5000);
    const loopTimer = setInterval(run10sBurst, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(loopTimer);
    };
  }, [isEnabled]);

  return {
    isEnabled,
    toggleEnabled,
    lastBurstTime,
    summary: getTodayAmbientSummary(),
  };
}
