"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  FastForward,
  UploadCloud,
  FileText,
  Activity,
  History,
  Users,
  FlaskConical,
  Zap,
  Gauge,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Check,
  Save,
  Clock,
  Layers,
  HelpCircle,
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
  ReferenceArea,
} from "recharts";
import {
  DISCLAIMER_TEXT,
  TREMOR_RMS_G,
  Person,
  LiveReading,
  WearableAlert,
} from "@/config/wearableConfig";
import {
  fetchPeople,
  loadReplayDataset,
  startReplay,
  pauseReplay,
  resumeReplay,
  stopReplay,
  fetchReplayStatus,
  commitValidationSession,
} from "@/lib/wearableClient";

export interface ParseMeta {
  filename: string;
  rows_used: number;
  rows_skipped: number;
  columns_found: string[];
  columns_missing: string[];
  duration_seconds: number;
  first_timestamp: string;
  last_timestamp: string;
  tremor_share: number;
  alert_rows: number;
  label: string | null;
}

interface ParseResult {
  success: boolean;
  error?: string | null;
  samples: any[];
  meta: ParseMeta | null;
}

function parseClientCSV(csvText: string, filename: string = "uploaded.csv"): ParseResult {
  if (!csvText || !csvText.trim()) {
    return { success: false, error: "CSV file is empty.", samples: [], meta: null };
  }

  try {
    const cleaned = csvText.replace(/^\ufeff/, "");
    const rawLines = cleaned.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const dataLines = rawLines.filter((l: string) => !l.startsWith("#"));

    if (dataLines.length === 0) {
      return { success: false, error: "CSV contains only comment lines (starts with '#').", samples: [], meta: null };
    }

    // Split first row into headers (handling quotes)
    const headerLine = dataLines[0];
    const headerCols: string[] = headerLine.split(",").map((h: string) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));

    const aliasMap: Record<string, string[]> = {
      t_ms: ["t_ms", "t", "time_ms", "timems", "ms"],
      timestamp: ["timestamp_iso", "timestamp", "time", "ts", "t_iso", "datetime"],
      x: ["x", "ax", "acc_x", "accx", "accel_x"],
      y: ["y", "ay", "acc_y", "accy", "accel_y"],
      z: ["z", "az", "acc_z", "accz", "accel_z"],
      hp: ["hp", "motion", "highpass", "hp_acc"],
      rms: ["rms", "tremor_strength", "strength", "rms_acc", "mag"],
      freq: ["freq", "tremor_frequency", "frequency", "f", "hz"],
      tremor: ["tremor", "tremor_detected", "is_tremor", "tremor_state"],
      alert: ["alert", "vibrating", "vibration", "state"],
      btn: ["btn", "button", "btn_state"],
      label: ["label", "activity", "tag", "task"],
      session_type: ["session_type", "type"],
    };

    const colIndices: Record<string, number> = {};
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      for (let i = 0; i < headerCols.length; i++) {
        if (aliases.includes(headerCols[i])) {
          colIndices[canonical] = i;
          break;
        }
      }
    }

    if (colIndices["x"] === undefined && colIndices["rms"] === undefined) {
      return {
        success: false,
        error: `Missing required acceleration/motion columns (x/ax/accx). Found columns: [${headerCols.join(", ")}]`,
        samples: [],
        meta: null,
      };
    }

    const columnsMissing = ["x", "y", "z", "rms", "freq", "t_ms"].filter((c: string) => colIndices[c] === undefined);

    const parsed: any[] = [];
    let skipped = 0;
    let firstTs: string | null = null;
    let lastTs: string | null = null;
    let detectedLabel: string | null = null;
    let t0: number | null = null;

    for (let rIdx = 1; rIdx < dataLines.length; rIdx++) {
      const line = dataLines[rIdx];
      const cells = line.split(",").map((c: string) => c.trim().replace(/^["']|["']$/g, ""));
      if (cells.length === 0 || cells.every((c: string) => c === "")) {
        skipped++;
        continue;
      }

      const getVal = (key: string, defVal: any = null) => {
        const idx = colIndices[key];
        if (idx !== undefined && idx < cells.length) {
          const v = cells[idx];
          return v !== "" ? v : defVal;
        }
        return defVal;
      };

      const rawT = getVal("t_ms");
      const rawTs = getVal("timestamp");
      if (rawTs) {
        if (!firstTs) firstTs = rawTs;
        lastTs = rawTs;
      }

      let tNum = rIdx * 100;
      if (rawT !== null) {
        const parsedT = parseFloat(rawT);
        if (!isNaN(parsedT)) tNum = parsedT;
      }

      if (t0 === null) t0 = tNum;

      const xVal = parseFloat(getVal("x", 0)) || 0;
      const yVal = parseFloat(getVal("y", 0)) || 0;
      const zVal = parseFloat(getVal("z", 1)) || 1;
      const hpVal = parseFloat(getVal("hp", 0)) || 0;
      let rmsVal = parseFloat(getVal("rms", 0)) || 0;
      const freqVal = parseFloat(getVal("freq", 0)) || 0;

      if (rmsVal === 0 && (Math.abs(xVal) > 0.05 || Math.abs(yVal) > 0.05)) {
        rmsVal = Number(Math.sqrt(xVal * xVal + yVal * yVal) * 0.1);
      }

      const rawTremor = getVal("tremor");
      let tremorVal = 0;
      if (rawTremor !== null) {
        if (String(rawTremor).toLowerCase() === "true" || rawTremor === "1") tremorVal = 1;
        else if (String(rawTremor).toLowerCase() === "false" || rawTremor === "0") tremorVal = 0;
        else tremorVal = parseInt(rawTremor, 10) || 0;
      } else {
        tremorVal = rmsVal >= 0.04 ? 1 : 0;
      }

      const rawAlert = getVal("alert");
      let alertVal = 0;
      if (rawAlert !== null) {
        if (String(rawAlert).toLowerCase() === "true" || rawAlert === "1") alertVal = 1;
        else alertVal = parseInt(rawAlert, 10) || 0;
      }

      const btnVal = parseInt(getVal("btn", 0), 10) || 0;
      const rowLabel = getVal("label");
      if (rowLabel && !detectedLabel) detectedLabel = rowLabel;

      const relSec = Number(((tNum - t0) / 1000).toFixed(2));

      parsed.push({
        index: parsed.length,
        t_ms: tNum,
        t_rel_s: relSec,
        time_label: `${relSec}s`,
        x: Number(xVal.toFixed(4)),
        y: Number(yVal.toFixed(4)),
        z: Number(zVal.toFixed(4)),
        hp: Number(hpVal.toFixed(4)),
        rms: Number(rmsVal.toFixed(4)),
        freq: Number(freqVal.toFixed(2)),
        tremor: tremorVal,
        alert: alertVal,
        btn: btnVal,
      });
    }

    if (parsed.length === 0) {
      return { success: false, error: "No valid numeric rows found in CSV.", samples: [], meta: null };
    }

    const durS = parsed.length > 1 ? Number((parsed[parsed.length - 1].t_rel_s - parsed[0].t_rel_s).toFixed(1)) : Number((parsed.length * 0.1).toFixed(1));
    const tremorCount = parsed.filter((s) => s.tremor === 1).length;
    const tremorShare = Number(((tremorCount / parsed.length) * 100).toFixed(1));
    const alertCount = parsed.filter((s) => s.alert === 1).length;

    const meta = {
      filename,
      rows_used: parsed.length,
      rows_skipped: skipped,
      columns_found: headerCols,
      columns_missing: columnsMissing,
      duration_seconds: Math.max(0.1, durS),
      first_timestamp: firstTs || (t0 !== null ? `0.0s (t_ms: ${t0})` : "0.0s"),
      last_timestamp: lastTs || `${durS}s`,
      tremor_share: tremorShare,
      alert_rows: alertCount,
      label: detectedLabel,
    };

    return { success: true, error: null, samples: parsed, meta };
  } catch (e: any) {
    return { success: false, error: `CSV Parsing error: ${e?.message || String(e)}`, samples: [], meta: null };
  }
}

function ValidationContent() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("" );
  const [sessionType, setSessionType] = useState<"normal" | "baseline">("normal");
  const [fileLabel, setFileLabel] = useState<string>("walking");
  const [speed, setSpeed] = useState<number>(1.0);
  const [includeSample, setIncludeSample] = useState<boolean>(false);

  // Replay dataset & playback state
  const [datasetName, setDatasetName] = useState<string>("demo_imu_tremor.csv");
  const [datasetSamples, setDatasetSamples] = useState<any[]>([]);
  const [parseMeta, setParseMeta] = useState<ParseMeta | null>(null);
  const [uploadError, setUploadError] = useState<string>("");

  // Playback cursor state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [vibrationsCount, setVibrationsCount] = useState<number>(0);
  const [vibrationsLog, setVibrationsLog] = useState<string[]>([]);

  // Confirmation modal for saving to database
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [commitSuccessMsg, setCommitSuccessMsg] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Load people (respecting includeSample) & default preset
  useEffect(() => {
    async function loadPeopleList() {
      const pList = await fetchPeople(includeSample);
      setPeople(pList);
      if (pList.length > 0) {
        if (!pList.some((p) => p.id === selectedPersonId)) {
          setSelectedPersonId(pList[0].id);
        }
      } else {
        setSelectedPersonId("");
      }
    }
    loadPeopleList();
  }, [includeSample]);

  useEffect(() => {
    // Load default demo preset on first mount
    handleSelectPreset("demo_tremor");
  }, []);

  // 2. Playback Timer Loop (Smooth Local Clock at Speed Multiplier)
  useEffect(() => {
    if (isPlaying && datasetSamples.length > 0) {
      const intervalMs = Math.max(10, Math.floor(100 / speed)); // 10 Hz at 1x = 100ms
      playbackTimerRef.current = setInterval(() => {
        setCursorIndex((prev) => {
          if (prev >= datasetSamples.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          const currSample = datasetSamples[next];
          // Check if simulated vibration fired
          if (currSample?.alert === 1) {
            setVibrationsCount((c) => c + 1);
            setVibrationsLog((log) => [`[${currSample.time_label}] Haptic alert event detected in recording`, ...log.slice(0, 9)]);
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, speed, datasetSamples]);

  // Preset Selection Handler
  const handleSelectPreset = async (preset: "demo_short" | "demo_tremor") => {
    setIsPlaying(false);
    setCursorIndex(0);
    setUploadError("");
    setCommitSuccessMsg("");

    const res = await loadReplayDataset({ preset });
    if (res.success && res.meta) {
      setDatasetName(res.filename || preset);
      setParseMeta(res.meta);
      setDatasetSamples(res.meta.samples || []);
      if (res.meta.label) setFileLabel(res.meta.label);
    } else if (res.success && res.sampleCount) {
      // Fallback: Generate demo curve
      const samples = [];
      const count = res.sampleCount || 100;
      for (let i = 0; i < count; i++) {
        const t_s = Number((i * 0.1).toFixed(1));
        const isTrem = preset === "demo_tremor" && i > 10 && i < 40;
        samples.push({
          index: i,
          t_ms: i * 100,
          t_rel_s: t_s,
          time_label: `${t_s}s`,
          x: Number((Math.sin(i * 0.5) * (isTrem ? 0.35 : 0.05)).toFixed(4)),
          y: Number((Math.cos(i * 0.5) * (isTrem ? 0.35 : 0.05)).toFixed(4)),
          z: Number((0.98 + Math.sin(i * 0.2) * 0.02).toFixed(4)),
          hp: 0.005,
          rms: Number((isTrem ? 0.075 : 0.015).toFixed(4)),
          freq: isTrem ? 4.8 : 0.0,
          tremor: isTrem ? 1 : 0,
          alert: 0,
          btn: 0,
        });
      }
      setDatasetName(res.filename || preset);
      setDatasetSamples(samples);
      setParseMeta({
        filename: res.filename || preset,
        rows_used: count,
        rows_skipped: 0,
        columns_found: ["t_ms", "x", "y", "z", "rms", "freq", "tremor"],
        columns_missing: [],
        duration_seconds: Number((count * 0.1).toFixed(1)),
        first_timestamp: "0.0s",
        last_timestamp: `${(count * 0.1).toFixed(1)}s`,
        tremor_share: preset === "demo_tremor" ? 30.0 : 0.0,
        alert_rows: 0,
        label: preset === "demo_tremor" ? "shaking" : "still",
      });
    } else {
      setUploadError(res.error || "Failed to load preset dataset.");
    }
  };

  // Custom File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPlaying(false);
    setCursorIndex(0);
    setUploadError("");
    setCommitSuccessMsg("");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = (evt.target?.result as string) || "";
      const clientResult = parseClientCSV(text, file.name);

      if (!clientResult.success) {
        setUploadError(clientResult.error || "CSV parsing error.");
        return;
      }

      setDatasetName(file.name);
      setDatasetSamples(clientResult.samples);
      setParseMeta(clientResult.meta);
      if (clientResult.meta?.label) setFileLabel(clientResult.meta.label);

      // Also notify backend replay source
      await loadReplayDataset({ csvText: text, filename: file.name });
    };
    reader.readAsText(file);
  };

  // Playback Control Handlers
  const handlePlayToggle = () => {
    if (cursorIndex >= datasetSamples.length - 1) {
      setCursorIndex(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCursorIndex(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setCursorIndex(val);
  };

  // Commit session to permanent SQLite database
  const handleCommitSession = async () => {
    if (!selectedPersonId) return;
    setIsCommitting(true);
    setCommitSuccessMsg("");

    const res = await commitValidationSession({
      personId: selectedPersonId,
      sessionType: sessionType,
      label: fileLabel || null,
      note: `Committed from CSV validation (${datasetName})`,
    });

    setIsCommitting(false);
    setShowCommitModal(false);

    if (res.success) {
      setCommitSuccessMsg(res.message || "Successfully committed session to participant history!");
    } else {
      setUploadError(res.error || "Failed to commit session to database.");
    }
  };

  const currentSample = datasetSamples[cursorIndex] || datasetSamples[0] || null;
  const isTremorActive = (currentSample?.tremor ?? 0) === 1;
  const progressPct = datasetSamples.length > 0 ? Math.round((cursorIndex / (datasetSamples.length - 1)) * 100) : 0;

  // Compute tremor window segments for shaded areas on chart
  const tremorSegments: { start: number; end: number }[] = [];
  if (datasetSamples.length > 0) {
    let inTremor = false;
    let segStart = 0;
    for (let i = 0; i < datasetSamples.length; i++) {
      if (datasetSamples[i].tremor === 1 && !inTremor) {
        inTremor = true;
        segStart = datasetSamples[i].t_rel_s;
      } else if (datasetSamples[i].tremor === 0 && inTremor) {
        inTremor = false;
        tremorSegments.push({ start: segStart, end: datasetSamples[i - 1].t_rel_s });
      }
    }
    if (inTremor) {
      tremorSegments.push({ start: segStart, end: datasetSamples[datasetSamples.length - 1].t_rel_s });
    }
  }

  // Downsample static traces if larger than 1200 points for smooth SVG rendering
  const maxDisplayPoints = 1200;
  const step = datasetSamples.length > maxDisplayPoints ? Math.ceil(datasetSamples.length / maxDisplayPoints) : 1;
  const displayTraces = datasetSamples.filter((_, idx) => idx % step === 0 || idx === cursorIndex);

  return (
    <main className="min-h-screen bg-[#F0FDFA] text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TOP SUB-NAVIGATION */}
        <WearableSubNav
          activeTab="validation"
          title="Validation & Playback Engine"
          subtitle="Inspect recorded CSV telemetry, visualize static motion traces, and verify DSP threshold logic"
          badge="Validation"
        />

        {/* 1. DATASET SELECTOR & FILE CONTROLS */}
        <section className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-teal-100 pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#0F766E] uppercase tracking-wider block">
                Active Benchmark Dataset
              </span>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span className="text-base font-black text-slate-800 font-mono">
                  {datasetName}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 font-mono">
                  {datasetSamples.length} samples
                </span>
              </div>
            </div>

            {/* Presets & Upload */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset("demo_tremor")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  datasetName.includes("tremor")
                    ? "bg-[#0F766E] text-white shadow-xs"
                    : "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200"
                }`}
              >
                Preset: Tremor (30s 4.8Hz)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset("demo_short")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  datasetName.includes("short")
                    ? "bg-[#0F766E] text-white shadow-xs"
                    : "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200"
                }`}
              >
                Preset: Short (5s)
              </button>
              <label className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-teal-50 text-slate-700 border border-slate-300 shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
                <span>Upload CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* PARSE ERROR BANNER */}
          {uploadError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* COMMIT SUCCESS BANNER */}
          {commitSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{commitSuccessMsg}</span>
            </div>
          )}

          {/* PARSE SUMMARY METRICS CARD */}
          {parseMeta && (
            <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Rows Parsed</span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {parseMeta.rows_used}
                </span>
                {parseMeta.rows_skipped > 0 && (
                  <span className="text-[10px] text-amber-700 block">({parseMeta.rows_skipped} skipped)</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Duration</span>
                <span className="text-sm font-black text-teal-900 font-mono">
                  {parseMeta.duration_seconds}s
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Share</span>
                <span className="text-sm font-black text-[#0F766E] font-mono">
                  {parseMeta.tremor_share}%
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Alert Rows</span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {parseMeta.alert_rows}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">First Timestamp</span>
                <span className="text-[11px] font-mono text-slate-700 truncate block" title={parseMeta.first_timestamp}>
                  {parseMeta.first_timestamp}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Columns Detected</span>
                <span className="text-[10px] text-teal-800 font-mono block truncate" title={parseMeta.columns_found?.join(", ")}>
                  {parseMeta.columns_found?.length} cols: {parseMeta.columns_found?.slice(0, 4).join(", ")}...
                </span>
              </div>
            </div>
          )}

          {/* PLAYBACK CONTROLS & SEEK SCRUBBER */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  disabled={datasetSamples.length === 0}
                  className={`px-5 py-2 rounded-xl font-bold text-xs shadow-xs flex items-center gap-2 transition-all ${
                    isPlaying
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-[#0F766E] hover:bg-[#0D9488] text-white"
                  } disabled:opacity-50`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>{cursorIndex > 0 ? "Resume" : "Play Recording"}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleStop}
                  disabled={datasetSamples.length === 0 || (!isPlaying && cursorIndex === 0)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Speed Multipliers */}
              <div className="flex items-center gap-1 bg-teal-50/70 p-1 rounded-xl border border-teal-200 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Speed</span>
                {[0.5, 1.0, 2.0, 5.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      speed === s ? "bg-[#0F766E] text-white shadow-xs" : "text-slate-600 hover:bg-teal-100/50"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Seek Scrubbing Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-teal-900 font-bold">
                    Position: {currentSample ? `${currentSample.t_rel_s}s` : "0.0s"}
                  </span>
                  <span className="text-slate-400">
                    (Sample #{cursorIndex + 1} / {datasetSamples.length})
                  </span>
                </div>
                <span className="font-bold text-[#0F766E] font-mono">{progressPct}%</span>
              </div>

              <input
                type="range"
                min={0}
                max={Math.max(0, datasetSamples.length - 1)}
                value={cursorIndex}
                onChange={handleSeek}
                disabled={datasetSamples.length === 0}
                className="w-full accent-[#0F766E] cursor-pointer h-2 bg-teal-100 rounded-lg"
              />
            </div>
          </div>
        </section>

        {/* 2. DUAL CONTINUOUS TRACE CHARTS WITH MOVING CURSOR & LIVE VALUES */}
        <section className="space-y-4">
          
          {/* LIVE VALUE INSPECTOR STRIP AT PLAYBACK CURSOR */}
          <div className="p-3.5 rounded-2xl bg-white/90 border border-teal-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span className="font-bold text-slate-700">Cursor Metrics:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono font-bold">
              <span className="text-[#0D9488]">X: {currentSample ? `${currentSample.x.toFixed(3)}g` : "-"}</span>
              <span className="text-[#F59E0B]">Y: {currentSample ? `${currentSample.y.toFixed(3)}g` : "-"}</span>
              <span className="text-[#6366F1]">Z: {currentSample ? `${currentSample.z.toFixed(3)}g` : "-"}</span>
              <span className="text-[#0F766E]">RMS: {currentSample ? `${currentSample.rms.toFixed(4)}g` : "-"}</span>
              <span className="text-slate-800">Rhythm: {currentSample ? `${currentSample.freq.toFixed(1)} Hz` : "-"}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  isTremorActive ? "bg-amber-200 text-amber-950" : "bg-teal-100 text-teal-900"
                }`}
              >
                {isTremorActive ? "Tremor Active" : "Normal"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* XYZ CONTINUOUS TRACE ACCELERATION CHART */}
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0F766E]" />
                  <h2 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                    Triaxial Acceleration Traces (X, Y, Z)
                  </h2>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Relative Time (s)</span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayTraces} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CCFBF1" vertical={false} />
                    <XAxis dataKey="t_rel_s" stroke="#0D9488" fontSize={9} tickFormatter={(val) => `${val}s`} />
                    <YAxis stroke="#0D9488" fontSize={9} domain={[-2, 2]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0F766E", color: "#fff", borderRadius: "8px", fontSize: "10px" }}
                      labelFormatter={(label) => `Time: ${label}s`}
                    />
                    {currentSample && (
                      <ReferenceLine
                        x={currentSample.t_rel_s}
                        stroke="#0F766E"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{ value: "Cursor", fill: "#0F766E", fontSize: 9, position: "top" }}
                      />
                    )}
                    <Line type="monotone" dataKey="x" stroke="#0D9488" strokeWidth={1.5} dot={false} isAnimationActive={false} name="X (g)" />
                    <Line type="monotone" dataKey="y" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Y (g)" />
                    <Line type="monotone" dataKey="z" stroke="#6366F1" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Z (g)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RMS MOVEMENT STRENGTH CHART WITH TREMOR WINDOWS */}
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[#0F766E]" />
                  <h2 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                    Signal Strength (RMS) &amp; Tremor Windows
                  </h2>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Threshold: {TREMOR_RMS_G}g</span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayTraces} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CCFBF1" vertical={false} />
                    <XAxis dataKey="t_rel_s" stroke="#0D9488" fontSize={9} tickFormatter={(val) => `${val}s`} />
                    <YAxis stroke="#0D9488" fontSize={9} domain={[0, 0.25]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0F766E", color: "#fff", borderRadius: "8px", fontSize: "10px" }}
                      labelFormatter={(label) => `Time: ${label}s`}
                    />
                    <ReferenceLine
                      y={TREMOR_RMS_G}
                      stroke="#E11D48"
                      strokeDasharray="4 4"
                      label={{ value: `Threshold (${TREMOR_RMS_G}g)`, fill: "#BE123C", fontSize: 9, position: "insideTopRight" }}
                    />
                    {currentSample && (
                      <ReferenceLine
                        x={currentSample.t_rel_s}
                        stroke="#0F766E"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    )}
                    {/* Shaded Tremor Windows */}
                    {tremorSegments.map((seg, sIdx) => (
                      <ReferenceArea
                        key={sIdx}
                        x1={seg.start}
                        x2={seg.end}
                        fill="#F59E0B"
                        fillOpacity={0.18}
                      />
                    ))}
                    <Line type="monotone" dataKey="rms" stroke="#0F766E" strokeWidth={2} dot={false} isAnimationActive={false} name="RMS (g)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* 3. PER-FILE VALIDATION RESULTS & DATABASE COMMIT ACTION */}
        <section className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-teal-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F766E] uppercase tracking-wider">
                Validation Summary &amp; Session Storage
              </h3>
              <p className="text-xs text-slate-500">
                Verify computed metrics against dataset ground truth and optionally persist as a recorded session
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Valid Monitored Duration</span>
              <div className="text-xl font-black text-slate-900 font-mono">
                {parseMeta ? `${parseMeta.duration_seconds}s` : "—"}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {datasetSamples.length} verified kinematic points
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Share (3-8 Hz)</span>
              <div className="text-xl font-black text-[#0F766E] font-mono">
                {parseMeta ? `${parseMeta.tremor_share}%` : "—"}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Proportion exceeding 0.04g threshold
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Activity Label</span>
              <select
                value={fileLabel}
                onChange={(e) => setFileLabel(e.target.value)}
                className="w-full bg-white border border-teal-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="walking">Walking</option>
                <option value="typing">Typing</option>
                <option value="still">Still (Resting)</option>
                <option value="shaking">Shaking (Tremor Imitation)</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex flex-col justify-end space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Assign Participant</span>
                <label className="flex items-center gap-1 text-[10px] text-slate-600 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSample}
                    onChange={(e) => setIncludeSample(e.target.checked)}
                    className="accent-[#0F766E] rounded"
                  />
                  <span>Include sample data</span>
                </label>
              </div>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full bg-white border border-teal-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.display_name ? `(${p.display_name})` : ""} {p.is_sample ? "★ [SAMPLE DATA (synthetic)]" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-teal-100">
            <button
              type="button"
              onClick={() => setShowCommitModal(true)}
              disabled={datasetSamples.length === 0 || !selectedPersonId}
              className="py-2.5 px-5 rounded-2xl text-xs font-black bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Add to Validation Table / Save Session</span>
            </button>
          </div>
        </section>

        {/* CONFIRMATION MODAL TO COMMIT VALIDATION SESSION */}
        {showCommitModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in duration-200">
              <div className="flex items-center gap-2 border-b border-teal-100 pb-3">
                <FlaskConical className="w-5 h-5 text-[#0F766E]" />
                <h3 className="text-base font-black text-slate-900">Confirm Session Storage</h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Save this dataset (<strong className="font-mono">{datasetName}</strong>, {datasetSamples.length} samples) as a permanent recorded session for participant{" "}
                <strong className="text-teal-900 font-bold">
                  {people.find((p) => p.id === selectedPersonId)?.code || "Selected"}
                </strong>
                ?
              </p>

              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 text-xs space-y-1">
                <div>Activity Tag: <strong className="capitalize">{fileLabel}</strong></div>
                <div>Duration: <strong className="font-mono">{parseMeta?.duration_seconds}s</strong></div>
                <div>Tremor Share: <strong className="text-[#0F766E] font-bold">{parseMeta?.tremor_share}%</strong></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-100">
                <button
                  type="button"
                  onClick={() => setShowCommitModal(false)}
                  disabled={isCommitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitSession}
                  disabled={isCommitting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs flex items-center gap-1.5"
                >
                  {isCommitting ? "Saving..." : "Confirm & Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. FOOTER */}
        <footer className="text-center text-xs text-slate-500 space-y-1 pt-4 pb-6 border-t border-teal-200">
          <p className="font-semibold text-slate-700">{DISCLAIMER_TEXT}</p>
          <p className="text-[10px] text-slate-400">
            Steady Telemetry Validation Sandbox · Configurable Rate Simulation Engine · Firmware DSP Testing Suite
          </p>
        </footer>
      </div>
    </main>
  );
}

export default function WearableValidationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0FDFA] p-8 text-center text-xs text-slate-500">Loading validation sandbox...</div>}>
      <ValidationContent />
    </Suspense>
  );
}
