"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  Session,
  getSessions,
  getBaseline,
  getChangeFromBaseline,
} from "@/lib/sessions";
import {
  DiaryEntry,
  DoseLog,
  getDiaryEntries,
  getDoseLogs,
} from "@/lib/diary";
import { getCueHistory, CueResult } from "@/lib/cues";
import { buildResponseCurve, ResponseCurveResult } from "@/lib/responseCurve";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  TrendingUp,
  Activity,
  Footprints,
  Brain,
  Calendar,
  Sparkles,
  ArrowRight,
  Pill,
  BookOpen,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Smile,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";

type TimeRange = "7d" | "30d" | "3m";
type TimelineFilter = "all" | "sessions" | "diary" | "doses" | "cues";

interface TimelineItem {
  id: string;
  type: "session" | "diary" | "dose" | "cue";
  timestamp: string;
  session?: Session;
  diary?: DiaryEntry;
  dose?: DoseLog;
  cue?: CueResult;
}

const MOOD_EMOJIS: Record<number, string> = {
  4: "😊",
  3: "🙂",
  2: "😐",
  1: "😔",
};

const SYMPTOM_LABELS = ["None", "Mild", "Mod", "High"];

export default function ProgressPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<TimeRange>("30d");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data
  const allSessions = useMemo(() => {
    if (!mounted) return [];
    return getSessions(isDemoMode);
  }, [isDemoMode, mounted]);

  const allDiaryEntries = useMemo(() => {
    if (!mounted) return [];
    return getDiaryEntries(isDemoMode);
  }, [isDemoMode, mounted]);

  const allDoseLogs = useMemo(() => {
    if (!mounted) return [];
    return getDoseLogs(isDemoMode);
  }, [isDemoMode, mounted]);

  // Compute Response Curve
  const responseCurve: ResponseCurveResult = useMemo(() => {
    if (!mounted) {
      return {
        bins: [],
        bestWindow: null,
        worstWindow: null,
        sampleCount: 0,
        coverageLevel: "none",
      };
    }
    return buildResponseCurve(isDemoMode);
  }, [isDemoMode, mounted]);

  // Range max age ms
  const maxAgeMs = useMemo(() => {
    const daysMap = { "7d": 7, "30d": 30, "3m": 90 };
    return daysMap[range] * 24 * 60 * 60 * 1000;
  }, [range]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (!mounted || allSessions.length === 0) return [];
    const now = Date.now();
    return allSessions.filter(
      (s) => now - new Date(s.timestamp).getTime() <= maxAgeMs
    );
  }, [allSessions, maxAgeMs, mounted]);

  // Filtered Diary Entries
  const filteredDiary = useMemo(() => {
    if (!mounted || allDiaryEntries.length === 0) return [];
    const now = Date.now();
    return allDiaryEntries.filter(
      (e) => now - new Date(e.timestamp).getTime() <= maxAgeMs
    );
  }, [allDiaryEntries, maxAgeMs, mounted]);

  // Filtered Dose Logs
  const filteredDoses = useMemo(() => {
    if (!mounted || allDoseLogs.length === 0) return [];
    const now = Date.now();
    return allDoseLogs.filter(
      (d) => now - new Date(d.timestamp).getTime() <= maxAgeMs
    );
  }, [allDoseLogs, maxAgeMs, mounted]);

  // Cue History Results
  const allCueResults = useMemo(() => {
    if (!mounted) return [];
    return getCueHistory(isDemoMode);
  }, [isDemoMode, mounted]);

  const filteredCues = useMemo(() => {
    if (!mounted || allCueResults.length === 0) return [];
    const now = Date.now();
    return allCueResults.filter(
      (c) => now - new Date(c.timestamp).getTime() <= maxAgeMs
    );
  }, [allCueResults, maxAgeMs, mounted]);

  // Overall Baseline
  const overallBaseline = useMemo(() => {
    if (!mounted) return null;
    return getBaseline(undefined, isDemoMode);
  }, [isDemoMode, mounted]);

  // Tremor Chart Data
  const chartData = useMemo(() => {
    return filteredSessions.map((s) => {
      const dateObj = new Date(s.timestamp);
      return {
        id: s.id,
        date: dateObj.toLocaleDateString([], { month: "numeric", day: "numeric" }),
        timestampIso: s.timestamp,
        tremorAmp: s.tremor.amplitude,
        tremorFreq: s.tremor.frequencyHz,
        cadence: s.gait?.cadence || null,
        eegBeta: s.eeg?.beta || null,
      };
    });
  }, [filteredSessions]);

  // Unique chart date ticks matching doses
  const doseChartMarkers = useMemo(() => {
    const datesWithDoses = new Set<string>();
    filteredDoses.forEach((d) => {
      const dObj = new Date(d.timestamp);
      const dateKey = dObj.toLocaleDateString([], { month: "numeric", day: "numeric" });
      datesWithDoses.add(dateKey);
    });
    return Array.from(datesWithDoses);
  }, [filteredDoses]);

  // Combined Interleaved Timeline
  const groupedTimeline = useMemo(() => {
    const items: TimelineItem[] = [];

    if (timelineFilter === "all" || timelineFilter === "sessions") {
      filteredSessions.forEach((s) =>
        items.push({ id: s.id, type: "session", timestamp: s.timestamp, session: s })
      );
    }
    if (timelineFilter === "all" || timelineFilter === "diary") {
      filteredDiary.forEach((e) =>
        items.push({ id: e.id, type: "diary", timestamp: e.timestamp, diary: e })
      );
    }
    if (timelineFilter === "all" || timelineFilter === "doses") {
      filteredDoses.forEach((d) =>
        items.push({ id: d.id, type: "dose", timestamp: d.timestamp, dose: d })
      );
    }
    if (timelineFilter === "all" || timelineFilter === "cues") {
      filteredCues.forEach((c) =>
        items.push({ id: c.id, type: "cue", timestamp: c.timestamp, cue: c })
      );
    }

    // Sort descending by timestamp
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Group by date string
    const groups: { [dateStr: string]: TimelineItem[] } = {};
    items.forEach((item) => {
      const dateObj = new Date(item.timestamp);
      const dateKey = dateObj.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });

    return groups;
  }, [filteredSessions, filteredDiary, filteredDoses, timelineFilter]);

  const hasGaitData = filteredSessions.some((s) => s.gait && s.gait.cadence);
  const hasEEGData = filteredSessions.some((s) => s.eeg && s.eeg.beta);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              My Progress
            </h1>
            <p className="text-xs text-[#64748B]">Symptom trends over time</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
            <TrendingUp className="w-6 h-6" />
          </div>
        </header>
        <Card className="animate-pulse py-12 text-center text-slate-400">
          Loading progress history & response curve...
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-20">
      {/* Header & Range Selector Toggle */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                My Progress
              </h1>
              {isDemoMode && (
                <span className="text-[10px] bg-amber-100 text-[#D97706] border border-amber-200 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                  <span>Demo data</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              {filteredSessions.length} sessions • {filteredDiary.length} check-ins • {filteredDoses.length} doses
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* 7 Days | 30 Days | 3 Months Range Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setRange("7d")}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              range === "7d"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-slate-500 hover:text-[#172554]"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setRange("30d")}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              range === "30d"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-slate-500 hover:text-[#172554]"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setRange("3m")}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              range === "3m"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-slate-500 hover:text-[#172554]"
            }`}
          >
            3 Months
          </button>
        </div>
      </header>

      {/* TREMOR OVER TIME CHART (With Dose Markers) */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#6366F1]" />
            <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
              Tremor Amplitude Over Time
            </h2>
          </div>
          <span className="text-[10px] text-[#6366F1] bg-indigo-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <Pill className="w-3 h-3 text-[#6366F1]" />
            <span>Dose Markers</span>
          </span>
        </div>

        <div className="h-44 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis unit="m/s²" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />

              {/* Shaded Normal Range Band around baseline */}
              {overallBaseline && (
                <ReferenceArea
                  y1={overallBaseline.tremorAmplitudeMean * 0.85}
                  y2={overallBaseline.tremorAmplitudeMean * 1.15}
                  fill="#8B5CF6"
                  fillOpacity={0.12}
                  label=""
                />
              )}

              {/* Dashed Purple Baseline Reference Line */}
              {overallBaseline && (
                <ReferenceLine
                  y={overallBaseline.tremorAmplitudeMean}
                  stroke="#8B5CF6"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "Baseline",
                    fill: "#8B5CF6",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              )}

              {/* Dose Log Markers (Vertical Dashed Lines) */}
              {doseChartMarkers.map((dateTick, idx) => (
                <ReferenceLine
                  key={`dose_marker_${idx}`}
                  x={dateTick}
                  stroke="#6366F1"
                  strokeDasharray="2 2"
                  strokeWidth={1.2}
                  label={{
                    value: "💊",
                    fontSize: 10,
                    position: "top",
                  }}
                />
              ))}

              <Line
                type="monotone"
                dataKey="tremorAmp"
                name="Tremor Amp (m/s²)"
                stroke="#6366F1"
                strokeWidth={2}
                activeDot={{ r: 5 }}
                dot={{ r: 3, fill: "#6366F1" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* YOUR RESPONSE CURVE CHART (Hours Since Dose vs Movement Difficulty) */}
      <Card className="space-y-3.5 bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/30 border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-100 text-[#8B5CF6]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                Your Response Curve
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Hours since dose vs movement difficulty
              </p>
            </div>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              responseCurve.coverageLevel === "ok"
                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : responseCurve.coverageLevel === "low"
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {responseCurve.coverageLevel === "ok"
              ? "OK Coverage"
              : responseCurve.coverageLevel === "low"
              ? "Low Data"
              : "No Data"}
          </span>
        </div>

        {/* Windows Summary Badges */}
        {responseCurve.bestWindow || responseCurve.worstWindow ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {responseCurve.bestWindow && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <span className="text-[10px] uppercase font-extrabold text-emerald-600 block">
                  ✨ Peak ON Window
                </span>
                <span className="font-bold text-xs">
                  {responseCurve.bestWindow.startHours}h – {responseCurve.bestWindow.endHours}h post-dose
                </span>
              </div>
            )}
            {responseCurve.worstWindow && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <span className="text-[10px] uppercase font-extrabold text-amber-600 block">
                  ⚠️ Wearing-Off State
                </span>
                <span className="font-bold text-xs">
                  {responseCurve.worstWindow.startHours}h – {responseCurve.worstWindow.endHours}h post-dose
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* Response Curve Chart */}
        <div className="h-44 w-full bg-white/90 p-2 rounded-2xl border border-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={responseCurve.bins} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="hoursLabel" tick={{ fontSize: 10 }} />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => `${Math.round(val * 100)}%`}
              />
              <Tooltip
                contentStyle={{ fontSize: "12px", borderRadius: "12px" }}
                formatter={(val: any) => [`${Math.round(Number(val) * 100)}% Difficulty`, "Movement Difficulty"]}
              />

              {/* Shaded Standard Deviation Band */}
              <Area
                type="monotone"
                dataKey="maxScore"
                stroke="none"
                fill="#8B5CF6"
                fillOpacity={0.15}
                name="Std Dev Band"
              />

              {/* Mean Response Curve Line */}
              <Line
                type="monotone"
                dataKey="meanScore"
                name="Difficulty Score"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#8B5CF6" }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* WALKING CADENCE CHART (If Gait Present) */}
      {hasGaitData && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                Walking Cadence Trend
              </h2>
            </div>
            <span className="text-[10px] text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
              steps/min
            </span>
          </div>

          <div className="h-36 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="cadence"
                  name="Cadence"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10B981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* EEG BETA POWER CHART (If EEG Present) */}
      {hasEEGData && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#06B6D4]" />
              <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                EEG Beta Power (13-30 Hz)
              </h2>
            </div>
            <span className="text-[10px] text-[#06B6D4] bg-cyan-50 px-2 py-0.5 rounded-full font-bold">
              Beta Power
            </span>
          </div>

          <div className="h-36 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="eegBeta"
                  name="Beta Power"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#06B6D4" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* TIMELINE SECTION WITH INTERLEAVED EVENTS & FILTER CHIPS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider pl-1">
            Timeline (Newest First)
          </h2>

          {/* Filter Chips: All | Sessions | Diary | Doses | Cues */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[11px] font-semibold flex-wrap gap-1">
            {(["all", "sessions", "diary", "doses", "cues"] as TimelineFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTimelineFilter(f)}
                className={`px-2 py-0.5 rounded-lg capitalize transition-all ${
                  timelineFilter === f
                    ? "bg-white text-[#2563EB] shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {Object.keys(groupedTimeline).length === 0 ? (
          <Card className="text-center py-8 text-xs text-slate-400">
            No events match the selected filter.
          </Card>
        ) : (
          Object.entries(groupedTimeline).map(([dateStr, items]) => (
            <div key={dateStr} className="space-y-2">
              <div className="text-xs font-bold text-[#172554] flex items-center gap-1.5 pt-2">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{dateStr}</span>
              </div>

              <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3">
                {items.map((item) => {
                  const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  /* RENDER SESSION EVENT ROW */
                  if (item.type === "session" && item.session) {
                    const s = item.session;
                    const change = getChangeFromBaseline(s);
                    return (
                      <div
                        key={s.id}
                        onClick={() => router.push(`/fingerprint?session=${s.id}`)}
                        className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172554]">📊 {timeStr}</span>
                            <span className="text-[10px] bg-blue-50 text-[#2563EB] font-bold px-2 py-0.5 rounded-full">
                              Session
                            </span>
                            {s.source === "live" ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span>Live</span>
                              </span>
                            ) : s.source === "seed" || s.source === "demo" ? (
                              <span className="text-[10px] bg-amber-100 text-[#D97706] border border-amber-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-[#F59E0B]" />
                                <span>Demo</span>
                              </span>
                            ) : null}
                          </div>
                          <ConfidenceBadge
                            level={s.tremor.confidence}
                            reason={s.tremor.confidenceReason}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-[#6366F1]" />
                            <span className="font-semibold text-[#172554]">
                              {s.tremor.frequencyHz} Hz
                            </span>

                            {change?.tremorAmplitude ? (
                              <span
                                className={`font-bold ml-1 ${
                                  change.tremorAmplitude.direction === "better"
                                    ? "text-emerald-600"
                                    : change.tremorAmplitude.direction === "worse"
                                    ? "text-amber-600"
                                    : "text-slate-500"
                                }`}
                              >
                                {change.tremorAmplitude.direction === "better" &&
                                  `Tremor ↓ ${Math.abs(change.tremorAmplitude.pctChange)}%`}
                                {change.tremorAmplitude.direction === "worse" &&
                                  `Tremor ↑ ${Math.abs(change.tremorAmplitude.pctChange)}%`}
                                {change.tremorAmplitude.direction === "similar" &&
                                  `Tremor ~ ${Math.abs(change.tremorAmplitude.pctChange)}%`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium ml-1">
                                ({s.tremor.intensity})
                              </span>
                            )}
                          </div>

                          {s.gait && (
                            <div className="flex items-center gap-1 text-[#10B981] font-semibold">
                              <Footprints className="w-3.5 h-3.5" />
                              <span>{s.gait.cadence} steps/min</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  /* RENDER DIARY CHECK-IN EVENT ROW */
                  if (item.type === "diary" && item.diary) {
                    const e = item.diary;
                    const moodEmoji = MOOD_EMOJIS[e.mood] || "🙂";
                    return (
                      <div
                        key={e.id}
                        className="p-3 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172554]">📝 {timeStr}</span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                              Diary Entry
                            </span>
                            {e.source === "seed" && (
                              <span className="text-[10px] bg-amber-100 text-[#D97706] font-bold px-2 py-0.5 rounded-full">
                                Demo
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-700">
                            Mood {moodEmoji} • Fatigue {e.fatigue}/5
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 bg-emerald-50/40 px-2.5 py-1 rounded-xl border border-emerald-100 flex items-center justify-between">
                          <span>
                            Symptoms: Tremor {SYMPTOM_LABELS[e.symptoms.tremor]} • Slowness{" "}
                            {SYMPTOM_LABELS[e.symptoms.slowness]} • Freezing{" "}
                            {SYMPTOM_LABELS[e.symptoms.freezing]}
                          </span>
                          {e.sleepHours !== undefined && (
                            <span className="font-semibold text-purple-700 ml-2">
                              🌙 {e.sleepHours}h ({e.sleepQuality}★)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  /* RENDER DOSE LOG EVENT ROW */
                  if (item.type === "dose" && item.dose) {
                    const d = item.dose;
                    return (
                      <div
                        key={d.id}
                        className="p-2.5 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="font-bold text-[#172554]">💊 Dose Logged at {timeStr}</span>
                          {d.source === "seed" && (
                            <span className="text-[9px] bg-amber-100 text-[#D97706] font-bold px-1.5 py-0.2 rounded-md">
                              Demo
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            d.onOff === "on"
                              ? "bg-emerald-500 text-white"
                              : d.onOff === "off"
                              ? "bg-amber-500 text-white"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {d.onOff ? `${d.onOff.toUpperCase()} State` : "Dose Logged"}
                        </span>
                      </div>
                    );
                  }

                  /* RENDER CUE TEST EVENT ROW */
                  if (item.type === "cue" && item.cue) {
                    const c = item.cue;
                    const responseLabel =
                      c.responseScore >= 75 ? "Strong" : c.responseScore >= 55 ? "Good" : "Weak";
                    const badgeColor =
                      c.responseScore >= 75
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : c.responseScore >= 55
                        ? "bg-blue-100 text-blue-800 border-blue-200"
                        : "bg-amber-100 text-amber-800 border-amber-200";
                    const cueTypeName = c.type.charAt(0).toUpperCase() + c.type.slice(1);

                    return (
                      <div
                        key={c.id}
                        className="p-2.5 bg-purple-50/70 rounded-2xl border border-purple-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#172554]">
                            🎵 Cue tested: {cueTypeName} {c.bpm} BPM, {responseLabel}
                          </span>
                          {c.source === "seed" && (
                            <span className="text-[9px] bg-amber-100 text-[#D97706] font-bold px-1.5 py-0.2 rounded-md">
                              Demo
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
                        >
                          Score {c.responseScore}/100
                        </span>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Note */}
      <footer className="text-center py-6 border-t border-slate-200 text-slate-500 text-xs font-medium mt-6">
        Sample data shown for demonstration. MovePilot is not a diagnostic tool.
      </footer>
    </div>
  );
}
