"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAnalysis } from "@/context/AnalysisContext";
import { getSessions, getBaseline, getChangeFromBaseline } from "@/lib/sessions";
import {
  addDiaryEntry,
  getLastDose,
  hoursSinceLastDose,
} from "@/lib/diary";
import { buildForecast, fetchForecastAsync, DayForecastResult } from "@/lib/forecast";
import { getSeverity, fetchSeverityAsync, SeverityResult } from "@/lib/severity";
import { getActiveCue, CueResult } from "@/lib/cues";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { CueLabIcon } from "@/components/icons/CueLabIcon";
import {
  Sun,
  Sparkles,
  Pill,
  Clock,
  Activity,
  Footprints,
  ShieldAlert,
  BookOpen,
  Check,
  TrendingUp,
  Fingerprint,
  CheckCircle2,
  ArrowRight,
  Eye,
  MapPin,
  Mic,
  Smile,
  Meh,
  Frown,
  Watch,
} from "lucide-react";
import { WearableStatusDot } from "@/components/WearableStatusDot";

export default function TodayHomePage() {
  const router = useRouter();
  const {
    isDemoMode,
    isSimpleMode,
    setIsSimpleMode,
    setIsFreezeModalOpen,
    setIsDoseLogModalOpen,
  } = useAnalysis();

  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("Sarah");
  const [selectedMood, setSelectedMood] = useState<"great" | "okay" | "tough">("great");
  const [lastDoseText, setLastDoseText] = useState<string | null>("Dose logged 2h ago (8:00 AM)");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Loaded session & baseline state
  const [latestSession, setLatestSession] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
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
      setLastDoseText(`Dose logged ${agoStr} (${timeStr})`);
    } else {
      setLastDoseText("Next dose: 12:00 PM • Levodopa");
    }
  };

  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);

  useEffect(() => {
    setMounted(true);

    const loadData = () => {
      try {
        const stored = localStorage.getItem("steady_user_profile") || localStorage.getItem("movepilot_user_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.name) setUserName(parsed.name.split(" ")[0]);
        }

        const cue = getActiveCue(isDemoMode);
        setActiveCueState(cue);

        const all = getSessions(isDemoMode);
        const latest = all.length > 0 ? all[all.length - 1] : null;
        setLatestSession(latest);

        refreshDoseState();
      } catch (e) {
        console.error("Could not read profile or sessions", e);
      }
    };

    loadData();
    window.addEventListener("focus", loadData);
    return () => window.removeEventListener("focus", loadData);
  }, [isDemoMode]);

  // Primary source of truth: Async backend fetch with explicit offline fallback
  const [forecast, setForecast] = useState<DayForecastResult>(() => buildForecast(isDemoMode));
  const [severity, setSeverity] = useState<SeverityResult>(() => getSeverity(isDemoMode));

  useEffect(() => {
    let active = true;
    async function loadMetrics() {
      const [fData, sData] = await Promise.all([
        fetchForecastAsync(isDemoMode),
        fetchSeverityAsync(isDemoMode),
      ]);
      if (active) {
        setForecast(fData);
        setSeverity(sData);
      }
    }
    loadMetrics();
    return () => {
      active = false;
    };
  }, [isDemoMode]);

  // 3-Button Mood Check-in Handler
  const handleMoodSelect = (mood: "great" | "okay" | "tough") => {
    setSelectedMood(mood);
    const moodMap: Record<"great" | "okay" | "tough", 1 | 2 | 4> = {
      great: 4,
      okay: 2,
      tough: 1,
    };
    addDiaryEntry({
      symptoms: { tremor: 1, slowness: 1, freezing: 0 },
      mood: moodMap[mood],
      fatigue: mood === "great" ? 1 : mood === "okay" ? 3 : 4,
      source: "user",
    });
    showToast(`Mood '${mood}' recorded in NeuroDiary!`);
  };

  const currentDateFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, []);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-44 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 max-w-md mx-auto px-4 sm:px-6 pt-5 space-y-4 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Greeting Header with Date + Simple Mode Toggle */}
      <header className="flex items-start justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#64748B] block">
              {currentDateFormatted}
            </span>
            {isDemoMode && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Simulated Demo Patient
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight mt-0.5">
            Good morning, {userName}
          </h1>
        </div>

        {/* Simple Mode Toggle */}
        <Link
          href="/simple"
          onClick={() => setIsSimpleMode(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFF6FF] hover:bg-blue-100/80 text-[#2563EB] text-xs font-medium border-[0.5px] border-[#BFDBFE] transition-colors min-h-[44px] cursor-pointer"
          aria-label="Switch to Simple Mode"
        >
          <Eye className="w-4 h-4" />
          <span>Simple Mode</span>
        </Link>
      </header>

      {/* YOUR SAVED CUE CHIP */}
      <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-2xl px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-950 flex-wrap">
          <CueLabIcon size={18} />
          <span>Active Cue:</span>
          <span className="font-bold text-[#6366F1] capitalize">{activeCue ? `${activeCue.type} • ${activeCue.bpm} BPM` : "Audio Beat • 88 BPM"}</span>
          {(activeCue ? activeCue.simulated !== false : true) && (
            <span className="text-[10px] bg-indigo-50 text-[#6366F1] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
              Simulated
            </span>
          )}
        </div>
        <Link href="/cue-lab" className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1 shrink-0">
          <span>Tune</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* FULL-WIDTH RED "I'M FROZEN" BUTTON (ALWAYS VISIBLE ABOVE THE FOLD) */}
      <div>
        <button
          onClick={() => setIsFreezeModalOpen(true)}
          className="w-full min-h-[52px] py-3.5 px-5 bg-[#EF4444] hover:bg-red-600 text-white font-medium text-base rounded-[18px] shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer"
          aria-label="I'm frozen emergency unfreezing assistance"
        >
          <ShieldAlert className="w-6 h-6 animate-pulse" />
          <span className="tracking-wide">I&apos;m frozen</span>
        </button>
      </div>

      {/* Day Forecast Card (Background-Gradient with Confidence Badge) */}
      <div className="bg-background-gradient rounded-[18px] border-[0.5px] border-[#E2E8F0] p-5 shadow-xs relative overflow-hidden space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-white text-[#2563EB] shadow-xs">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
                <span>Day Forecast</span>
                {forecast.isOfflineFallback && (
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-semibold normal-case">
                    Offline estimate
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-[#172554] mt-0.5">
                {forecast.bestWindow ? forecast.bestWindow.timeSpanLabel : "10:00 AM – 12:30 PM"}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ConfidenceBadge
              level={forecast.confidenceLevel}
              reason="Based on your personal baseline & dose schedule"
            />
            <span className="text-[10px] font-medium text-[#2563EB]/90">
              {isDemoMode ? "Forecast confidence: 21 of 14 days logged" : "Forecast confidence: 5 of 14 days logged"}
            </span>
          </div>
        </div>

        <p className="text-xs text-[#172554] font-normal leading-relaxed">

          ✨ Optimal mobility window expected late morning. Best interval for walks, exercise, or outside tasks.
        </p>

        {/* Hourly Micro Bar Preview */}
        <div className="flex items-center gap-1.5 pt-1">
          {["7a", "9a", "11a", "1p", "3p", "5p", "7p"].map((hr, idx) => (
            <div key={hr} className="flex-1 text-center space-y-1">
              <div
                className={`h-2 rounded-full ${
                  idx === 2 || idx === 3
                    ? "bg-[#10B981]"
                    : idx === 1 || idx === 4
                    ? "bg-[#F59E0B]"
                    : "bg-[#6366F1]/30"
                }`}
              />
              <span className="text-[10px] text-[#64748B] font-normal">{hr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3-BUTTON MOOD CHECK-IN (44px+ TARGETS) */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Quick Check-in: How are you feeling?
          </span>
          <span className="text-[11px] text-[#64748B]">Tap one</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleMoodSelect("great")}
            className={`min-h-[48px] py-2.5 px-3 rounded-2xl border-[0.5px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedMood === "great"
                ? "bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] shadow-xs font-medium"
                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#172554] hover:bg-slate-100 font-normal"
            }`}
            aria-label="Mood: Great"
          >
            <Smile className={`w-5 h-5 ${selectedMood === "great" ? "text-[#2563EB]" : "text-[#10B981]"}`} />
            <span className="text-sm">Great</span>
          </button>

          <button
            type="button"
            onClick={() => handleMoodSelect("okay")}
            className={`min-h-[48px] py-2.5 px-3 rounded-2xl border-[0.5px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedMood === "okay"
                ? "bg-[#FFFBEB] border-[#F59E0B] text-[#92400E] shadow-xs font-medium"
                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#172554] hover:bg-slate-100 font-normal"
            }`}
            aria-label="Mood: Okay"
          >
            <Meh className={`w-5 h-5 ${selectedMood === "okay" ? "text-[#92400E]" : "text-[#F59E0B]"}`} />
            <span className="text-sm">Okay</span>
          </button>

          <button
            type="button"
            onClick={() => handleMoodSelect("tough")}
            className={`min-h-[48px] py-2.5 px-3 rounded-2xl border-[0.5px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedMood === "tough"
                ? "bg-[#FEF2F2] border-[#EF4444] text-[#991B1B] shadow-xs font-medium"
                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#172554] hover:bg-slate-100 font-normal"
            }`}
            aria-label="Mood: Tough"
          >
            <Frown className={`w-5 h-5 ${selectedMood === "tough" ? "text-[#991B1B]" : "text-[#EF4444]"}`} />
            <span className="text-sm">Tough</span>
          </button>
        </div>
      </Card>

      {/* MOVEMENT SNAPSHOT ROW (Tremor / Gait / Fatigue as colored dot + text label) */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Movement Snapshot
            </h2>
            {severity.isOfflineFallback && (
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
                Offline estimate
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#64748B] italic">
            Compared to your usual
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* Tremor Dot + Label */}
          <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] text-center space-y-1.5">
            <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
              Tremor
            </span>
            <StatusDot
              status={severity.tremor.level === "mild" ? "good" : severity.tremor.level === "moderate" ? "warning" : "danger"}
              label={severity.tremor.level === "mild" ? "Mild" : severity.tremor.level === "moderate" ? "Moderate" : "High"}
              size="sm"
            />
          </div>

          {/* Gait Dot + Label */}
          <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] text-center space-y-1.5">
            <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
              Gait Speed
            </span>
            <StatusDot
              status="good"
              label="Typical"
              size="sm"
            />
          </div>

          {/* Fatigue Dot + Label */}
          <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] text-center space-y-1.5">
            <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
              Fatigue
            </span>
            <StatusDot
              status="warning"
              label="Moderate"
              size="sm"
            />
          </div>
        </div>
      </Card>

      {/* MEDICATION REMINDER ROW */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0] bg-[#EFF6FF]/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#172554] block">
                Medication Reminder
              </span>
              <p className="text-xs text-[#64748B] font-normal">
                {lastDoseText}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDoseLogModalOpen(true)}
            className="shrink-0 text-xs font-medium"
          >
            <span>Log Dose</span>
          </Button>
        </div>
      </Card>

      {/* STEADY WEARABLE CARD */}
      <Link href="/wearable" className="block">
        <Card className="space-y-3 border-[0.5px] border-[#E2E8F0] hover:border-[#2563EB] hover:shadow-xs transition-all bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100/80 text-[#2563EB]">
                <Watch className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#172554] block">
                    Steady Wearable
                  </span>
                  <WearableStatusDot size="sm" />
                </div>
                <p className="text-xs text-[#64748B] font-normal">
                  Live wrist-band monitoring, history and reports
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#2563EB] shrink-0" />
          </div>
        </Card>
      </Link>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <Link href="/cue-lab" className="block">
          <div className="p-3 rounded-[18px] bg-white border-[0.5px] border-[#E2E8F0] hover:border-[#6366F1] hover:shadow-xs transition-all flex flex-col items-center text-center gap-1.5 min-h-[90px] justify-center">
            <div className="p-2 bg-indigo-50 text-[#6366F1] rounded-xl shrink-0">
              <CueLabIcon size={20} />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554]">Cue Lab</div>
              <div className="text-[10px] text-[#64748B]">Rhythm pacing</div>
            </div>
          </div>
        </Link>

        <Link href="/danger-zones" className="block">
          <div className="p-3 rounded-[18px] bg-white border-[0.5px] border-[#E2E8F0] hover:border-[#2563EB] hover:shadow-xs transition-all flex flex-col items-center text-center gap-1.5 min-h-[90px] justify-center">
            <div className="p-2 bg-rose-50 text-[#EF4444] rounded-xl shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554]">Danger Zones</div>
              <div className="text-[10px] text-[#64748B]">Hazard map</div>
            </div>
          </div>
        </Link>

        <Link href="/voice-check" className="block">
          <div className="p-3 rounded-[18px] bg-white border-[0.5px] border-[#E2E8F0] hover:border-[#2563EB] hover:shadow-xs transition-all flex flex-col items-center text-center gap-1.5 min-h-[90px] justify-center">
            <div className="p-2 bg-purple-50 text-[#8B5CF6] rounded-xl shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554]">Voice Check</div>
              <div className="text-[10px] text-[#64748B]">3s vocal test</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
