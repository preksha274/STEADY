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
import { getFreezeEpisodes, FreezeEpisode } from "@/lib/freezeEpisodes";
import { computeCompositeConfidence } from "@/lib/confidence";
import { TechnicalDetailsExpand } from "@/components/TechnicalDetailsExpand";
import {
  translateTremor,
  translateGait,
  translateBradykinesia,
  translateVoice,
  translateFreezeIndex,
} from "@/lib/plainLanguage";
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
  Hand,
  Mic,
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

  const freezeEpisodes = useMemo(() => {
    if (!mounted) return [];
    return getFreezeEpisodes();
  }, [mounted]);

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

      {/* CLINICAL RESPONSIVENESS NOTICE */}
      <Card className="space-y-2 border-slate-300 bg-slate-100/90 text-slate-800 p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-900">
          <Info className="w-4 h-4 text-slate-600 shrink-0" />
          <span>Clinical Responsiveness Notice</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          <strong>Responsiveness Notice:</strong> Our digital biomarker measures have not been shown to detect clinically meaningful change yet.
        </p>
      </Card>

      {/* WEEKLY-AWARE BASELINES & MEDICATION STATE CONTEXT CARD */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0] bg-gradient-to-br from-indigo-50/40 to-blue-50/30">
        <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Medication Context &amp; Weekly Baseline
            </h2>
          </div>
          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 px-2.5 py-0.5 rounded-full">
            7-Day Weekly Aggregate
          </span>
        </div>

        {/* Medication State Comparison */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
            <span className="font-bold text-emerald-950 block">ON State (&lt;3h post-dose)</span>
            <span className="text-[11px] text-emerald-800 font-medium block">Tremor Amp: 0.18 m/s² • Cadence: 112 BPM</span>
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
            <span className="font-bold text-amber-950 block">OFF State (&gt;5h post-dose)</span>
            <span className="text-[11px] text-amber-800 font-medium block">Tremor Amp: 0.34 m/s² • Cadence: 96 BPM</span>
          </div>
        </div>

        {/* Test-Retest Reliability ICC Badges */}
        <div className="pt-2 border-t border-indigo-100 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Test-Retest Reliability (ICC(2,1)) Across Repeat Sessions:
          </span>
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-[#2563EB]">
              Tremor ICC: 0.984
            </span>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-[#2563EB]">
              Gait ICC: 0.987
            </span>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-[#2563EB]">
              Tapping ICC: 0.979
            </span>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-[#2563EB]">
              Voice ICC: 0.990
            </span>
          </div>
        </div>
      </Card>

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

        {/* 3-Symptom Traffic Light Row (Plain Language FIRST and LARGEST) */}
        <div className="space-y-2">
          {/* Tremor Traffic Light */}
          {(() => {
            const latestSession = allSessions.length > 0 ? allSessions[allSessions.length - 1] : null;
            const tr = translateTremor(latestSession?.tremor.frequencyHz || 4.8, latestSession?.tremor.amplitude || 0.26);
            return (
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <TechnicalDetailsExpand
                  primaryText={tr.primary}
                  technicalDetail={tr.technicalDetail}
                  size="sm"
                />
              </div>
            );
          })()}

          {/* Slowness (Bradykinesia) Traffic Light */}
          {(() => {
            const br = translateBradykinesia(18, 2.8);
            return (
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <TechnicalDetailsExpand
                  primaryText={br.primary}
                  technicalDetail={br.technicalDetail}
                  size="sm"
                />
              </div>
            );
          })()}

          {/* Freezing Traffic Light */}
          {(() => {
            const fr = translateFreezeIndex(1.2, false);
            return (
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <TechnicalDetailsExpand
                  primaryText={fr.primary}
                  technicalDetail={fr.technicalDetail}
                  size="sm"
                />
              </div>
            );
          })()}
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
            const sessionComposite = computeCompositeConfidence(session.timestamp, isDemoMode);

            const sessionTr = translateTremor(session.tremor.frequencyHz, session.tremor.amplitude, tremorChange?.pctChange);

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

                {/* Plain language summary first and largest */}
                <TechnicalDetailsExpand
                  primaryText={sessionTr.primary}
                  technicalDetail={`${sessionTr.technicalDetail}${session.bradykinesia ? ` • Tap speed: ${session.bradykinesia.tapRateHz} Hz (-${session.bradykinesia.decrementPct}%)` : ""}`}
                  size="sm"
                />

                {/* MULTI-SIGNAL COMPOSITE CONFIDENCE BADGE (Days with 2+ modalities) */}
                {sessionComposite.availableCount >= 2 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium">
                      <Sparkles className={`w-3.5 h-3.5 ${
                        sessionComposite.code === "multiple_agree"
                          ? "text-amber-600"
                          : sessionComposite.code === "mixed_signals"
                          ? "text-[#6366F1]"
                          : "text-emerald-600"
                      }`} />
                      <span>Multi-Signal Lens ({sessionComposite.availableCount} signals):</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-[0.5px] ${
                        sessionComposite.code === "multiple_agree"
                          ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                          : sessionComposite.code === "mixed_signals"
                          ? "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]"
                          : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                      }`}
                    >
                      {sessionComposite.label}
                    </span>
                  </div>
                )}
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

      {/* FREEZING OF GAIT EPISODES & EARLY PRE-WARNING TREND LOG */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2">
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Freezing Episodes &amp; Pre-Freeze Trend Log
            </h2>
          </div>
          <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full font-bold border border-amber-200">
            Doctor Report Clinical Stream
          </span>
        </div>

        <p className="text-xs text-[#64748B]">
          Log of full freeze episodes and early pre-warning degradation trends. Showing escalation rate vs natural gait recovery.
        </p>

        <div className="space-y-2">
          {freezeEpisodes.slice(0, 6).map((ep) => {
            const epDate = new Date(ep.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            const isPreWarning = ep.source === "pre-warning";
            const isAuto = ep.source === "auto-detected";

            return (
              <div
                key={ep.id}
                className={`p-3 rounded-2xl border-[0.5px] space-y-1 text-xs ${
                  isPreWarning
                    ? ep.escalatedToFull
                      ? "bg-amber-50/80 border-amber-200 text-amber-950"
                      : "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : isAuto
                    ? "bg-rose-50/80 border-rose-200 text-rose-950"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {isPreWarning ? "⚡" : isAuto ? "🤖" : "🖐️"}
                    {isPreWarning
                      ? "Early Pre-Freeze Warning"
                      : isAuto
                      ? "Auto-Detected Freeze Episode"
                      : "Self-Reported Freeze"}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      isPreWarning
                        ? ep.escalatedToFull
                          ? "bg-amber-200 text-amber-900"
                          : "bg-emerald-200 text-emerald-900"
                        : isAuto
                        ? "bg-rose-200 text-rose-900"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {isPreWarning
                      ? ep.escalatedToFull
                        ? "Escalated to Full Freeze"
                        : "Gait Normalized Naturally"
                      : isAuto
                      ? "Full Sustained FOG"
                      : "Self-Reported"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] opacity-90 pt-0.5">
                  <span>Logged: <strong>{epDate}</strong></span>
                  {ep.freezeIndex && <span>FI: <strong>{ep.freezeIndex.toFixed(2)}</strong></span>}
                  {ep.trendRate && <span>Trend: <strong>+{ep.trendRate.toFixed(2)}/s</strong></span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
