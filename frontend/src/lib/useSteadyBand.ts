"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getWebSerialManager,
  WebSerialManager,
  SteadyBandSample,
  ConnectionHealth,
  SerialState,
  SteadyBandHello,
  STEADY_BAND_BAUD_RATE,
} from "./webSerial";
import { useWearableStatus } from "@/hooks/useWearableStatus";

export type BandSourceMode = "backend" | "serial";

export interface LiveMetrics {
  live: boolean;
  tremor_amplitude: number | string;
  dominant_freq_hz: number | string;
  tremor_detected: boolean;
  percent_time_in_tremor: number;
  today_percent_time_in_tremor: number;
  baseline_amplitude: number;
  baseline_deviation_pct: number;
  confidence_tier: "high" | "medium" | "low";
  confidence_reason: string;
  not_assessed_pct: number;
  drops_count: number;
  dropout_gaps_count: number;
  effective_sample_rate_hz: number;
  reliable_data: boolean;
  state: number;
  state_label: string;
  total_samples: number;
  assessed_samples: number;
  not_assessed_samples: number;
}

export interface CueLogItem {
  id: string;
  timestamp: string;
  type: "vibration_pattern" | "cancel" | "threshold_sync" | "band_alert";
  command: string;
  durationMs?: number;
  intensity?: number;
  pulseMs?: number;
  status: "sent" | "acked" | "cancelled";
}

export interface ChartSamplePoint {
  timeSec: string;
  hp: number;
  rms: number;
  freq: number;
  state: number;
}

export interface RecordedSessionMeta {
  id: string;
  name: string;
  timestamp: string;
  durationSec: number;
  sampleCount: number;
  csvContent: string;
}

