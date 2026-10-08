"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSessions } from "./sessions";
import { steadyBandAdapter } from "./steadyBandAdapter";
import { sensorSourceManager } from "./sensorSource";

export type CueType = "audio" | "vibration" | "visual";

export type BeatCallback = (beatCount: number, beatInBar: number) => void;

export class CueEngine {
  private audioCtx: AudioContext | null = null;
  private isPlayingState: boolean = false;
  private bpm: number = 80;
  private cueType: CueType = "audio";
  private currentBeat: number = 0;
  private nextNoteTime: number = 0;
  private timerId: number | null = null;
  private timeoutIds: number[] = [];
  private callbacks: Set<BeatCallback> = new Set();

  private lastCueTimestamp: number = 0;
  private cueTimestampsWindow: number[] = [];
  private consecutiveCancelCount: number = 0;
  private isAutoPausedState: boolean = false;
  private autoPauseReason: string | null = null;
  private walkingNotice: string | null = null;

  public vibrationSupported: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.vibrationSupported = "navigator" in window && "vibrate" in navigator;

      // Unlock AudioContext on any user interaction gesture to comply with browser autoplay policies
      const unlock = () => {
        if (!this.audioCtx) {
          const AudioCtxClass =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            this.audioCtx = new AudioCtxClass();
          }
        }
        if (this.audioCtx && this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {});
        }
      };

      window.addEventListener("click", unlock, { passive: true });
      window.addEventListener("touchstart", unlock, { passive: true });
      window.addEventListener("pointerdown", unlock, { passive: true });
    }
  }

  /**
   * Register a beat callback listener
   */
  public onBeat(callback: BeatCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Check if Freeze Assist is auto-paused due to repeated cancels
   */
  public isAutoPaused(): boolean {
    return this.isAutoPausedState;
  }

  public getAutoPauseReason(): string | null {
    return this.autoPauseReason;
  }

  public resetAutoPause(): void {
    this.isAutoPausedState = false;
    this.autoPauseReason = null;
    this.consecutiveCancelCount = 0;
  }

  public getWalkingNotice(): string | null {
    return this.walkingNotice;
  }

  /**
   * Handle user cancel action (tracked for storm protection & sensitivity adjustment prompt)
   */
  public handleCancel(): void {
    this.stop();
    this.consecutiveCancelCount++;
    if (this.consecutiveCancelCount >= 3) {
      this.isAutoPausedState = true;
      this.autoPauseReason = "Freeze Assist paused: want to adjust sensitivity?";
    }
  }

  /**
   * Start the cue engine at specified type and BPM
   */
  public start(type: CueType = "audio", bpm: number = 80, isWalking: boolean = false): { success: boolean; notice?: string } {
    if (typeof window === "undefined") return { success: false };

    // 1. Auto-pause check
    if (this.isAutoPausedState) {
      return {
        success: false,
        notice: "Freeze Assist paused: want to adjust sensitivity?",
      };
    }

    // 2. Cue Storm Protection: 30s Cooldown & Max 2 cues per 5 min window
    const now = Date.now();
    if (now - this.lastCueTimestamp < 30000) {
      return {
        success: false,
        notice: "Cue storm protection: minimum 30s cooldown between cues active.",
      };
    }

    this.cueTimestampsWindow = this.cueTimestampsWindow.filter((t: number) => now - t < 300000);
    if (this.cueTimestampsWindow.length >= 2) {
      return {
        success: false,
        notice: "Cue storm protection: max 2 cues per 5-minute window reached.",
      };
    }

    this.lastCueTimestamp = now;
    this.cueTimestampsWindow.push(now);

    this.stop(); // Stop any running instance first

    // 3. Disable visual cues while walking
    if (isWalking && type === "visual") {
      this.cueType = this.vibrationSupported ? "vibration" : "audio";
      this.walkingNotice = "Visual cues disabled while walking for safety; defaulting to audio/haptic.";
    } else {
      this.cueType = type;
      this.walkingNotice = null;
    }

    this.bpm = Math.max(30, Math.min(240, bpm));
    this.isPlayingState = true;
    this.currentBeat = 0;

    // Initialize AudioContext lazily on user action
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    this.nextNoteTime = this.audioCtx ? this.audioCtx.currentTime : 0;

    // Start lookahead scheduler (~25ms interval)
    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, 25);

    return {
      success: true,
      notice: this.walkingNotice || undefined,
    };
  }

  /**
   * Stop the cue engine and clear all scheduled beats
   */
  public stop(): void {
    this.isPlayingState = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.timeoutIds.forEach((id) => clearTimeout(id));
    this.timeoutIds = [];
  }

  /**
   * Update BPM dynamically while playing
   */
  public setBpm(newBpm: number): void {
    this.bpm = Math.max(30, Math.min(240, newBpm));
  }

  /**
   * Check if engine is currently running
   */
  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  /**
   * Get current BPM
   */
  public getBpm(): number {
    return this.bpm;
  }

  /**
   * Get current CueType
   */
  public getType(): CueType {
    return this.cueType;
  }

  /**
   * Web Audio Lookahead Scheduler
   */
  private scheduler(): void {
    if (!this.isPlayingState) return;

    const scheduleAheadTime = 0.1; // 100ms lookahead
    const currentTime = this.audioCtx ? this.audioCtx.currentTime : 0;

    while (this.nextNoteTime < currentTime + scheduleAheadTime) {
      this.scheduleBeat(this.currentBeat, this.nextNoteTime);
      const secondsPerBeat = 60.0 / this.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentBeat++;
    }
  }

  private volumeScale: number = 1.0;
  private duckTimerId: number | null = null;

  public duck(durationMs: number = 1800): void {
    this.volumeScale = 0.25;
    if (this.duckTimerId !== null) {
      clearTimeout(this.duckTimerId);
    }
    this.duckTimerId = window.setTimeout(() => {
      this.volumeScale = 1.0;
      this.duckTimerId = null;
    }, durationMs);
  }

  /**
   * Schedule a beat sound and dispatch UI/vibration callbacks
   */
  private scheduleBeat(beatNum: number, time: number): void {
    const isFirstBeat = beatNum % 4 === 0;

    // Ensure AudioContext is instantiated and resumed
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    // 1. Audio Beat Scheduling (Web Audio API)
    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const startTime = Math.max(now, time);

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // First beat of 4 is higher pitch (1175 Hz vs 880 Hz)
        osc.frequency.setValueAtTime(isFirstBeat ? 1175 : 880, startTime);

        // Envelope: 50ms beep with linear decay (safe & immune to exponential ramp zero errors)
        const safeVolumeScale = Math.max(0.1, this.volumeScale);
        const peakGain = 0.5 * safeVolumeScale;

        gain.gain.setValueAtTime(peakGain, startTime);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + 0.05);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.05);
      } catch (e) {
        console.error("Audio scheduling error", e);
      }
    }

    // 2. Synchronized callback for UI/Vibration (calculated in ms delay from now)
    const delayMs = Math.max(
      0,
      (time - (this.audioCtx ? this.audioCtx.currentTime : 0)) * 1000
    );

    const timeoutId = window.setTimeout(() => {
      const beatInBar = (beatNum % 4) + 1;
      const activeSource = sensorSourceManager.getSource();

      // Vibration cueing: route to Steady Band motor if active, else phone vibrate, else audio tone
      if (this.cueType === "vibration" || this.cueType === "audio") {
        if (activeSource === "band" && steadyBandAdapter.getIsConnected()) {
          steadyBandAdapter.sendHapticCommand({
            intensity: "high",
            duration_ms: 80,
            pattern: "metronome",
          });
        } else if (this.vibrationSupported) {
          try {
            navigator.vibrate(60);
          } catch (e) {
            // Fallback silently if phone vibration fails
          }
        }
      }

      // Notify all registered React callbacks
      this.callbacks.forEach((cb) => cb(beatNum + 1, beatInBar));
    }, delayMs);

    this.timeoutIds.push(timeoutId);
  }
}

