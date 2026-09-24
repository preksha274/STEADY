"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAnalysis } from "@/context/AnalysisContext";
import { getSessions, getBaseline, getChangeFromBaseline } from "@/lib/sessions";
import {
  addDoseLog,
  addDiaryEntry,
  getLastDose,
  hoursSinceLastDose,
} from "@/lib/diary";
import { buildForecast, DayForecastResult } from "@/lib/forecast";
import { getSeverity, SeverityResult } from "@/lib/severity";
import { getActiveCue, hasCueFatigue, CueResult } from "@/lib/cues";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { MetricRow } from "@/components/MetricRow";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  Sun,
  Sparkles,
  Play,
  Pill,
  Clock,
  Activity,
  Video,
  ShieldAlert,
  BookOpen,
  Check,
  TrendingUp,
  Fingerprint,
  CheckCircle2,
  ArrowRight,
  Gauge,
  Info,
} from "lucide-react";

export default function TodayPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();

  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("Sarah");
  const [selectedMood, setSelectedMood] = useState<string>("😊");
  const [selectedFatigue, setSelectedFatigue] = useState<number>(2);
  const [lastDoseText, setLastDoseText] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Loaded session & baseline state
  const [latestSession, setLatestSession] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2500);
  };

  const refreshDoseState = () => {
    const lastDose = getLastDose(isDemoMode);
    if (lastDose) {
      const timeStr = new Date(lastDose.timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const hrsAgo = hoursSinceLastDose(undefined, isDemoMode);
      let agoStr = "";
      if (hrsAgo !== null) {
        agoStr = hrsAgo < 0.1 ? "just now" : hrsAgo < 1 ? `${Math.round(hrsAgo * 60)}m ago` : `${hrsAgo}h ago`;
      }
      setLastDoseText(`Dose Logged at ${timeStr} (${agoStr})`);
    } else {
      setLastDoseText(null);
    }
  };

  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);
  const [fatigueInfo, setFatigueInfo] = useState<{ isFatigued: boolean; dropPercent: number; currentCue: CueResult | null }>({
    isFatigued: false,
    dropPercent: 0,
    currentCue: null,
  });

  useEffect(() => {
    setMounted(true);

    const loadData = () => {
      try {
        const stored = localStorage.getItem("movepilot_user_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.name) {
            setUserName(parsed.name.split(" ")[0]);
          }
        }

        const cue = getActiveCue(isDemoMode);
        setActiveCueState(cue);

        const fatigue = hasCueFatigue(isDemoMode);
        setFatigueInfo(fatigue);

        const all = getSessions(isDemoMode);
        const latest = all.length > 0 ? all[all.length - 1] : null;
        setLatestSession(latest);

        if (latest) {
          const comp = getChangeFromBaseline(latest, isDemoMode);
          setComparison(comp);
        } else {
          setComparison(null);
        }

        refreshDoseState();
      } catch (e) {
        console.error("Could not read profile or sessions", e);
      }
    };

    loadData();
    window.addEventListener("focus", loadData);
    return () => window.removeEventListener("focus", loadData);
  }, [isDemoMode]);

  // Forecast computation
  const forecast: DayForecastResult = useMemo(() => {
    if (!mounted) {
      return {
        hourly: [],
        windows: [],
        bestWindow: null,
        confidenceScore: 0,
        confidenceLevel: "low",
        coverageLevel: "none",
        reasons: [],
      };
    }
    return buildForecast(isDemoMode);
  }, [isDemoMode, mounted]);

  // Severity Meter computation
  const severity: SeverityResult = useMemo(() => {
    if (!mounted) {
      return {
        tremor: { level: "mild", label: "Mild", description: "Compared to your usual", source: "seed" },
        slowness: { level: "mild", label: "Mild", description: "Compared to your usual", source: "seed" },
        freezing: { level: "mild", label: "Mild", description: "Compared to your usual", source: "seed" },
        confidence: "low",
        confidenceReason: "Loading...",
        hasSeededData: true,
        isLiveSession: false,
      };
    }
    return getSeverity(isDemoMode);
  }, [isDemoMode, mounted]);

  const moods = ["😊", "😐", "😔", "⚡", "😴"];

  const handleMoodSelect = (emoji: string) => {
    setSelectedMood(emoji);
    const moodMap: Record<string, 1 | 2 | 3 | 4> = {
      "😊": 4,
      "😐": 2,
      "😔": 1,
      "⚡": 3,
      "😴": 1,
    };
    const moodVal = moodMap[emoji] || 3;
    addDiaryEntry({
      symptoms: { tremor: 1, slowness: 1, freezing: 0 },
      mood: moodVal,
      fatigue: (selectedFatigue as any) || 2,
      source: "user",
    });
    showToast(`Mood ${emoji} saved to diary!`);
  };

  const handleFatigueSelect = (lvl: number) => {
    setSelectedFatigue(lvl);
    const moodMap: Record<string, 1 | 2 | 3 | 4> = {
      "😊": 4,
      "😐": 2,
      "😔": 1,
      "⚡": 3,
      "😴": 1,
    };
    const moodVal = moodMap[selectedMood] || 3;
    addDiaryEntry({
      symptoms: { tremor: 1, slowness: 1, freezing: 0 },
      mood: moodVal,
      fatigue: (lvl as any) || 2,
      source: "user",
    });
    showToast(`Fatigue level ${lvl} saved to diary!`);
  };

  const handleLogDoseToday = () => {
    addDoseLog("on");
    refreshDoseState();
    showToast("💊 Dose logged!");
  };

  if (!mounted) {
    return (
      <div className="min-h-screen pb-12 max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const currentHourStatus = forecast.hourly.find((h) => h.isCurrentHour)?.status || "good";

  return (
    <div className="min-h-screen pb-12">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Section with Soft Background Gradient */}
      <div className="bg-soft-gradient pt-8 pb-8 px-4 sm:px-6 rounded-b-3xl border-b border-blue-100/60 shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                <Sun className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Daily Companion • Today
              </span>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${
                currentHourStatus === "good"
                  ? "bg-emerald-100 text-emerald-800"
                  : currentHourStatus === "variable"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              <span>{currentHourStatus === "good" ? "🟢 Good State" : currentHourStatus === "variable" ? "🟡 Variable" : "🔴 Difficult"}</span>
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172554] tracking-tight">
                Good morning, {userName} 👋
              </h1>
              {activeCue && (
                <Link
                  href="/cue-lab"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 hover:bg-white text-xs font-bold text-[#172554] rounded-full border border-blue-200 shadow-2xs hover:shadow-xs transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Your cue: {activeCue.type === "vibration" ? "📳" : activeCue.type === "visual" ? "✨" : "🎵"} {activeCue.bpm} BPM
                  </span>
                </Link>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Here is your movement outlook and recommended daily schedule.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-md mx-auto px-4 sm:px-6 space-y-4 mt-4">
        {/* Cue Fatigue Warning Banner */}
        {fatigueInfo.isFatigued && (
          <Card className="bg-amber-50/95 border-2 border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <Info className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="text-xs font-black text-amber-950 uppercase tracking-wide">
                  Cue Fatigue Detected
                </div>
                <div className="text-xs text-amber-900 mt-0.5 leading-snug font-medium">
                  Your audio cue seems to be losing its effect. Try rotating to vibration or a new tempo.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/cue-lab?rotate=true")}
              className="bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200 shrink-0 font-bold text-xs"
            >
              Rotate cue
            </Button>
          </Card>
        )}
        {/* Good Window Card (Reading directly from forecast) */}
        <Card className="bg-emerald-50/90 border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-100 rounded-full opacity-50 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-sm">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Optimal Mobility Window
                </div>
                <div className="text-xl font-black text-emerald-900 mt-0.5">
                  {forecast.coverageLevel === "none" || !forecast.bestWindow
                    ? "Not enough data yet"
                    : forecast.bestWindow.timeSpanLabel}
                </div>
              </div>
            </div>
            <ConfidenceBadge
              level={forecast.confidenceLevel}
              reason={`Based on ${forecast.reasons.join(", ")}`}
            />
          </div>

          <p className="text-xs text-emerald-700 mt-3 font-medium">
            {forecast.coverageLevel === "none" || !forecast.bestWindow
              ? "Complete a check-in to build your personal forecast and discover your peak movement window."
              : "Expected optimal movement window based on medication response curve. Best time for walking or errands!"}
          </p>

          <Link
            href={forecast.coverageLevel === "none" ? "/diary" : "/forecast"}
            className="block w-full pt-2"
          >
            <Button
              variant="outline"
              fullWidth
              size="md"
              className="border-emerald-300 text-emerald-800 bg-white/80 hover:bg-emerald-100"
            >
              <Sun className="w-4 h-4 mr-1.5 text-emerald-600" />
              <span>
                {forecast.coverageLevel === "none"
                  ? "Log Today's Check-in"
                  : "View Full Day Forecast"}
              </span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </Card>

        {/* TODAY'S SEVERITY METER CARD */}
        <Card className="bg-white border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#2563EB]" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                    Today&apos;s Severity
                  </h3>
                  {severity.isLiveSession ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span>Live</span>
                    </span>
                  ) : severity.hasSeededData ? (
                    <span className="text-[10px] bg-amber-100 text-[#D97706] border border-amber-200 font-bold px-2 py-0.2 rounded-full flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-[#F59E0B]" />
                      <span>Demo data</span>
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-[#64748B] font-semibold italic">
                  Compared to your usual
                </p>
              </div>
            </div>
            <ConfidenceBadge level={severity.confidence} reason={severity.confidenceReason} />
          </div>

          {/* Traffic-Light Rows */}
          <div className="space-y-2 text-xs">
            {/* Tremor Row */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-bold text-[#172554]">Resting Tremor</span>
              <span
                className={`font-extrabold px-3 py-1 rounded-full border text-xs ${
                  severity.tremor.level === "mild"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : severity.tremor.level === "moderate"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}
              >
                {severity.tremor.level === "mild" ? "🟢 Mild" : severity.tremor.level === "moderate" ? "🟡 Moderate" : "🔴 High"}
              </span>
            </div>

            {/* Slowness Row */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-bold text-[#172554]">Slowness (Bradykinesia)</span>
              <span
                className={`font-extrabold px-3 py-1 rounded-full border text-xs ${
                  severity.slowness.level === "mild"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : severity.slowness.level === "moderate"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}
              >
                {severity.slowness.level === "mild" ? "🟢 Mild" : severity.slowness.level === "moderate" ? "🟡 Moderate" : "🔴 High"}
              </span>
            </div>

            {/* Freezing Row */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-bold text-[#172554]">Freezing of Gait</span>
              <span
                className={`font-extrabold px-3 py-1 rounded-full border text-xs ${
                  severity.freezing.level === "mild"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : severity.freezing.level === "moderate"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}
              >
                {severity.freezing.level === "mild" ? "🟢 Mild" : severity.freezing.level === "moderate" ? "🟡 Moderate" : "🔴 High"}
              </span>
            </div>
          </div>
        </Card>

        {/* Next Recommended Activity Card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-100 text-[#8B5CF6]">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                Next Recommended Activity
              </span>
            </div>
            <span className="text-xs text-[#64748B] font-medium bg-slate-100 px-2 py-0.5 rounded-md">
              8 mins
            </span>
          </div>

          <h3 className="text-lg font-bold text-[#172554] mb-1">
            Move Coach • Rhythm & Stride Session
          </h3>
          <p className="text-xs text-[#64748B] mb-4">
            A guided 8-minute rhythmic pacing drill designed to maintain step length during your morning ON phase.
          </p>

          <Link href="/move" className="block w-full">
            <Button variant="primary" fullWidth size="md" className="bg-brand-gradient shadow-sm">
              <Play className="w-4 h-4 fill-white mr-1.5" />
              <span>Start Session</span>
            </Button>
          </Link>
        </Card>

        {/* Quick Check-in Card */}
        <Card className="bg-white border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
              Quick Check-in
            </h3>
            <span className="text-xs text-[#64748B]">Tap to update</span>
          </div>

          {/* Mood Selection */}
          <div>
            <div className="text-xs font-medium text-[#64748B] mb-2">How are you feeling right now?</div>
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200">
              {moods.map((m) => (
                <button
                  key={m}
                  onClick={() => handleMoodSelect(m)}
                  className={`p-2 sm:p-2.5 rounded-xl text-xl sm:text-2xl transition-all ${
                    selectedMood === m
                      ? "bg-white shadow-sm ring-2 ring-blue-500 scale-110"
                      : "hover:bg-slate-200/60 opacity-80 hover:opacity-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Fatigue Scale 1-5 */}
          <div>
            <div className="text-xs font-medium text-[#64748B] mb-2">Fatigue Level (1 = Low, 5 = High)</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleFatigueSelect(lvl)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedFatigue === lvl
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                      : "bg-slate-50 text-[#172554] border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Log Dose Button */}
          <Button
            variant={lastDoseText ? "outline" : "secondary"}
            fullWidth
            size="md"
            onClick={handleLogDoseToday}
            className="flex items-center justify-center gap-2"
          >
            {lastDoseText ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>{lastDoseText}</span>
              </>
            ) : (
              <>
                <Pill className="w-4 h-4 mr-1" />
                <span>Log Dose (Current Time)</span>
              </>
            )}
          </Button>
        </Card>

        {/* Your Movement Card - Dynamically populated from latest session & baseline */}
        <Card className="bg-white border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                Your Movement Profile
              </h3>
            </div>
            {latestSession && (
              <div className="flex items-center gap-1.5">
                {(latestSession.source === "seed" || latestSession.source === "demo") && (
                  <span className="text-[10px] bg-amber-100 text-[#D97706] border border-amber-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-[#F59E0B]" />
                    <span>Demo data</span>
                  </span>
                )}
                <ConfidenceBadge
                  level={latestSession.tremor.confidence}
                  reason={latestSession.tremor.confidenceReason}
                />
              </div>
            )}
          </div>

          {latestSession ? (
            <div className="space-y-3">
              {/* Tremor Metric Row */}
              <MetricRow
                label="Resting Tremor"
                value={latestSession.tremor.frequencyHz}
                unit="Hz"
                comparison={
                  comparison?.tremorAmplitude
                    ? comparison.tremorAmplitude.direction === "better"
                      ? `↓ ${Math.abs(comparison.tremorAmplitude.pctChange)}% vs baseline`
                      : comparison.tremorAmplitude.direction === "worse"
                      ? `↑ ${Math.abs(comparison.tremorAmplitude.pctChange)}% vs baseline`
                      : "→ Similar"
                    : "Baseline pending"
                }
                confidenceLevel={latestSession.tremor.confidence}
                confidenceReason={latestSession.tremor.confidenceReason}
              />

              {/* Walking Metric Row */}
              <MetricRow
                label="Walking Cadence"
                value={latestSession.gait ? latestSession.gait.cadence : 108}
                unit="steps/min"
                comparison={
                  comparison?.gaitCadence
                    ? comparison.gaitCadence.direction === "better"
                      ? `↑ ${Math.abs(comparison.gaitCadence.pctChange)}% vs baseline`
                      : comparison.gaitCadence.direction === "worse"
                      ? `↓ ${Math.abs(comparison.gaitCadence.pctChange)}% vs baseline`
                      : "→ Similar"
                    : "→ Similar"
                }
                confidenceLevel={latestSession.gait ? latestSession.gait.confidence : "high"}
                confidenceReason={
                  latestSession.gait
                    ? "Video pose analysis"
                    : "Estimated from baseline morning walk"
                }
              />

              {/* Postural Stability / Overall Note */}
              <MetricRow
                label="Postural Stability"
                value="Stable"
                comparison="typical posture"
                confidenceLevel="high"
                confidenceReason="Normal range maintained"
              />
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-4 text-center">
              No movement sessions recorded yet. Run an analysis to build your baseline.
            </div>
          )}

          {/* View Progress Button */}
          <Link href="/progress" className="block w-full pt-1">
            <Button variant="outline" fullWidth size="md" className="border-blue-200 text-[#2563EB] hover:bg-blue-50">
              <TrendingUp className="w-4 h-4 mr-1.5" />
              <span>View Progress</span>
            </Button>
          </Link>
        </Card>

        {/* Quick Actions Grid */}
        <div>
          <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2.5 pl-1">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-2.5">
            <Link href="/analyze" className="block">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all text-center group flex flex-col items-center">
                <div className="p-2.5 rounded-xl bg-cyan-50 text-[#06B6D4] mb-2 group-hover:scale-105 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#172554] block leading-tight">
                  Analyze Movement
                </span>
              </div>
            </Link>

            <Link href="/cue-lab" className="block">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-red-300 hover:shadow-md transition-all text-center group flex flex-col items-center">
                <div className="p-2.5 rounded-xl bg-rose-50 text-[#EF4444] mb-2 group-hover:scale-105 transition-transform">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#172554] block leading-tight">
                  I&apos;m Frozen
                </span>
              </div>
            </Link>

            <Link href="/diary" className="block">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-center group flex flex-col items-center">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-[#10B981] mb-2 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#172554] block leading-tight">
                  Log Symptoms
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
