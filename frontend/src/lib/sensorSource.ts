"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { steadyBandAdapter } from "./steadyBandAdapter";

export type SensorSourceType = "band" | "phone" | "replay";

export interface IMUPacket {
  timestamp: number; // ms
  ax: number;
  ay: number;
  az: number;
  gx?: number;
  gy?: number;
  gz?: number;
  source: SensorSourceType;
}

export interface ConnectionHealth {
  status: "healthy" | "degraded" | "disconnected";
  pps: number; // Packets per second
  lastSampleAgeMs: number;
  actualSampleRateHz: number;
  source: SensorSourceType;
  label: string;
}

const SOURCE_STORAGE_KEY = "steady_sensor_source";

export function getStoredSensorSource(): SensorSourceType {
  if (typeof window === "undefined") return "phone";
  try {
    const raw = localStorage.getItem(SOURCE_STORAGE_KEY);
    if (raw === "band" || raw === "phone" || raw === "replay") return raw;
  } catch (e) {}
  return "phone";
}

export function setStoredSensorSource(source: SensorSourceType): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
    window.dispatchEvent(new CustomEvent("steady-sensor-source-changed", { detail: source }));
  } catch (e) {}
}

/**
 * Global Sensor Source Manager & Event Emitter
 */
class SensorSourceManager {
  private activeSource: SensorSourceType = "phone";
  private packetListeners: Set<(packet: IMUPacket) => void> = new Set();
  private healthListeners: Set<(health: ConnectionHealth) => void> = new Set();

  private ppsCounter: number = 0;
  private currentPps: number = 50;
  private lastTimestamp: number = Date.now();
  private lastDeltaTimes: number[] = [];
  private ppsTimer: any = null;
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private replayTimer: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.activeSource = getStoredSensorSource();
    }
  }

  public getSource(): SensorSourceType {
    return this.activeSource;
  }

  public setSource(source: SensorSourceType): void {
    this.stopCurrentStream();
    this.activeSource = source;
    setStoredSensorSource(source);
    this.startCurrentStream();
    this.notifyHealth();
  }

  public onPacket(callback: (packet: IMUPacket) => void): () => void {
    this.packetListeners.add(callback);
    return () => this.packetListeners.delete(callback);
  }

  public onHealth(callback: (health: ConnectionHealth) => void): () => void {
    this.healthListeners.add(callback);
    return () => this.healthListeners.delete(callback);
  }

  public async requestPhonePermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        return permission === "granted";
      } catch (e) {
        console.error("iOS DeviceMotion permission error", e);
        return false;
      }
    }
    return true; // Granted by default on non-iOS or standard browsers
  }

  private stopCurrentStream(): void {
    if (this.motionHandler && typeof window !== "undefined") {
      window.removeEventListener("devicemotion", this.motionHandler);
      this.motionHandler = null;
    }
    if (this.replayTimer) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
    if (this.ppsTimer) {
      clearInterval(this.ppsTimer);
      this.ppsTimer = null;
    }
  }

  public startCurrentStream(): void {
    this.stopCurrentStream();
    this.ppsCounter = 0;
    this.lastTimestamp = Date.now();
    this.lastDeltaTimes = [];

    // PPS monitoring timer every 1s
    this.ppsTimer = setInterval(() => {
      this.currentPps = this.ppsCounter;
      this.ppsCounter = 0;
      this.notifyHealth();
    }, 1000);

    if (this.activeSource === "phone") {
      this.startPhoneStream();
    } else if (this.activeSource === "replay") {
      this.startReplayStream();
    } else {
      this.startBandStream();
    }
  }

  private startPhoneStream(): void {
    if (typeof window === "undefined") return;

    this.motionHandler = (e: DeviceMotionEvent) => {
      const now = Date.now();
      const dt = now - this.lastTimestamp;
      if (dt > 0) {
        this.lastDeltaTimes.push(dt);
        if (this.lastDeltaTimes.length > 20) this.lastDeltaTimes.shift();
      }
      this.lastTimestamp = now;
      this.ppsCounter++;

      const acc = e.accelerationIncludingGravity || e.acceleration;
      const rot = e.rotationRate;

      const packet: IMUPacket = {
        timestamp: now,
        ax: acc?.x || 0,
        ay: acc?.y || 0,
        az: acc?.z || 9.81,
        gx: rot?.alpha || 0,
        gy: rot?.beta || 0,
        gz: rot?.gamma || 0,
        source: "phone",
      };

      this.emitPacket(packet);
    };

    window.addEventListener("devicemotion", this.motionHandler, { passive: true });
  }

  private startReplayStream(): void {
    let step = 0;
    const sampleRate = 50; // 50 Hz replay rate
    const intervalMs = 1000 / sampleRate;

    this.replayTimer = setInterval(() => {
      const now = Date.now();
      step++;
      const t = step / sampleRate;

      // Simulated 4.8 Hz tremor sinusoid replay dataset
      const ax = 0.2 * Math.sin(2 * Math.PI * 4.8 * t) + (Math.random() - 0.5) * 0.05;
      const ay = 0.2 * Math.cos(2 * Math.PI * 4.8 * t) + (Math.random() - 0.5) * 0.05;
      const az = 9.81 + 0.1 * Math.sin(2 * Math.PI * 4.8 * t);

      const packet: IMUPacket = {
        timestamp: now,
        ax,
        ay,
        az,
        gx: 0.1 * Math.sin(2 * Math.PI * 4.8 * t),
        gy: 0.1 * Math.cos(2 * Math.PI * 4.8 * t),
        gz: 0.05,
        source: "replay",
      };

      this.ppsCounter++;
      this.lastTimestamp = now;
      this.emitPacket(packet);
    }, intervalMs);
  }

  private startBandStream(): void {
    if (typeof window === "undefined") return;

    // Connect packet listener from steadyBandAdapter
    steadyBandAdapter.onPacket((packet) => {
      if (this.activeSource === "band") {
        this.lastTimestamp = Date.now();
        this.ppsCounter++;
        this.emitPacket(packet);
      }
    });

    if (!steadyBandAdapter.getIsConnected()) {
      steadyBandAdapter.startMockBand();
    }
  }

  private emitPacket(packet: IMUPacket): void {
    this.packetListeners.forEach((listener) => listener(packet));
  }

  private notifyHealth(): void {
    const age = Math.max(0, Date.now() - this.lastTimestamp);
    let statusVal: "healthy" | "degraded" | "disconnected" = "healthy";

    if (age > 3000 || (this.currentPps === 0 && this.activeSource !== "band")) {
      statusVal = "disconnected";
    } else if (age > 500) {
      statusVal = "degraded";
    }

    let actualHz = 50;
    if (this.activeSource === "band") {
      const telem = steadyBandAdapter.getTelemetry();
      actualHz = telem.estimatedSampleRateHz || 100;
    } else {
      const meanDt =
        this.lastDeltaTimes.length > 0
          ? this.lastDeltaTimes.reduce((a, b) => a + b, 0) / this.lastDeltaTimes.length
          : 20;
      actualHz = meanDt > 0 ? Math.round(1000 / meanDt) : 50;
    }

    const labelMap: Record<SensorSourceType, string> = {
      band: "Live: band",
      phone: "Live: phone",
      replay: "Replay",
    };

    const health: ConnectionHealth = {
      status: statusVal,
      pps: this.activeSource === "band" ? steadyBandAdapter.getTelemetry().pps : this.currentPps,
      lastSampleAgeMs: age,
      actualSampleRateHz: actualHz,
      source: this.activeSource,
      label: labelMap[this.activeSource],
    };

    this.healthListeners.forEach((listener) => listener(health));
  }
}

