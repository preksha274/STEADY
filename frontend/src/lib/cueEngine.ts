"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

  public vibrationSupported: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.vibrationSupported = "navigator" in window && "vibrate" in navigator;
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
   * Start the cue engine at specified type and BPM
   */
  public start(type: CueType = "audio", bpm: number = 80): void {
    if (typeof window === "undefined") return;

    this.stop(); // Stop any running instance first

    this.cueType = type;
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
      this.audioCtx.resume();
    }

    this.nextNoteTime = this.audioCtx ? this.audioCtx.currentTime : 0;

    // Start lookahead scheduler (~25ms interval)
    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, 25);
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

    // 1. Audio Beat Scheduling (Web Audio API)
    if (this.cueType === "audio" && this.audioCtx) {
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // First beat of 4 is higher pitch (1175 Hz vs 880 Hz)
        osc.frequency.setValueAtTime(isFirstBeat ? 1175 : 880, time);

        // Envelope: 50ms beep with quick exponential gain decay (scaled by volumeScale for ducking)
        const peakGain = 0.5 * this.volumeScale;
        gain.gain.setValueAtTime(peakGain, time);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.001 * this.volumeScale), time + 0.05);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(time);
        osc.stop(time + 0.05);
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

      // Vibration: navigator.vibrate(60) if supported
      if (
        (this.cueType === "vibration" || this.cueType === "audio") &&
        this.vibrationSupported
      ) {
        try {
          navigator.vibrate(60);
        } catch (e) {
          // Fallback silently if vibration fails
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