// Global Singleton CueEngine Instance
let globalCueEngineInstance: CueEngine | null = null;

export function getGlobalCueEngine(): CueEngine {
  if (typeof window === "undefined") {
    return new CueEngine();
  }
  if (!globalCueEngineInstance) {
    globalCueEngineInstance = new CueEngine();
  }
  return globalCueEngineInstance;
}

/**
 * Custom React Hook for CueEngine
 */
export function useCueEngine() {
  const engineRef = useRef<CueEngine | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpmState] = useState<number>(80);
  const [cueType, setCueTypeState] = useState<CueType>("audio");
  const [beatCount, setBeatCount] = useState<number>(0);
  const [beatInBar, setBeatInBar] = useState<number>(1);
  const [vibrationSupported, setVibrationSupported] = useState<boolean>(false);

  useEffect(() => {
    const engine = getGlobalCueEngine();
    engineRef.current = engine;
    setVibrationSupported(engine.vibrationSupported);

    const unsubscribe = engine.onBeat((count, inBar) => {
      setBeatCount(count);
      setBeatInBar(inBar);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const start = useCallback((type: CueType = "audio", newBpm: number = 80) => {
    if (engineRef.current) {
      setCueTypeState(type);
      setBpmState(newBpm);
      setBeatCount(0);
      setBeatInBar(1);
      engineRef.current.start(type, newBpm);
      setIsPlaying(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setIsPlaying(false);
    }
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    setBpmState(newBpm);
    if (engineRef.current) {
      engineRef.current.setBpm(newBpm);
    }
  }, []);

  const duck = useCallback((durationMs: number = 1800) => {
    if (engineRef.current) {
      engineRef.current.duck(durationMs);
    }
  }, []);

  return {
    isPlaying,
    bpm,
    cueType,
    beatCount,
    beatInBar,
    vibrationSupported,
    start,
    stop,
    setBpm,
    duck,
  };
}

export interface CueTestRange {
  tempos: number[];
  isPersonalized: boolean;
  cadence: number | null;
  note?: string;
}

/**
 * Derives the 5-step Cue Lab tempo test range.
 * If recent gait data exists (from Movement Fingerprint / MirrorMotion or sessions),
 * centers the range on the patient's cadence (±15% in 5 steps).
 * Otherwise falls back to the fixed 80-100 BPM starting range.
 */
export function getCueTestRange(isDemoMode: boolean = true): CueTestRange {
  const fallbackNote =
    "Using a general starting range — this gets personalized once you've recorded a walking session.";

  if (typeof window === "undefined") {
    return {
      tempos: [80, 85, 90, 95, 100],
      isPersonalized: false,
      cadence: null,
      note: fallbackNote,
    };
  }

  let latestCadence: number | null = null;

  // 1. Check gait result stored from MirrorMotion video analysis / Movement Fingerprint
  try {
    const rawGait =
      localStorage.getItem("steady_gait_result") ||
      localStorage.getItem("movepilot_gait_result");
    if (rawGait) {
      const parsed = JSON.parse(rawGait);
      if (
        parsed?.metrics?.cadence_steps_per_min &&
        typeof parsed.metrics.cadence_steps_per_min === "number" &&
        parsed.metrics.cadence_steps_per_min > 0
      ) {
        latestCadence = Math.round(parsed.metrics.cadence_steps_per_min);
      }
    }
  } catch (e) {
    console.error("Failed to parse gait result for Cue Lab range", e);
  }

  // 2. Fall back to latest session with gait cadence if not in gait result
  if (!latestCadence) {
    try {
      const sessions = getSessions(isDemoMode);
      const gaitSessions = sessions.filter(
        (s) => s.gait && typeof s.gait.cadence === "number" && s.gait.cadence > 0
      );
      if (gaitSessions.length > 0) {
        const lastSession = gaitSessions[gaitSessions.length - 1];
        latestCadence = Math.round(lastSession.gait!.cadence);
      }
    } catch (e) {
      console.error("Failed to read sessions for Cue Lab range", e);
    }
  }

  if (latestCadence && latestCadence > 0) {
    const c = latestCadence;
    // 5-tempo test range centered on cadence ±15%
    const rawTempos = [
      Math.round(c * 0.85),
      Math.round(c * 0.925),
      c,
      Math.round(c * 1.075),
      Math.round(c * 1.15),
    ];
    // Ensure bounds and strictly ascending steps
    const tempos = rawTempos.map((t) => Math.max(30, Math.min(240, t)));
    for (let i = 1; i < tempos.length; i++) {
      if (tempos[i] <= tempos[i - 1]) {
        tempos[i] = tempos[i - 1] + 1;
      }
    }

    return {
      tempos,
      isPersonalized: true,
      cadence: c,
    };
  }

  return {
    tempos: [80, 85, 90, 95, 100],
    isPersonalized: false,
    cadence: null,
    note: fallbackNote,
  };
}

export const CLOSED_LOOP_CITATION =
  "Our cue engine continuously adapts to your response in real time, rather than testing a fixed list of tempos — consistent with closed-loop cueing approaches shown to outperform static cueing in published gait rehabilitation research.";

export function getCueInitialTempo(isDemoMode: boolean = true): {
  initialBpm: number;
  isPersonalized: boolean;
  cadence: number | null;
  note?: string;
} {
  const fallbackNote =
    "Starting adaptive search near default ~115 BPM (range 80–155 BPM). Personalizes further as gait data is collected.";

  if (typeof window === "undefined") {
    return {
      initialBpm: 115,
      isPersonalized: false,
      cadence: null,
      note: fallbackNote,
    };
  }

  let latestCadence: number | null = null;
  try {
    const rawGait =
      localStorage.getItem("steady_gait_result") ||
      localStorage.getItem("movepilot_gait_result");
    if (rawGait) {
      const parsed = JSON.parse(rawGait);
      if (
        parsed?.metrics?.cadence_steps_per_min &&
        typeof parsed.metrics.cadence_steps_per_min === "number" &&
        parsed.metrics.cadence_steps_per_min > 0
      ) {
        latestCadence = Math.round(parsed.metrics.cadence_steps_per_min);
      }
    }
  } catch (e) {
    console.error("Failed to parse gait result", e);
  }

  if (!latestCadence) {
    try {
      const sessions = getSessions(isDemoMode);
      const gaitSessions = sessions.filter(
        (s) => s.gait && typeof s.gait.cadence === "number" && s.gait.cadence > 0
      );
      if (gaitSessions.length > 0) {
        latestCadence = Math.round(gaitSessions[gaitSessions.length - 1].gait!.cadence);
      }
    } catch (e) {
      console.error("Failed to read sessions for initial tempo", e);
    }
  }

  if (latestCadence && latestCadence > 0) {
    const clamped = Math.max(80, Math.min(155, latestCadence));
    return {
      initialBpm: clamped,
      isPersonalized: true,
      cadence: latestCadence,
    };
  }

  return {
    initialBpm: 115,
    isPersonalized: false,
    cadence: null,
    note: fallbackNote,
  };
}

