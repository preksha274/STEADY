"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface MotionDataPoint {
  timeSec: number;
  cadence: number;
  sync: number;
}

export interface CueTrialResult {
  bpm: number;
  type: "audio" | "vibration" | "visual";
  meanCadence: number;
  sync: number;
  responseScore: number;
  isSimulated: boolean;
  history: MotionDataPoint[];
}

export interface MotionCaptureState {
  hasSensor: boolean;
  isSimulated: boolean;
  currentCadence: number;
  syncPercent: number;
  detectedSteps: number;
  dataHistory: MotionDataPoint[];
}

const SWEET_SPOT_BPM = 88; // Hidden sweet spot for simulated response

/**
 * Calculates step peaks from accelerometer magnitude
 */
export function processAccelMagnitude(
  mag: number,
  prevMag: number,
  lastStepTimeMs: number,
  nowMs: number,
  threshold: number = 1.2
): boolean {
  if (nowMs - lastStepTimeMs < 250) return false; // Min 250ms interval (240 max BPM)
  return mag > threshold && prevMag <= threshold;
}

/**
 * React hook to capture live movement from DeviceMotionEvent or simulation fallback
 */
export function useMotionCapture(targetBpm: number, isTesting: boolean) {
  const [state, setState] = useState<MotionCaptureState>({
    hasSensor: false,
    isSimulated: false,
    currentCadence: 0,
    syncPercent: 0,
    detectedSteps: 0,
    dataHistory: [],
  });

  const [simulatedMode, setSimulatedMode] = useState<boolean>(false);

  const stepTimestampsRef = useRef<number[]>([]);
  const lastStepTimeRef = useRef<number>(0);
  const prevMagRef = useRef<number>(1.0);
  const motionReceivedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  // Request motion permission (iOS Safari)
  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        return permissionState === "granted";
      } catch (e) {
        console.error("DeviceMotion permission denied", e);
        return false;
      }
    }
    return true; // Non-iOS or permission API not needed
  }, []);

  // Motion Detection Event Listener
  useEffect(() => {
    if (!isTesting || typeof window === "undefined") return;

    startTimeRef.current = Date.now();
    stepTimestampsRef.current = [];
    lastStepTimeRef.current = 0;
    prevMagRef.current = 1.0;
    motionReceivedRef.current = false;

    // Timer to enable simulation if no motion received within 3 seconds
    const timeoutTimer = setTimeout(() => {
      if (!motionReceivedRef.current) {
        setSimulatedMode(true);
      }
    }, 3000);

    const handleMotionEvent = (event: DeviceMotionEvent) => {
      motionReceivedRef.current = true;
      setState((prev) => ({ ...prev, hasSensor: true }));

      const accel = event.acceleration || event.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      const rawMag = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
      // Remove ~9.8m/s^2 gravity if using accelerationIncludingGravity
      const netMag = Math.abs(rawMag - 9.8);
      const now = Date.now();

      const isStep = processAccelMagnitude(netMag, prevMagRef.current, lastStepTimeRef.current, now);
      prevMagRef.current = netMag;

      if (isStep) {
        lastStepTimeRef.current = now;
        stepTimestampsRef.current.push(now);

        // Keep rolling 10 seconds of step timestamps
        const tenSecAgo = now - 10000;
        stepTimestampsRef.current = stepTimestampsRef.current.filter((t) => t >= tenSecAgo);

        // Calculate rolling cadence (steps in 10s * 6)
        const recentCount = stepTimestampsRef.current.length;
        const liveCadence = Math.round(recentCount * 6);

        // Calculate Sync %
        const targetIntervalMs = (60 / targetBpm) * 1000;
        let totalSync = 0;

        if (stepTimestampsRef.current.length >= 2) {
          const timestamps = stepTimestampsRef.current;
          let syncSum = 0;
          for (let i = 1; i < timestamps.length; i++) {
            const interval = timestamps[i] - timestamps[i - 1];
            const err = Math.abs(interval - targetIntervalMs) / targetIntervalMs;
            const stepSync = Math.max(0, 100 - err * 100);
            syncSum += stepSync;
          }
          totalSync = Math.round(syncSum / (timestamps.length - 1));
        }

        const elapsedSec = Math.round((now - startTimeRef.current) / 1000);

        setState((prev) => {
          const newHistory = [
            ...prev.dataHistory,
            { timeSec: elapsedSec, cadence: liveCadence, sync: totalSync },
          ];
          return {
            ...prev,
            currentCadence: liveCadence,
            syncPercent: totalSync,
            detectedSteps: prev.detectedSteps + 1,
            dataHistory: newHistory,
          };
        });
      }
    };

    if ("DeviceMotionEvent" in window) {
      window.addEventListener("devicemotion", handleMotionEvent);
    } else {
      setSimulatedMode(true);
    }

    return () => {
      clearTimeout(timeoutTimer);
      if ("DeviceMotionEvent" in window) {
        window.removeEventListener("devicemotion", handleMotionEvent);
      }
    };
  }, [isTesting, targetBpm]);

  // Simulation Fallback Loop
  useEffect(() => {
    if (!isTesting || !simulatedMode) return;

    const intervalMs = Math.round((60 / targetBpm) * 1000);
    // Add noise based on distance from sweet spot (88 BPM)
    const bpmDistance = Math.abs(targetBpm - SWEET_SPOT_BPM);
    const noiseFactor = Math.min(1.0, bpmDistance / 30); // Higher noise if far from 88 BPM

    const simInterval = setInterval(() => {
      const now = Date.now();
      const elapsedSec = Math.round((now - startTimeRef.current) / 1000);

      // Simulated cadence & sync
      const baseCadence = targetBpm + (Math.random() - 0.5) * 8 * noiseFactor;
      const simCadence = Math.round(Math.max(40, Math.min(140, baseCadence)));

      // Sync percentage: 88-96% near sweet spot, 45-65% far from sweet spot
      const baseSync = Math.max(45, 96 - bpmDistance * 1.8 + (Math.random() - 0.5) * 6);
      const simSync = Math.round(Math.min(98, Math.max(35, baseSync)));

      setState((prev) => {
        const newHistory = [
          ...prev.dataHistory,
          { timeSec: elapsedSec, cadence: simCadence, sync: simSync },
        ];
        return {
          ...prev,
          isSimulated: true,
          currentCadence: simCadence,
          syncPercent: simSync,
          detectedSteps: prev.detectedSteps + 1,
          dataHistory: newHistory,
        };
      });
    }, Math.max(400, intervalMs));

    return () => clearInterval(simInterval);
  }, [isTesting, simulatedMode, targetBpm]);

  return {
    ...state,
    simulatedMode,
    setSimulatedMode,
    requestMotionPermission,
  };
}