export const sensorSourceManager = new SensorSourceManager();

/**
 * React Hook for consuming unified Sensor Source in components
 */
export function useSensorSource() {
  const [source, setSourceState] = useState<SensorSourceType>(() => getStoredSensorSource());
  const [health, setHealth] = useState<ConnectionHealth>({
    status: "healthy",
    pps: 50,
    lastSampleAgeMs: 10,
    actualSampleRateHz: 50,
    source: getStoredSensorSource(),
    label: getStoredSensorSource() === "band" ? "Live: band" : getStoredSensorSource() === "phone" ? "Live: phone" : "Replay",
  });

  useEffect(() => {
    sensorSourceManager.startCurrentStream();

    const unsubHealth = sensorSourceManager.onHealth((h) => {
      setHealth(h);
    });

    const handleSourceChanged = (e: any) => {
      const newSource = e.detail as SensorSourceType;
      setSourceState(newSource);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("steady-sensor-source-changed", handleSourceChanged);
    }

    return () => {
      unsubHealth();
      if (typeof window !== "undefined") {
        window.removeEventListener("steady-sensor-source-changed", handleSourceChanged);
      }
    };
  }, []);

  const changeSource = useCallback((newSource: SensorSourceType) => {
    sensorSourceManager.setSource(newSource);
    setSourceState(newSource);
  }, []);

  const requestPermission = useCallback(() => {
    return sensorSourceManager.requestPhonePermission();
  }, []);

  return {
    source,
    health,
    changeSource,
    requestPermission,
  };
}

/**
 * Check if Web Vibration API is supported on device
 */
export function checkVibrationSupport(): { isSupported: boolean; message?: string } {
  if (typeof window === "undefined") return { isSupported: false, message: "Server environment" };

  const supported = "navigator" in window && "vibrate" in navigator;
  if (!supported) {
    return {
      isSupported: false,
      message: "Vibration unsupported on this device/browser (iOS Safari or desktop). Playing Web Audio tone beat fallback.",
    };
  }
  return { isSupported: true };
}
