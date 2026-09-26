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
import { getSeverity, fetchSeverityAsync, SeverityResult } from "@/lib/severity";
import { getCueHistory, CueResult } from "@/lib/cues";
import { CueLabIcon } from "@/components/icons/CueLabIcon";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
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
  Clock,
  Gauge,
  Info,
  Scale,
  Stethoscope,
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
} from "recharts";

type TimeRange = "7d" | "30d" | "3m";

export default function ProgressTimelinePage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<TimeRange>("30d");

  const [severity, setSeverity] = useState<SeverityResult>(() => getSeverity(isDemoMode));

  useEffect(() => {
    setMounted(true);
    let active = true;
    async function loadSeverity() {
      const s = await fetchSeverityAsync(isDemoMode);
      if (active) setSeverity(s);
    }
    loadSeverity();
    return () => { active = false; };
  }, [isDemoMode]);

  const allSessions = useMemo(() => {
    if (!mounted) return [];
    return getSessions(isDemoMode);
  }, [isDemoMode, mounted]);

  const baseline = useMemo(() => {
    if (!mounted) return null;
    return getBaseline(undefined, isDemoMode);
  }, [isDemoMode, mounted]);

  const maxAgeMs = useMemo(() => {
    const daysMap = { "7d": 7, "30d": 30, "3m": 90 };
    return daysMap[range] * 24 * 60 * 60 * 1000;
  }, [range]);

  const filteredSessions = useMemo(() => {
    if (!mounted || allSessions.length === 0) return [];
    const now = Date.now();
    return allSessions.filter(
      (s) => now - new Date(s.timestamp).getTime() <= maxAgeMs
    );
  }, [allSessions, maxAgeMs, mounted]);

  const cueHistory = useMemo(() => {
    if (!mounted) return [];
    return getCueHistory(isDemoMode);
  }, [isDemoMode, mounted]);

  const chartData = useMemo(() => {
    return filteredSessions.map((s) => {
      const dateObj = new Date(s.timestamp);
      return {
        id: s.id,
        date: dateObj.toLocaleDateString([], { month: "numeric", day: "numeric" }),
        tremorAmp: s.tremor.amplitude,
        cadence: s.gait?.cadence || 108,
      };
    });
  }, [filteredSessions]);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4 text-left">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                Progress Timeline
              </h1>
              <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                Core 2
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Severity tracking &amp; longitudinal baseline changes
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
            className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
              range === "7d"
                ? "bg-white text-[#2563EB] shadow-xs font-medium"
                : "text-[#64748B] hover:text-[#172554] font-normal"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setRange("30d")}
            className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
              range === "30d"
                ? "bg-white text-[#2563EB] shadow-xs font-medium"
                : "text-[#64748B] hover:text-[#172554] font-normal"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setRange("3m")}
            className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
              range === "3m"
                ? "bg-white text-[#2563EB] shadow-xs font-medium"
                : "text-[#64748B] hover:text-[#172554] font-normal"
            }`}
          >
            3 Months
          </button>
        </div>
      </header>

      {/* 3-SYMPTOM TRAFFIC LIGHT ROW LABELED "COMPARED TO YOUR USUAL" */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#2563EB]" />
            <div>
              <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
                <span>Severity Meter</span>
                {severity.isOfflineFallback && (
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-semibold normal-case">
                    Offline estimate
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#64748B] italic font-normal">
                Compared to your usual
              </p>
            </div>
          </div>
          <ConfidenceBadge level={severity.confidence} reason={severity.confidenceReason} />
        </div>

        {/* 3-Symptom Traffic Light Row */}
        <div className="space-y-2">
          {/* Tremor Traffic Light */}
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#6366F1]" />
              <span className="text-xs font-semibold text-[#172554]">Resting Tremor</span>
            </div>
            <StatusDot
              status={severity.tremor.level === "mild" ? "good" : severity.tremor.level === "moderate" ? "warning" : "danger"}
              label={severity.tremor.level === "mild" ? "Mild" : severity.tremor.level === "moderate" ? "Moderate" : "Elevated"}
              size="sm"
            />
          </div>

          {/* Slowness (Bradykinesia) Traffic Light */}
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-xs font-semibold text-[#172554]">Movement Slowness</span>
            </div>
            <StatusDot
              status={severity.slowness.level === "mild" ? "good" : severity.slowness.level === "moderate" ? "warning" : "danger"}
              label={severity.slowness.level === "mild" ? "Mild" : severity.slowness.level === "moderate" ? "Moderate" : "Elevated"}
              size="sm"
            />
          </div>

          {/* Freezing Traffic Light */}
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-semibold text-[#172554]">Gait Hesitation / Freezing</span>
            </div>
            <StatusDot
              status={severity.freezing.level === "mild" ? "good" : severity.freezing.level === "moderate" ? "warning" : "danger"}
              label={severity.freezing.level === "mild" ? "Mild" : severity.freezing.level === "moderate" ? "Moderate" : "Elevated"}
              size="sm"
            />
          </div>
        </div>
      </Card>

      {/* LONGITUDINAL TREMOR TREND CHART WITH BASELINE BAND */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#6366F1]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Tremor Trend vs. Personal Baseline
            </h2>
          </div>
          <span className="text-[10px] text-[#8B5CF6] bg-purple-50 px-2 py-0.5 rounded-full font-medium">
            Purple: Baseline
          </span>
        </div>

        <div className="h-44 w-full bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis unit="m/s²" tick={{ fontSize: 10 }} domain={[0.1, 0.45]} />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />

              {/* Shaded Normal Range Band around baseline */}
              {baseline && (
                <ReferenceArea
                  y1={baseline.tremorAmplitudeMean * 0.85}
                  y2={baseline.tremorAmplitudeMean * 1.15}
                  fill="#8B5CF6"
                  fillOpacity={0.12}
                />
              )}

              {/* Dashed Purple Baseline Reference Line */}
              {baseline && (
                <ReferenceLine
                  y={baseline.tremorAmplitudeMean}
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

              <Line
                type="monotone"
                dataKey="tremorAmp"
                name="Tremor Amplitude"
                stroke="#6366F1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366F1" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* SESSION LIST WITH COLORED DOT + "CHANGE FROM BASELINE" INDICATOR PER ROW */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between pl-1">
          <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Recorded Sessions &amp; Change from Baseline
          </h2>
          <span className="text-[11px] text-[#64748B]">
            {filteredSessions.length} sessions
          </span>
        </div>

        <div className="space-y-2.5">
          {filteredSessions.map((session) => {
            const dateObj = new Date(session.timestamp);
            const dateFormatted = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timeFormatted = dateObj.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });

            const comparison = getChangeFromBaseline(session, isDemoMode);
            const tremorChange = comparison?.tremorAmplitude;
            const isBetter = tremorChange?.direction === "better";
            const isWorse = tremorChange?.direction === "worse";
            const isSimulatedSession = session.source === "seed" || session.source === "demo" || (session as any).source === "simulated" || (session as any).simulated || isDemoMode;

            return (
              <div
                key={session.id}
                onClick={() => router.push(`/fingerprint?session=${session.id}`)}
                className="p-3.5 bg-white rounded-[18px] border-[0.5px] border-[#E2E8F0] hover:border-[#2563EB] hover:shadow-xs transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-semibold text-[#172554]">
                      {dateFormatted} at {timeFormatted}
                    </span>
                    {isSimulatedSession && (
                      <span className="text-[10px] bg-indigo-50 text-[#6366F1] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                        Simulated
                      </span>
                    )}
                  </div>
                  <ConfidenceBadge level={session.tremor.confidence} showText={false} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={session.tremor.intensity === "mild" ? "good" : session.tremor.intensity === "moderate" ? "warning" : "danger"}
                      label={`${session.tremor.frequencyHz} Hz`}
                      size="sm"
                    />
                    <span className="text-[#64748B]">
                      {session.tremor.amplitude} m/s²
                    </span>
                  </div>

                  {/* Change From Baseline Indicator per row */}
                  <div>
                    {tremorChange ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border-[0.5px] ${
                          isBetter
                            ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                            : isWorse
                            ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {isBetter && `↓ ${Math.abs(tremorChange.pctChange)}% from baseline`}
                        {isWorse && `↑ ${Math.abs(tremorChange.pctChange)}% from baseline`}
                        {!isBetter && !isWorse && "→ Similar to baseline"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#64748B]">Baseline calibration</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADAPTIVE CUE CALIBRATIONS TIMELINE */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CueLabIcon size={18} className="text-[#6366F1]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Adaptive Cue Calibrations
            </h2>
          </div>
          <span className="text-[11px] text-[#64748B]">{cueHistory.length} trials</span>
        </div>

        <div className="space-y-2">
          {cueHistory.slice(-4).reverse().map((cue) => {
            const cDate = new Date(cue.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return (
              <div
                key={cue.id}
                className="p-3 bg-[#F8FAFC] rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#172554] capitalize">{cue.type} Beat ({cue.bpm} BPM)</span>
                  {(cue.simulated !== false) && (
                    <span className="text-[10px] bg-indigo-50 text-[#6366F1] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                      Simulated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[#64748B]">{cDate}</span>
                  <span className="font-semibold text-[#2563EB]">{cue.responseScore}% Sync</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