export function useSteadyBand(backendWsUrl = "ws://127.0.0.1:8000/ws/wearable") {
  const [manager] = useState<WebSerialManager>(() => getWebSerialManager());

  // Backend status poll (every 10s)
  const { status: backendStatus, isConnected: isBackendConnected } = useWearableStatus(10000);

  // Selected source mode: defaults to backend if backend is connected
  const [sourceMode, setSourceMode] = useState<BandSourceMode>("serial");
  const [hasAutoSelectedBackend, setHasAutoSelectedBackend] = useState(false);

  useEffect(() => {
    if (isBackendConnected && !hasAutoSelectedBackend) {
      setSourceMode("backend");
      setHasAutoSelectedBackend(true);
    }
  }, [isBackendConnected, hasAutoSelectedBackend]);

  const [serialState, setSerialState] = useState<SerialState>(() => manager.getState());
  const [errorMessage, setErrorMessage] = useState<string>(() => manager.getErrorMessage());
  
  // Connection health metrics
  const [health, setHealth] = useState<ConnectionHealth>({
    samplesPerSec: 0,
    lastSampleAgeMs: 0,
    dropsCount: 0,
    malformedCount: 0,
    totalSamples: 0,
    firmware: null,
    baudRate: STEADY_BAND_BAUD_RATE,
  });

  const [latestSample, setLatestSample] = useState<SteadyBandSample | null>(null);
  const [chartData, setChartData] = useState<ChartSamplePoint[]>([]);
  const [hasReceivedFirstReading, setHasReceivedFirstReading] = useState<boolean>(false);

  // Counters for honest metric calculations
  const totalSamplesRef = useRef<number>(0);
  const assessedSamplesRef = useRef<number>(0);
  const notAssessedSamplesRef = useRef<number>(0);
  const tremorCountRef = useRef<number>(0);
  const dropsRef = useRef<number>(0);
  const samplesInLastSecondRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(0);

  const [metrics, setMetrics] = useState<LiveMetrics>({
    live: false,
    tremor_amplitude: "-",
    dominant_freq_hz: "-",
    tremor_detected: false,
    percent_time_in_tremor: 0.0,
    today_percent_time_in_tremor: 0.0,
    baseline_amplitude: 0.22,
    baseline_deviation_pct: 0.0,
    confidence_tier: "low",
    confidence_reason: "Band not connected",
    not_assessed_pct: 0.0,
    drops_count: 0,
    dropout_gaps_count: 0,
    effective_sample_rate_hz: 0.0,
    reliable_data: false,
    state: 0,
    state_label: "DISCONNECTED",
    total_samples: 0,
    assessed_samples: 0,
    not_assessed_samples: 0,
  });

  // Watchdog alert state (> 3 seconds no data)
  const [watchdogAlert, setWatchdogAlert] = useState<boolean>(false);

  // Cue Integration State
  const [cueLogs, setCueLogs] = useState<CueLogItem[]>([]);
  const [activeVibration, setActiveVibration] = useState<boolean>(false);
  const [sensitivityRms, setSensitivityRms] = useState<number>(0.08);
  const [sustainedMs, setSustainedMs] = useState<number>(1500);
  const lastCueTimestampRef = useRef<number>(0);
  const cuesInLastMinuteRef = useRef<number[]>([]);

  // Session Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recordingSamplesRef = useRef<SteadyBandSample[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  // WebSocket reference for backend feed
  const wsRef = useRef<WebSocket | null>(null);

  // ---------------------------------------------------------------------------
  // UNIFIED READING PIPELINE
  // Both Backend Feed and Web Serial feed the exact same reading processor
  // ---------------------------------------------------------------------------
  const processReading = useCallback((s: SteadyBandSample) => {
    setHasReceivedFirstReading(true);
    setLatestSample(s);
    lastSampleTimeRef.current = Date.now();
    samplesInLastSecondRef.current++;
    totalSamplesRef.current++;

    const isPaused = s.alert === 1 || s.btn === 1;
    if (isPaused) {
      notAssessedSamplesRef.current++;
      setActiveVibration(s.alert === 1);
    } else {
      assessedSamplesRef.current++;
      if (s.tremor === 1) {
        tremorCountRef.current++;
      }
      setActiveVibration(false);
    }

    // Append to recording buffer if active
    if (isRecording) {
      recordingSamplesRef.current.push(s);
    }

    // Chart update: Keep last 60 points
    const timeStr = (s.ms / 1000).toFixed(2);
    setChartData((prev) => [
      ...prev.slice(-60),
      {
        timeSec: timeStr,
        hp: s.hp,
        rms: s.rms,
        freq: s.freq,
        state: s.state,
      },
    ]);

    // Compute metrics
    const total = totalSamplesRef.current;
    const assessed = assessedSamplesRef.current;
    const notAssessed = notAssessedSamplesRef.current;
    const notAssessedPct = total > 0 ? Math.round((notAssessed / total) * 100) : 0;
    const tremorSharePct = assessed > 0 ? Math.round((tremorCountRef.current / assessed) * 100) : 0;
    const reliable = assessed >= 10 && notAssessedPct < 40;

    let confTier: "high" | "medium" | "low" = "low";
    let confReason = "Initializing signal...";
    if (reliable) {
      confTier = notAssessedPct < 15 ? "high" : "medium";
      confReason = "Clean high-pass kinematics from wrist sensor";
    } else if (total > 0) {
      confTier = "low";
      confReason = notAssessedPct >= 40 ? "Analysis paused: motor/button active" : "Collecting sufficient samples";
    }

    setMetrics({
      live: true,
      tremor_amplitude: Number(s.rms.toFixed(3)),
      dominant_freq_hz: Number(s.freq.toFixed(1)),
      tremor_detected: s.tremor === 1,
      percent_time_in_tremor: tremorSharePct,
      today_percent_time_in_tremor: tremorSharePct,
      baseline_amplitude: 0.22,
      baseline_deviation_pct: s.rms > 0 ? Math.round(((s.rms - 0.22) / 0.22) * 100) : 0,
      confidence_tier: confTier,
      confidence_reason: confReason,
      not_assessed_pct: notAssessedPct,
      drops_count: dropsRef.current,
      dropout_gaps_count: 0,
      effective_sample_rate_hz: 10,
      reliable_data: reliable,
      state: s.state,
      state_label: "CONNECTED",
      total_samples: total,
      assessed_samples: assessed,
      not_assessed_samples: notAssessed,
    });
  }, [isRecording]);

  // ---------------------------------------------------------------------------
  // 1-Second Health & Watchdog Tick Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const rps = samplesInLastSecondRef.current;
      samplesInLastSecondRef.current = 0;

      const lastAge = lastSampleTimeRef.current > 0 ? now - lastSampleTimeRef.current : 0;
      const isConnected = sourceMode === "backend" ? isBackendConnected : serialState === "connected";

      setHealth((prev) => ({
        ...prev,
        samplesPerSec: rps,
        lastSampleAgeMs: lastAge,
        dropsCount: dropsRef.current,
        totalSamples: totalSamplesRef.current,
        baudRate: STEADY_BAND_BAUD_RATE,
      }));

      if (isConnected) {
        if (lastSampleTimeRef.current > 0 && lastAge > 3000) {
          setWatchdogAlert(true);
          setMetrics((prev) => ({
            ...prev,
            live: false,
            state_label: "NO DATA",
            confidence_tier: "low",
            confidence_reason: "Watchdog: No data received for > 3.0s",
            reliable_data: false,
          }));
        } else if (lastSampleTimeRef.current > 0) {
          setWatchdogAlert(false);
        }
      } else {
        setWatchdogAlert(false);
        setMetrics((prev) => ({
          ...prev,
          live: false,
          state_label: serialState === "legacy_format" ? "Old text format: upload the JSON firmware" : "DISCONNECTED",
          confidence_tier: "low",
          confidence_reason: serialState === "legacy_format" ? "Old text format detected" : "Band disconnected",
          reliable_data: false,
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sourceMode, isBackendConnected, serialState]);

  // ---------------------------------------------------------------------------
  // Backend Feed WebSocket Manager (with 2s auto-reconnect)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (sourceMode !== "backend") {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let ws: WebSocket | null = null;
    let stop = false;

    const connectWs = () => {
      if (stop) return;
      try {
        ws = new WebSocket(backendWsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[SteadyBand] Backend WebSocket connected (/ws/wearable)");
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "reading" && msg.reading) {
              const r = msg.reading;
              const sample: SteadyBandSample = {
                ms: Number(r.t ?? r.t_ms ?? r.ms ?? Date.now()),
                ax: Number(r.x ?? r.ax ?? 0),
                ay: Number(r.y ?? r.ay ?? 0),
                az: Number(r.z ?? r.az ?? 1),
                hp: Number(r.hp ?? r.motion ?? 0),
                rms: Number(r.rms ?? 0),
                freq: Number(r.freq ?? 0),
                tremor: r.tremor ? 1 : 0,
                alert: r.alert ? 1 : 0,
                btn: r.btn ? 1 : 0,
                state: r.alert ? 1 : r.btn ? 3 : 0,
                drops: dropsRef.current,
                receivedAt: Date.now(),
              };
              processReading(sample);
            } else if (msg.t !== undefined && msg.x !== undefined) {
              // Direct reading object
              const sample: SteadyBandSample = {
                ms: Number(msg.t ?? msg.ms ?? Date.now()),
                ax: Number(msg.x ?? 0),
                ay: Number(msg.y ?? 0),
                az: Number(msg.z ?? 1),
                hp: Number(msg.hp ?? 0),
                rms: Number(msg.rms ?? 0),
                freq: Number(msg.freq ?? 0),
                tremor: msg.tremor ? 1 : 0,
                alert: msg.alert ? 1 : 0,
                btn: msg.btn ? 1 : 0,
                state: msg.alert ? 1 : msg.btn ? 3 : 0,
                drops: dropsRef.current,
                receivedAt: Date.now(),
              };
              processReading(sample);
            }
          } catch (err) {
            console.error("[SteadyBand] Error parsing backend reading", err);
            dropsRef.current++;
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (!stop) {
            setTimeout(connectWs, 2000);
          }
        };

        ws.onerror = (e) => {
          console.warn("[SteadyBand] Backend WebSocket error", e);
        };
      } catch (err) {
        console.warn("[SteadyBand] WS init error", err);
        if (!stop) setTimeout(connectWs, 2000);
      }
    };

    connectWs();

    return () => {
      stop = true;
      if (ws) ws.close();
    };
  }, [sourceMode, backendWsUrl, processReading]);

  // ---------------------------------------------------------------------------
  // Web Serial Event Subscriptions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (sourceMode !== "serial") return;

    const unsubStatus = manager.onStatusChange((st, err) => {
      setSerialState(st);
      if (err) setErrorMessage(err);
      if (st === "disconnected" || st === "error") {
        setMetrics((prev) => ({ ...prev, live: false, state_label: "DISCONNECTED" }));
      } else if (st === "legacy_format") {
        setMetrics((prev) => ({ ...prev, live: false, state_label: "Old text format: upload the JSON firmware" }));
      }
    });

    const unsubHealth = manager.onHealth((h) => {
      dropsRef.current = h.dropsCount;
    });

    const unsubSample = manager.onSample((s) => {
      processReading(s);
    });

    return () => {
      unsubStatus();
      unsubHealth();
      unsubSample();
    };
  }, [manager, sourceMode, processReading]);

  // ---------------------------------------------------------------------------
  // Automatic Y-Domain Computation with Min Span 0.3g
  // ---------------------------------------------------------------------------
  const chartYDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [-0.15, 0.15];
    let min = 0;
    let max = 0;
    chartData.forEach((d) => {
      if (d.hp < min) min = d.hp;
      if (d.hp > max) max = d.hp;
    });

    let span = max - min;
    const minSpan = 0.3;
    if (span < minSpan) {
      const mid = (max + min) / 2;
      min = mid - minSpan / 2;
      max = mid + minSpan / 2;
    } else {
      min -= span * 0.1;
      max += span * 0.1;
    }

    return [Math.floor(min * 100) / 100, Math.ceil(max * 100) / 100];
  }, [chartData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const connect = useCallback(async () => {
    setErrorMessage("");
    return await manager.connect();
  }, [manager]);

  const disconnect = useCallback(async () => {
    return await manager.disconnect();
  }, [manager]);

  const triggerHapticCue = useCallback(
    async (durationMs = 1500, intensity = 200, pulseMs = 150) => {
      const now = Date.now();
      if (now - lastCueTimestampRef.current < 1500) {
        return false;
      }
      cuesInLastMinuteRef.current = cuesInLastMinuteRef.current.filter((t) => now - t < 60000);
      if (cuesInLastMinuteRef.current.length >= 6) {
        return false;
      }

      if (sourceMode === "backend") {
        try {
          const res = await fetch("http://127.0.0.1:8000/api/wearable/vibrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration_ms: durationMs, intensity, pulse_ms: pulseMs }),
          });
          if (res.ok) {
            lastCueTimestampRef.current = now;
            cuesInLastMinuteRef.current.push(now);
            setActiveVibration(true);
            const logItem: CueLogItem = {
              id: "cue-" + now,
              timestamp: new Date().toLocaleTimeString(),
              type: "vibration_pattern",
              command: `POST /api/wearable/vibrate (${durationMs}ms)`,
              durationMs,
              intensity,
              pulseMs,
              status: "sent",
            };
            setCueLogs((prev) => [logItem, ...prev.slice(0, 49)]);
            return true;
          }
        } catch (e) {
          console.warn("[SteadyBand] Vibrate via backend error", e);
        }
        return false;
      } else {
        const ok = await manager.sendVibration(durationMs, intensity, pulseMs);
        if (ok) {
          lastCueTimestampRef.current = now;
          cuesInLastMinuteRef.current.push(now);
          setActiveVibration(true);
          const logItem: CueLogItem = {
            id: "cue-" + now,
            timestamp: new Date().toLocaleTimeString(),
            type: "vibration_pattern",
            command: `V,${durationMs},${intensity},${pulseMs}`,
            durationMs,
            intensity,
            pulseMs,
            status: "sent",
          };
          setCueLogs((prev) => [logItem, ...prev.slice(0, 49)]);
        }
        return ok;
      }
    },
    [manager, sourceMode]
  );

  const cancelActiveCue = useCallback(async () => {
    if (sourceMode === "serial") {
      const ok = await manager.cancelVibration();
      if (ok) {
        setActiveVibration(false);
        const logItem: CueLogItem = {
          id: "cancel-" + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: "cancel",
          command: "X (Immediate Motor Stop)",
          status: "sent",
        };
        setCueLogs((prev) => [logItem, ...prev.slice(0, 49)]);
      }
      return ok;
    }
    setActiveVibration(false);
    return true;
  }, [manager, sourceMode]);

  const updateSensitivity = useCallback(
    async (rms: number, fmin = 3.0, fmax = 8.0, newSustainedMs = 1500) => {
      setSensitivityRms(rms);
      setSustainedMs(newSustainedMs);
      if (sourceMode === "serial") {
        const ok = await manager.sendThresholdConfig(rms, fmin, fmax, newSustainedMs);
        if (ok) {
          const logItem: CueLogItem = {
            id: "sync-" + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            type: "threshold_sync",
            command: `C,${rms.toFixed(3)},${fmin},${fmax},${Math.round(newSustainedMs)}ms`,
            status: "sent",
          };
          setCueLogs((prev) => [logItem, ...prev.slice(0, 49)]);
        }
        return ok;
      }
      return true;
    },
    [manager, sourceMode]
  );

  // Session recording
  const startRecording = useCallback(() => {
    recordingSamplesRef.current = [];
    recordingStartTimeRef.current = Date.now();
    setIsRecording(true);
  }, []);

  const stopAndSaveRecording = useCallback((): RecordedSessionMeta | null => {
    setIsRecording(false);
    const samples = recordingSamplesRef.current;
    if (samples.length === 0) return null;

    const durationSec = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
    const sessionId = "ses_band_" + Date.now();

    const csvHeader = "ms,ax,ay,az,hp,rms,freq,tremor,state,drops\n";
    const csvRows = samples
      .map(
        (s) =>
          `${s.ms},${s.ax.toFixed(4)},${s.ay.toFixed(4)},${s.az.toFixed(4)},${s.hp.toFixed(
            4
          )},${s.rms.toFixed(4)},${s.freq.toFixed(2)},${s.tremor},${s.state},${s.drops}`
      )
      .join("\n");
    const fullCsv = csvHeader + csvRows;

    const meta: RecordedSessionMeta = {
      id: sessionId,
      name: `Steady Band Recording (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
      timestamp: new Date().toISOString(),
      durationSec,
      sampleCount: samples.length,
      csvContent: fullCsv,
    };

    try {
      const stored = localStorage.getItem("steady_band_replays");
      const list: RecordedSessionMeta[] = stored ? JSON.parse(stored) : [];
      list.unshift(meta);
      localStorage.setItem("steady_band_replays", JSON.stringify(list.slice(0, 20)));
    } catch (e) {
      console.error("Failed to save replay to localStorage", e);
    }

    return meta;
  }, []);

  return {
    manager,
    sourceMode,
    setSourceMode,
    backendStatus,
    isBackendConnected,
    isBackendHoldingPort: isBackendConnected,
    serialState,
    errorMessage,
    health,
    latestSample,
    hasReceivedFirstReading,
    chartData,
    chartYDomain,
    metrics,
    watchdogAlert,
    cueLogs,
    activeVibration,
    sensitivityRms,
    sustainedMs,
    isRecording,
    connect,
    disconnect,
    triggerHapticCue,
    cancelActiveCue,
    updateSensitivity,
    startRecording,
    stopAndSaveRecording,
  };
}
