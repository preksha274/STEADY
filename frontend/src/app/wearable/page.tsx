"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Zap,
  Radio,
  Flame,
  Gauge,
  Info,
  Calendar,
  Layers,
  AlertCircle,
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Play,
  Square,
  UserPlus,
  Users,
  History,
  FileText,
  FlaskConical,
  X,
  RotateCcw,
  Usb,
  Cable,
  Cpu,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { WearableSubNav } from "@/components/WearableSubNav";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  DISCLAIMER_TEXT,
  TREMOR_RMS_G,
  BASELINE_SECONDS,
  BASELINE_MIN_VALID_SECONDS,
  LIVE_CHART_XYZ_SECONDS,
  LIVE_CHART_RMS_SECONDS,
  WearableStatus,
  Person,
  Session,
  LiveReading,
  WearableAlert,
} from "@/config/wearableConfig";
import {
  fetchWearableStatus,
  fetchLatestReadings,
  triggerBandVibration,
  triggerTestAlert,
  fetchPeople,
  createPerson,
  fetchActiveSession,
  startSession,
  stopSession,
  fetchPersonBaseline,
  fetchSessions,
  fetchAlerts,
} from "@/lib/wearableClient";

export default function WearableLivePage() {
  // 1. Status & Hardware State
  const [status, setStatus] = useState<WearableStatus>({
    connected: false,
    port: "COM5",
    state: "disconnected",
    mpu_ok: true,
    last_reading_at: null,
    readings_per_second: 0,
    skipped_lines: 0,
    legacy_lines: 0,
    last_bad_line: "",
  });

  // 2. People & Session Selection State
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [sessionType, setSessionType] = useState<"normal" | "baseline">("normal");
  const [sessionLabel, setSessionLabel] = useState<string>("");
  const [sessionNote, setSessionNote] = useState<string>("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentBaseline, setCurrentBaseline] = useState<any>(null);

  // 3. Alerts State (Phase 6)
  const [alerts, setAlerts] = useState<WearableAlert[]>([]);
  const [activeAlertBanner, setActiveAlertBanner] = useState<WearableAlert | null>(null);

  // 4. Modals & Actions
  const [showAddPersonModal, setShowAddPersonModal] = useState<boolean>(false);
  const [newPersonCode, setNewPersonCode] = useState<string>("");
  const [newPersonName, setNewPersonName] = useState<string>("");
  const [personFormError, setPersonFormError] = useState<string>("");
  const [vibrateStatusMsg, setVibrateStatusMsg] = useState<string>("");
  const [isVibrating, setIsVibrating] = useState<boolean>(false);

  // 5. Baseline Calibration State
  const [isBaselineRecording, setIsBaselineRecording] = useState<boolean>(false);
  const [baselineCountdown, setBaselineCountdown] = useState<number>(BASELINE_SECONDS);
  const [baselineSummaryModal, setBaselineSummaryModal] = useState<{
    show: boolean;
    validSeconds: number;
    tremorShare: number | null;
    tremorStrength: number | null;
    isSuccess: boolean;
  } | null>(null);

  // 6. Normal Session Completion Summary Modal
  const [sessionCompletedSummary, setSessionCompletedSummary] = useState<any | null>(null);

  // 7. Live Telemetry State & High-Performance Ring Buffers (100 pts XYZ, 600 pts RMS)
  const [latestSample, setLatestSample] = useState<LiveReading | null>(null);
  const [xyzData, setXyzData] = useState<{ time: string; x: number; y: number; z: number }[]>([]);
  const [rmsData, setRmsData] = useState<{ time: string; rms: number }[]>([]);

  const xyzRingRef = useRef<{ time: string; x: number; y: number; z: number }[]>([]);
  const rmsRingRef = useRef<{ time: string; rms: number }[]>([]);
  const latestSampleRef = useRef<LiveReading | null>(null);
  const lastIngestedTsRef = useRef<string>("");
  const lastIngestedTmsRef = useRef<number>(-1);

  // 8. Diagnostics & Debug Strip State
  const [showDebugStrip, setShowDebugStrip] = useState<boolean>(false);
  const [wsState, setWsState] = useState<string>("connecting");
  const [messageCount, setMessageCount] = useState<number>(0);
  const [msgPerSec, setMsgPerSec] = useState<number>(0);
  const [lastRawMsg, setLastRawMsg] = useState<string>("");
  const [lastParsedStr, setLastParsedStr] = useState<string>("");
  const msgRateCountRef = useRef<number>(0);

  // 9. Direct Web Serial State
  const [isWebSerialActive, setIsWebSerialActive] = useState<boolean>(false);
  const [webSerialInfo, setWebSerialInfo] = useState<string>("");
  const webSerialPortRef = useRef<any>(null);
  const webSerialReaderRef = useRef<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const baselineIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rate tracker for debug strip
  useEffect(() => {
    const rateInterval = setInterval(() => {
      setMsgPerSec(msgRateCountRef.current);
      msgRateCountRef.current = 0;
    }, 1000);
    return () => clearInterval(rateInterval);
  }, []);

  // Smooth Chart Redraw Loop (10 fps / 100ms) from Ring Buffers
  useEffect(() => {
    const redrawInterval = setInterval(() => {
      if (xyzRingRef.current.length > 0) {
        setXyzData([...xyzRingRef.current]);
      }
      if (rmsRingRef.current.length > 0) {
        setRmsData([...rmsRingRef.current]);
      }
      if (latestSampleRef.current) {
        setLatestSample(latestSampleRef.current);
      }
    }, 100);
    return () => clearInterval(redrawInterval);
  }, []);

  // Unified Live Sample Ingestion Processor
  const processIncomingReading = useCallback((reading: LiveReading, rawJsonText?: string) => {
    if (!reading || typeof reading.t_ms !== "number") return;

    // Increment message counters
    setMessageCount((prev) => prev + 1);
    msgRateCountRef.current += 1;
    if (rawJsonText) setLastRawMsg(rawJsonText.slice(0, 140));
    setLastParsedStr(JSON.stringify(reading));

    latestSampleRef.current = reading;

    // Use browser receive time for clean moving chart time axis
    const now = new Date();
    const timeLabel =
      now.toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" }) +
      "." +
      Math.floor((now.getTime() % 1000) / 100);

    // Push into ring buffers with fixed bounds (10s @ 10Hz = 100 pts; 60s @ 10Hz = 600 pts)
    xyzRingRef.current.push({
      time: timeLabel,
      x: Number(reading.x) || 0,
      y: Number(reading.y) || 0,
      z: Number(reading.z) || 0,
    });
    if (xyzRingRef.current.length > LIVE_CHART_XYZ_SECONDS * 10) {
      xyzRingRef.current = xyzRingRef.current.slice(-LIVE_CHART_XYZ_SECONDS * 10);
    }

    rmsRingRef.current.push({
      time: timeLabel,
      rms: Number(reading.rms) || 0,
    });
    if (rmsRingRef.current.length > LIVE_CHART_RMS_SECONDS * 10) {
      rmsRingRef.current = rmsRingRef.current.slice(-LIVE_CHART_RMS_SECONDS * 10);
    }
  }, []);

  // Load people, active session, and baseline on mount
  const loadInitialData = async () => {
    const s = await fetchWearableStatus();
    setStatus(s);
    const pList = await fetchPeople();
    setPeople(pList);
    
    let currentPId = selectedPersonId;
    if (pList.length > 0 && !currentPId) {
      currentPId = pList[0].id;
      setSelectedPersonId(currentPId);
    }
    
    if (currentPId) {
      const bData = await fetchPersonBaseline(currentPId);
      setCurrentBaseline(bData);
    }

    const act = await fetchActiveSession();
    if (act.active && act.session) {
      setActiveSession(act.session);
      setSelectedPersonId(act.session.person_id);
      setSessionType(act.session.type);
      setSessionLabel(act.session.label || "");
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Refresh status every 2 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const s = await fetchWearableStatus();
      setStatus(s);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Load person baseline when person changes
  useEffect(() => {
    if (!selectedPersonId) {
      setCurrentBaseline(null);
      return;
    }
    fetchPersonBaseline(selectedPersonId).then(setCurrentBaseline);
    fetchAlerts(selectedPersonId).then(setAlerts);
  }, [selectedPersonId]);

  // Session duration timer
  useEffect(() => {
    if (activeSession && activeSession.started_at) {
      const startTime = new Date(activeSession.started_at).getTime();
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - startTime) / 1000));
        setElapsedSeconds(diff);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // 1. High-Frequency Live Buffer Poller (10Hz Real-Time Fallback & Sync)
  useEffect(() => {
    let active = true;

    const pollLiveStream = async () => {
      if (!active) return;
      try {
        const batch = await fetchLatestReadings(20);
        if (active && Array.isArray(batch) && batch.length > 0) {
          for (const item of batch) {
            const r = item as LiveReading;
            if (r.ts && r.ts > lastIngestedTsRef.current) {
              lastIngestedTsRef.current = r.ts;
              processIncomingReading(r, JSON.stringify(r));
            } else if (r.t_ms && r.t_ms > lastIngestedTmsRef.current && !r.ts) {
              lastIngestedTmsRef.current = r.t_ms;
              processIncomingReading(r, JSON.stringify(r));
            }
          }
        }
      } catch (e) {
        // Continue loop silently
      }
    };

    const interval = setInterval(pollLiveStream, 100);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [processIncomingReading]);

  // 2. WebSocket connection for /ws/wearable (Real-Time Push Stream with 2s Reconnect)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isStopped = false;

    function connectWs() {
      if (isStopped) return;
      try {
        setWsState("connecting");
        ws = new WebSocket("ws://127.0.0.1:8000/ws/wearable");
        wsRef.current = ws;

        ws.onopen = () => {
          setWsState("open");
        };

        ws.onmessage = (event) => {
          try {
            const rawText = typeof event.data === "string" ? event.data : "";
            const data = JSON.parse(event.data);

            // Phase 6: Alert Event Handling
            if (data.type === "alert" && data.alert) {
              const newAlert = data.alert as WearableAlert;
              setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id).slice(0, 24)]);
              setActiveAlertBanner(newAlert);
              if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
              bannerTimerRef.current = setTimeout(() => {
                setActiveAlertBanner(null);
              }, 7000);
              return;
            }

            // Live Reading Stream Handling
            if (typeof data.t_ms === "number" || typeof data.t === "number" || typeof data.rms === "number") {
              const reading = data as LiveReading;
              if (reading.ts) lastIngestedTsRef.current = reading.ts;
              lastIngestedTmsRef.current = reading.t_ms;
              processIncomingReading(reading, rawText);
            }
          } catch (e) {
            console.warn("WS Parse error", e);
          }
        };

        ws.onclose = () => {
          setWsState("closed (reconnecting in 2s...)");
          if (!isStopped) {
            setTimeout(connectWs, 2000);
          }
        };

        ws.onerror = () => {
          setWsState("error");
          if (ws) ws.close();
        };
      } catch (e) {
        setWsState("error");
        if (!isStopped) {
          setTimeout(connectWs, 2000);
        }
      }
    }

    connectWs();
    return () => {
      isStopped = true;
      if (ws) ws.close();
    };
  }, [processIncomingReading]);


  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Start Session Handler
  const handleStartSession = async () => {
    if (!selectedPersonId) return;
    const res = await startSession({
      personId: selectedPersonId,
      type: sessionType,
      label: sessionLabel ? (sessionLabel as any) : null,
      note: sessionNote || null,
    });
    if (res.success && res.session) {
      setActiveSession(res.session);
    }
  };

  // Stop Session Handler
  const handleStopSession = async () => {
    if (!activeSession) return;
    const res = await stopSession(activeSession.id);
    if (res.success && res.session) {
      const stoppedSess = res.session;
      setActiveSession(null);
      setSessionCompletedSummary(stoppedSess);
      if (selectedPersonId) {
        fetchPersonBaseline(selectedPersonId).then(setCurrentBaseline);
      }
    }
  };

  // Baseline Calibration Flow (Phase 5)
  const handleStartBaselineWorkflow = async () => {
    if (!selectedPersonId || activeSession !== null) return;
    
    // 1. Start baseline session
    const res = await startSession({
      personId: selectedPersonId,
      type: "baseline",
      label: "still",
      note: "Automated 60s baseline calibration session",
    });

    if (res.success && res.session) {
      const bSession = res.session;
      setActiveSession(bSession);
      setIsBaselineRecording(true);
      setBaselineCountdown(BASELINE_SECONDS);

      // Countdown loop
      let remaining = BASELINE_SECONDS;
      if (baselineIntervalRef.current) clearInterval(baselineIntervalRef.current);
      
      baselineIntervalRef.current = setInterval(async () => {
        remaining -= 1;
        setBaselineCountdown(remaining);

        if (remaining <= 0) {
          if (baselineIntervalRef.current) clearInterval(baselineIntervalRef.current);
          setIsBaselineRecording(false);
          
          // Stop the baseline session
          const stopRes = await stopSession(bSession.id);
          if (stopRes.success && stopRes.session) {
            const finished = stopRes.session as any;
            setActiveSession(null);
            
            // Reload updated baseline
            const updatedBaseline = await fetchPersonBaseline(selectedPersonId);
            setCurrentBaseline(updatedBaseline);

            const isSuccess = ((finished.valid_seconds as number) || 0) >= BASELINE_MIN_VALID_SECONDS;
            setBaselineSummaryModal({
              show: true,
              validSeconds: finished.valid_seconds || 0,
              tremorShare: finished.tremor_share ?? null,
              tremorStrength: finished.tremor_strength ?? null,
              isSuccess: isSuccess,
            });
          }
        }
      }, 1000);
    }
  };

  const handleCancelBaseline = async () => {
    if (baselineIntervalRef.current) clearInterval(baselineIntervalRef.current);
    setIsBaselineRecording(false);
    if (activeSession) {
      await stopSession(activeSession.id);
      setActiveSession(null);
    }
  };

  // Quick Add Person Handler
  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonFormError("");
    if (!newPersonCode.trim()) {
      setPersonFormError("Participant Code is required (e.g. P01)");
      return;
    }

    const res = await createPerson(newPersonCode.trim().toUpperCase(), newPersonName.trim() || undefined);
    if (res.success && res.person) {
      setShowAddPersonModal(false);
      setNewPersonCode("");
      setNewPersonName("");
      const updatedList = await fetchPeople();
      setPeople(updatedList);
      setSelectedPersonId(res.person.id);
    } else {
      setPersonFormError(res.error || "Failed to create person");
    }
  };

  // Test Vibration Motor Trigger (Phase 6)
  const handleTestVibration = async () => {
    setIsVibrating(true);
    setVibrateStatusMsg("Triggering band vibration...");
    const res = await triggerBandVibration();
    setVibrateStatusMsg(res.message);
    if (res.success && selectedPersonId) {
      fetchAlerts(selectedPersonId).then(setAlerts);
    }
    setTimeout(() => {
      setIsVibrating(false);
      setVibrateStatusMsg("");
    }, 3000);
  };

  // Direct Browser Web Serial Connect / Ingest (Fallback if backend not running serial)
  const handleConnectWebSerial = async () => {
    if (status.connected) {
      alert("The backend already holds the port (COM5). Direct Web Serial is not needed.");
      return;
    }
    if (!("serial" in navigator)) {
      alert("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      webSerialPortRef.current = port;
      setIsWebSerialActive(true);
      setWebSerialInfo("Connected via Web Serial");

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      webSerialReaderRef.current = reader;

      let lineBuffer = "";
      let ingestBatch: LiveReading[] = [];
      let lastBatchFlush = Date.now();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        lineBuffer += value;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";

        for (const line of lines) {
          const clean = line.trim();
          if (!clean) continue;

          let parsedSample: LiveReading | null = null;
          const jsonMatch = clean.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[0]);
              const nowIso = new Date().toISOString();
              const rms = Number(data.rms ?? data.tremor_strength ?? 0);
              const rawTremor = data.tremor ?? data.tremor_detected;
              const tremor = typeof rawTremor === "boolean" ? (rawTremor ? 1 : 0) : (rawTremor !== undefined ? Number(rawTremor) : (rms >= 0.04 ? 1 : 0));
              const rawAlert = data.alert ?? data.vibrating;
              const alert = typeof rawAlert === "boolean" ? (rawAlert ? 1 : 0) : (rawAlert !== undefined ? Number(rawAlert) : 0);

              parsedSample = {
                ts: nowIso,
                t_ms: Number(data.t ?? data.timestamp ?? data.time ?? data.t_ms ?? Date.now()),
                x: Number(data.x ?? data.ax ?? 0),
                y: Number(data.y ?? data.ay ?? 0),
                z: Number(data.z ?? data.az ?? 1),
                hp: Number(data.hp ?? data.motion ?? 0),
                rms: rms,
                freq: Number(data.freq ?? data.tremor_frequency ?? data.f ?? 0),
                tremor: tremor,
                alert: alert,
                btn: Number(data.btn ?? data.button ?? 0),
              };
            } catch (e) {
              // Ignore malformed JSON
            }
          }

          if (parsedSample) {
            processIncomingReading(parsedSample, clean);
            ingestBatch.push(parsedSample);
            const now = Date.now();
            if (ingestBatch.length >= 10 || (now - lastBatchFlush) >= 1000) {
              const toSend = ingestBatch;
              ingestBatch = [];
              lastBatchFlush = now;
              fetch("http://127.0.0.1:8000/api/wearable/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toSend),
              }).catch(() => {});
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("Web Serial error", e);
      setIsWebSerialActive(false);
      setWebSerialInfo("");
    }
  };

  const handleDisconnectWebSerial = async () => {
    try {
      if (webSerialReaderRef.current) {
        await webSerialReaderRef.current.cancel();
      }
      if (webSerialPortRef.current) {
        await webSerialPortRef.current.close();
      }
    } catch {}
    setIsWebSerialActive(false);
    setWebSerialInfo("");
  };

  // State Banner Mapping
  const getStatusBadge = () => {
    if (isWebSerialActive) {
      return {
        label: "Connected (Web Serial)",
        color: "bg-emerald-100 text-emerald-900 border-emerald-300",
        dot: "bg-emerald-500",
        help: null,
      };
    }

    switch (status.state) {
      case "connected":
        return {
          label: "Connected (Backend COM)",
          color: "bg-emerald-100 text-emerald-900 border-emerald-300",
          dot: "bg-emerald-500",
          help: null,
        };
      case "no_data":
        return {
          label: "No Data",
          color: "bg-amber-100 text-amber-900 border-amber-300",
          dot: "bg-amber-500",
          help: `Backend connected to ${status.port}, but no telemetry received. Close Arduino IDE Serial Monitor if open.`,
        };
      case "port_busy":
        return {
          label: "Port Busy",
          color: "bg-rose-100 text-rose-900 border-rose-300",
          dot: "bg-rose-500",
          help: `Port ${status.port} is busy. Close Arduino IDE Serial Monitor or other serial apps.`,
        };
      case "port_missing":
        return {
          label: "Port Missing",
          color: "bg-slate-100 text-slate-800 border-slate-300",
          dot: "bg-slate-400",
          help: `Band not detected on ${status.port}. Connect your ESP32 via USB.`,
        };
      case "legacy_format":
        return {
          label: "Legacy Format",
          color: "bg-purple-100 text-purple-900 border-purple-300",
          dot: "bg-purple-500",
          help: "Receiving legacy text stream. Firmware update recommended.",
        };
      case "disconnected":
      default:
        return {
          label: "Disconnected",
          color: "bg-slate-100 text-slate-800 border-slate-300",
          dot: "bg-slate-400",
          help: "Plug in the ESP32 wrist band via USB.",
        };
    }
  };

  const statusBadge = getStatusBadge();
  const isTremorActive = latestSample?.tremor === 1;
  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  return (
    <main className="min-h-screen bg-[#F0FDFA] text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TOP SUB-NAVIGATION */}
        <WearableSubNav
          activeTab="live"
          title="Steady Wearable Live"
          subtitle="Real-time wrist band motion monitoring & decision support"
          badge="Telemetry Loop"
        />

        {/* ACTIVE ALERT BANNER (PHASE 6) */}
        {activeAlertBanner && (
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300 ${
              activeAlertBanner.source === "band"
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : activeAlertBanner.source === "rule"
                ? "bg-indigo-50 border-indigo-300 text-indigo-950"
                : "bg-teal-50 border-teal-300 text-teal-950"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-2xl ${
                  activeAlertBanner.source === "band"
                    ? "bg-amber-100 text-amber-900"
                    : activeAlertBanner.source === "rule"
                    ? "bg-indigo-100 text-indigo-900"
                    : "bg-teal-100 text-teal-900"
                }`}
              >
                <Zap className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider">
                    {activeAlertBanner.source === "band"
                      ? "Wearable Hardware Alert"
                      : activeAlertBanner.source === "rule"
                      ? "Elevated Baseline Alert"
                      : "Test Signal Notice"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(activeAlertBanner.ts).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm font-bold mt-0.5">{activeAlertBanner.reason}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveAlertBanner(null)}
              className="p-2 rounded-xl hover:bg-black/5 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. HARDWARE STATUS & CONNECTION BAR */}
        <section className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border ${statusBadge.color}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${statusBadge.dot} ${status.connected ? "animate-pulse" : ""}`} />
                <span>{statusBadge.label}</span>
              </div>
              <span className="text-xs text-slate-600 font-semibold">
                Port: <code className="font-mono text-teal-800">{status.port}</code>
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                Rate: <strong className="text-teal-900">{status.readings_per_second} rps</strong>
              </span>
              {!status.mpu_ok && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  Sensor Error (MPU Offline)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isWebSerialActive ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                    <Usb className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span>Browser USB Stream Active</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectWebSerial}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all"
                  >
                    Disconnect USB
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectWebSerial}
                  disabled={status.connected}
                  title={status.connected ? "The backend already holds the port" : "Connect via Web Serial"}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    status.connected
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs"
                  }`}
                >
                  <Usb className="w-3.5 h-3.5" />
                  <span>Connect ESP32 (Web Serial)</span>
                </button>
              )}

              {/* Debug Strip Toggle Pill */}
              <button
                type="button"
                onClick={() => setShowDebugStrip((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-all flex items-center gap-1"
                title="Toggle Stream Diagnostics Strip"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Debug</span>
                {showDebugStrip ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* HIDDEN-BY-DEFAULT DIAGNOSTICS & DEBUG STRIP */}
          {showDebugStrip && (
            <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 text-xs font-mono space-y-2 border border-slate-800 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 text-[11px]">
                <div className="flex items-center gap-3">
                  <span>
                    WS State: <strong className={wsState === "open" ? "text-emerald-400" : "text-amber-400"}>{wsState}</strong>
                  </span>
                  <span>
                    Msgs Received: <strong>{messageCount}</strong>
                  </span>
                  <span>
                    Throughput: <strong className="text-teal-400">{msgPerSec} msg/s</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    XYZ Buffer: <strong>{xyzData.length} pts</strong>
                  </span>
                  <span>
                    RMS Buffer: <strong>{rmsData.length} pts</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-slate-400 block mb-0.5">Last Raw Telemetry Frame:</span>
                  <div className="p-2 rounded bg-slate-950 text-slate-300 truncate">
                    {lastRawMsg || "No raw messages received yet"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Last Parsed Reading Payload:</span>
                  <div className="p-2 rounded bg-slate-950 text-teal-300 truncate">
                    {lastParsedStr || "None"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {statusBadge.help && (
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{statusBadge.help}</span>
            </div>
          )}
        </section>

        {/* 2. SESSION CONTROLS & BASELINE CARD */}
        <section className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-teal-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wider">
                Session Controls
              </h2>
              <p className="text-xs text-slate-500">
                Choose a participant and record live motion telemetry
              </p>
            </div>

            {activeSession && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Recording Active: <code className="font-mono text-rose-900">{activeSession.id}</code></span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 font-mono text-rose-950">
                  {formatTimer(elapsedSeconds)}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Person Selector */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Person</span>
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(true)}
                  className="text-teal-700 hover:text-teal-900 text-[11px] flex items-center gap-1 font-semibold"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ Add Person</span>
                </button>
              </div>
              <select
                disabled={activeSession !== null}
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
              >
                {people.length === 0 ? (
                  <option value="">No people registered</option>
                ) : (
                  people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} {p.display_name ? `(${p.display_name})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Session Type */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 block">Session Type</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={activeSession !== null}
                  onClick={() => setSessionType("normal")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    sessionType === "normal"
                      ? "bg-[#0F766E] text-white shadow-xs"
                      : "bg-teal-50/50 border border-teal-200 text-teal-800 hover:bg-teal-100/50"
                  } disabled:opacity-60`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  disabled={activeSession !== null}
                  onClick={() => setSessionType("baseline")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    sessionType === "baseline"
                      ? "bg-[#0F766E] text-white shadow-xs"
                      : "bg-teal-50/50 border border-teal-200 text-teal-800 hover:bg-teal-100/50"
                  } disabled:opacity-60`}
                >
                  Baseline
                </button>
              </div>
            </div>

            {/* Activity Label */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 block">Activity Label</span>
              <select
                disabled={activeSession !== null}
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
              >
                <option value="">None / Unspecified</option>
                <option value="still">Still (Resting)</option>
                <option value="typing">Typing</option>
                <option value="walking">Walking</option>
                <option value="shaking">Shaking (Tremor Imitation)</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Start / Stop Actions */}
            <div className="space-y-1 flex flex-col justify-end">
              <span className="text-xs font-bold text-slate-700 block">&nbsp;</span>
              {!activeSession ? (
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={!selectedPersonId}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Session</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopSession}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Session ({formatTimer(elapsedSeconds)})</span>
                </button>
              )}
            </div>
          </div>

          {/* Baseline Indicator Snippet */}
          <div className="pt-2 border-t border-teal-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#0F766E]" />
              <span>
                Baseline for <strong>{selectedPerson?.code || "Participant"}</strong>:{" "}
                {currentBaseline?.tremor_share !== null && currentBaseline?.tremor_share !== undefined ? (
                  <span className="text-emerald-700 font-black">
                    {currentBaseline.tremor_share}% resting tremor share ({currentBaseline.sessions_used} session(s))
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold">No baseline recorded yet</span>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={handleStartBaselineWorkflow}
              disabled={!selectedPersonId || activeSession !== null}
              className="text-xs font-bold text-teal-800 hover:text-teal-950 underline flex items-center gap-1 disabled:opacity-50"
            >
              <span>Record 60s Baseline Calibration &rarr;</span>
            </button>
          </div>
        </section>

        {/* 3. CHARTS: RAW XYZ (10s) & STRENGTH RMS (60s) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart A: Raw Acceleration X, Y, Z (10s) */}
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-teal-100 pb-2">
              <div>
                <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Raw Acceleration (XYZ)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Last {LIVE_CHART_XYZ_SECONDS}s at 10 Hz (unit: g)
                </p>
              </div>
              <div className="flex items-center gap-2.5 text-[11px] font-bold font-mono">
                <span className="text-[#0D9488]">X: {latestSample ? `${latestSample.x.toFixed(3)}g` : "-"}</span>
                <span className="text-[#F59E0B]">Y: {latestSample ? `${latestSample.y.toFixed(3)}g` : "-"}</span>
                <span className="text-[#6366F1]">Z: {latestSample ? `${latestSample.z.toFixed(3)}g` : "-"}</span>
              </div>
            </div>

            <div className="h-56 w-full bg-teal-50/30 rounded-2xl p-2 border border-teal-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={xyzData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[-2.0, 2.0]} tick={{ fontSize: 9 }} width={32} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      border: "1px solid #99F6E4",
                      fontSize: 11,
                    }}
                  />
                  <Line type="monotone" dataKey="x" name="X (g)" stroke="#0D9488" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="y" name="Y (g)" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="z" name="Z (g)" stroke="#6366F1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart B: Signal Strength RMS (60s) */}
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-teal-100 pb-2">
              <div>
                <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Signal Strength RMS &amp; Tremor Threshold
                </h3>
                <p className="text-[11px] text-slate-400">
                  Last {LIVE_CHART_RMS_SECONDS}s window (unit: g)
                </p>
              </div>
              <div className="text-[11px] font-bold font-mono text-[#D97706]">
                Latest RMS: {latestSample ? `${latestSample.rms.toFixed(4)}g` : "-"}
              </div>
            </div>

            <div className="h-56 w-full bg-teal-50/30 rounded-2xl p-2 border border-teal-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rmsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0.0, 0.25]} tick={{ fontSize: 9 }} width={32} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      border: "1px solid #99F6E4",
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine
                    y={TREMOR_RMS_G}
                    stroke="#D97706"
                    strokeDasharray="4 2"
                    label={{ value: `Threshold (${TREMOR_RMS_G}g)`, fill: "#D97706", fontSize: 9 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rms"
                    name="RMS (g)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 4. STATUS TILE, TEST VIBRATION & ALERTS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Tile: Tremor-like Movement Indicator */}
          <div
            className={`p-5 sm:p-6 rounded-3xl border shadow-xs flex flex-col justify-between space-y-4 transition-all ${
              isTremorActive
                ? "bg-amber-50/90 border-amber-300"
                : "bg-white/90 border-[#99F6E4]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                Live Movement State
              </span>
              <Activity className={`w-5 h-5 ${isTremorActive ? "text-amber-600 animate-pulse" : "text-teal-600"}`} />
            </div>

            <div className="space-y-1">
              <div
                className={`text-xl sm:text-2xl font-black ${
                  isTremorActive ? "text-amber-950" : "text-teal-950"
                }`}
              >
                {latestSample
                  ? isTremorActive
                    ? "Tremor-like Movement"
                    : "No Tremor-like Movement"
                  : "Awaiting Live Telemetry..."}
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-700 pt-1 font-mono">
                <span>Strength: <strong className="text-slate-900">{latestSample ? `${latestSample.rms.toFixed(4)} g` : "-"}</strong></span>
                <span>Rhythm: <strong className="text-slate-900">{latestSample ? `${latestSample.freq.toFixed(1)} Hz` : "-"}</strong></span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic border-t border-teal-100 pt-2">
              * RMS, frequency, and tremor indicators update in real-time; XYZ acceleration updates at 10 Hz.
            </p>
          </div>

          {/* Action Buttons: Test Vibration & Record Baseline */}
          <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-teal-100 pb-2">
              <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                Band Interaction &amp; Calibration
              </span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleTestVibration}
                disabled={isVibrating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>{isVibrating ? "Sending Vibration (3s)..." : "Test Vibration Motor"}</span>
              </button>
              {vibrateStatusMsg && (
                <p className="text-[11px] text-center text-teal-800 font-semibold">{vibrateStatusMsg}</p>
              )}

              <button
                type="button"
                onClick={handleStartBaselineWorkflow}
                disabled={!selectedPersonId || activeSession !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-all text-center disabled:opacity-50"
              >
                <Gauge className="w-4 h-4" />
                <span>Record Baseline (60s)</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              Sends &apos;V&apos; byte command to motor without interrupting sampling loop.
            </p>
          </div>

          {/* Alerts Card (Phase 6) */}
          <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-teal-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Active Alerts &amp; Notices
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-[#0F766E]">
                  {alerts.length}
                </span>
              </div>
              <Clock className="w-4 h-4 text-teal-600" />
            </div>

            {alerts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-teal-50/40 border border-teal-100 text-center text-xs text-slate-500 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-teal-600 mx-auto" />
                <div className="font-bold text-slate-700">No Alerts Recorded</div>
                <div className="text-[11px]">Movement stream within expected parameters</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {alerts.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    className={`p-2.5 rounded-2xl border text-xs flex items-start justify-between gap-2 transition-all ${
                      a.source === "band"
                        ? "bg-amber-50/80 border-amber-200 text-amber-950"
                        : a.source === "rule"
                        ? "bg-indigo-50/80 border-indigo-200 text-indigo-950"
                        : "bg-slate-50/80 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            a.source === "band"
                              ? "bg-amber-200 text-amber-900"
                              : a.source === "rule"
                              ? "bg-indigo-200 text-indigo-900"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          {a.source}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold leading-tight">{a.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-slate-500 text-center">
              Alerts log band hardware signals, elevated baseline rules, and test vibrations.
            </p>
          </div>
        </section>

        {/* 5. ADD PERSON MODAL */}
        {showAddPersonModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#0F766E]" />
                  <h3 className="text-base font-black text-slate-900">Register New Participant</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-teal-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddPersonSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Participant Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={newPersonCode}
                    onChange={(e) => setNewPersonCode(e.target.value)}
                    placeholder="e.g. P01 or PT12"
                    className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
                  />
                  <p className="text-[10px] text-slate-400">Short unique identifier (2-12 chars)</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Pseudonym / Display Label (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="e.g. John D. (Morning Track)"
                    className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {personFormError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{personFormError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-100">
                  <button
                    type="button"
                    onClick={() => setShowAddPersonModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-black bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all"
                  >
                    Create Participant
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. BASELINE PROGRESS MODAL */}
        {isBaselineRecording && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-md w-full p-6 text-center space-y-4 animate-in zoom-in duration-200">
              <div className="w-16 h-16 rounded-full bg-teal-100 text-[#0F766E] flex items-center justify-center mx-auto animate-pulse">
                <Gauge className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Recording Resting Baseline</h3>
                <p className="text-xs text-slate-500">
                  Please keep arm resting comfortably on the table. Recording 60 seconds of telemetry...
                </p>
              </div>

              <div className="text-4xl font-black text-[#0F766E] font-mono">
                {baselineCountdown}s
              </div>

              <div className="w-full bg-teal-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#0F766E] h-full transition-all duration-1000"
                  style={{ width: `${((BASELINE_SECONDS - baselineCountdown) / BASELINE_SECONDS) * 100}%` }}
                />
              </div>

              <button
                type="button"
                onClick={handleCancelBaseline}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all"
              >
                Cancel Calibration
              </button>
            </div>
          </div>
        )}

        {/* 7. BASELINE SUMMARY MODAL */}
        {baselineSummaryModal && baselineSummaryModal.show && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-md w-full p-6 space-y-4 text-center animate-in zoom-in duration-200">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
                  baselineSummaryModal.isSuccess
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {baselineSummaryModal.isSuccess ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <AlertTriangle className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  {baselineSummaryModal.isSuccess
                    ? "Baseline Calibration Complete"
                    : "Calibration Incomplete (<30s valid)"}
                </h3>
                <p className="text-xs text-slate-500">
                  {baselineSummaryModal.isSuccess
                    ? "Personal baseline updated successfully from resting telemetry."
                    : "Insufficient valid motion samples recorded. Baseline was not updated."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 text-xs text-left">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Valid Time</span>
                  <span className="text-sm font-black text-slate-900">
                    {baselineSummaryModal.validSeconds}s / {BASELINE_SECONDS}s
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Resting Tremor</span>
                  <span className="text-sm font-black text-[#0F766E]">
                    {baselineSummaryModal.tremorShare !== null ? `${baselineSummaryModal.tremorShare}%` : "—"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBaselineSummaryModal(null)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* 8. NORMAL SESSION SUMMARY MODAL */}
        {sessionCompletedSummary && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-slate-900">Session Recorded</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionCompletedSummary(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Duration</span>
                  <span className="text-base font-black text-slate-900">
                    {Math.round(sessionCompletedSummary.duration_s || 0)}s
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Share</span>
                  <span className="text-base font-black text-[#0F766E]">
                    {sessionCompletedSummary.tremor_share !== null ? `${sessionCompletedSummary.tremor_share}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Signal Strength</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {sessionCompletedSummary.tremor_strength ?? 0}g
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Dominant Rhythm</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {sessionCompletedSummary.dominant_frequency ?? 0} Hz
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-100">
                <Link
                  href={`/wearable/report?session_id=${sessionCompletedSummary.id}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-all"
                >
                  View Full Report &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => setSessionCompletedSummary(null)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
