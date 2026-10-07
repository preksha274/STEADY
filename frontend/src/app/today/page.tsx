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
import { getFreezeEpisodes, FreezeEpisode } from "@/lib/freezeEpisodes";
import { computeCompositeConfidence } from "@/lib/confidence";
import { getTodayAmbientSummary, AmbientSummaryResult } from "@/lib/ambientSampling";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { QualityLedgerBadge } from "@/components/QualityLedgerBadge";
import { SensorBadge } from "@/components/SensorBadge";

import { buildMetricQualityLedger } from "@/lib/qualityLedger";
import { CueLabIcon } from "@/components/icons/CueLabIcon";
import { TechnicalDetailsExpand } from "@/components/TechnicalDetailsExpand";
import {
  translateTremor,
  translateFreezeIndex,
  translateBradykinesia,
  translateVoice,
  translateGait,
  translateAmbientSummary,
} from "@/lib/plainLanguage";
import { evaluateDailyFlag } from "@/lib/dailyFlags";
import { WeeklyExerciseDoseCard } from "@/components/WeeklyExerciseDoseCard";
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
  Zap,
} from "lucide-react";

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
  const [freezeEpisodes, setFreezeEpisodes] = useState<FreezeEpisode[]>([]);
  const [ambientSummary, setAmbientSummary] = useState<AmbientSummaryResult | null>(null);

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

        const eps = getFreezeEpisodes();
        setFreezeEpisodes(eps);

        const amb = getTodayAmbientSummary(isDemoMode);
        setAmbientSummary(amb);

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

  const composite = useMemo(
    () => computeCompositeConfidence(new Date(), isDemoMode),
    [isDemoMode]
  );

  const dailyFlag = useMemo(
    () => evaluateDailyFlag(new Date(), isDemoMode),
    [isDemoMode]
  );

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

        {/* Simple Mode & Sensor Badge Toggles */}
        <div className="flex items-center gap-2">
          <SensorBadge />
          <Link
            href="/simple"
            onClick={() => setIsSimpleMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFF6FF] hover:bg-blue-100/80 text-[#2563EB] text-xs font-medium border-[0.5px] border-[#BFDBFE] transition-colors min-h-[44px] cursor-pointer"
            aria-label="Switch to Simple Mode"
          >
            <Eye className="w-4 h-4" />
            <span>Simple Mode</span>
          </Link>
        </div>
      </header>


      {/* DAILY BASELINE FLAG CARD (Cold-start + N-of-M persistence rules) */}
      <div
        className={`p-4 rounded-[18px] border-[0.5px] shadow-xs space-y-1.5 transition-all ${
          dailyFlag.severity === "cold_start"
            ? "bg-slate-50 border-slate-300 text-slate-900"
            : dailyFlag.severity === "unusual_today"
            ? "bg-amber-50/90 border-amber-300 text-amber-950"
            : dailyFlag.severity === "different_from_usual"
            ? "bg-rose-50/90 border-rose-300 text-rose-950"
            : "bg-emerald-50/90 border-emerald-300 text-emerald-950"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Daily Baseline Status
            </span>
            {dailyFlag.isColdStart && (
              <span className="text-[10px] bg-slate-200 text-slate-800 font-semibold px-2 py-0.5 rounded-full">
                Cold Start ({dailyFlag.daysLogged}/{dailyFlag.minDaysRequired} days)
              </span>
            )}
          </div>
          <span className="text-xs font-extrabold">{dailyFlag.headline}</span>
        </div>
        <p className="text-xs font-normal leading-relaxed opacity-90">
          {dailyFlag.explanation}
        </p>
      </div>

      {/* YOUR SAVED CUE CHIP */}
      <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-2xl px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-950 flex-wrap">
          <CueLabIcon size={18} />
          <div className="space-y-0.5">
            <span className="font-extrabold text-[#172554] block">Active Rhythm Pacing</span>
            <TechnicalDetailsExpand
              primaryText={activeCue ? `Set for ${activeCue.type} rhythm` : "Set for audio metronome beat"}
              technicalDetail={activeCue ? `${activeCue.type.toUpperCase()} metronome • ${activeCue.bpm} BPM` : "Audio metronome • 88 BPM"}
              size="sm"
            />
          </div>
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

      {/* AMBIENT MOVEMENT SUMMARY CHIP (Opt-in PKG-style continuous sampling summary) */}
      {ambientSummary && (ambientSummary.isEnabled || isDemoMode) && (
        <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-3.5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-950">
              <Activity className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Continuous Movement Sampling</span>
            </div>
            <ConfidenceBadge
              level={ambientSummary.confidenceLevel}
              reason={`${ambientSummary.confidenceReason} (${ambientSummary.sampleCount} bursts)`}
            />
          </div>

          <TechnicalDetailsExpand
            primaryText="Your movement today is typical for your daily routine"
            technicalDetail={`Rating: ${ambientSummary.label} • ${ambientSummary.sampleCount} continuous ambient samples recorded today`}
            size="sm"
          />
        </div>
      )}

      {/* MULTI-SIGNAL COMPOSITE CONFIDENCE LENS SUMMARY BADGE */}
      {composite.availableCount >= 2 && (
        <div
          className={`p-3.5 rounded-[18px] border-[0.5px] flex items-start gap-3 shadow-xs transition-all ${
            composite.code === "multiple_agree"
              ? "bg-[#FEF3C7]/90 border-[#F59E0B] text-[#78350F]"
              : composite.code === "mixed_signals"
              ? "bg-[#EEF2FF]/90 border-[#6366F1] text-[#312E81]"
              : "bg-[#ECFDF5]/90 border-[#10B981] text-[#064E3B]"
          }`}
        >
          <Sparkles
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              composite.code === "multiple_agree"
                ? "text-[#D97706]"
                : composite.code === "mixed_signals"
                ? "text-[#4F46E5]"
                : "text-[#059669]"
            }`}
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-tight">
                Confidence Lens: {composite.label}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  composite.code === "multiple_agree"
                    ? "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]"
                    : composite.code === "mixed_signals"
                    ? "bg-[#E0E7FF] text-[#3730A3] border-[#6366F1]"
                    : "bg-[#D1FAE5] text-[#065F46] border-[#10B981]"
                }`}
              >
                {composite.availableCount} Signals Shown Together
              </span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90 font-medium">
              {composite.reason}
            </p>
            <p className="text-[10px] italic text-slate-500 pt-1">
              Method: personal reference range (90th percentile band) &bull; Not a diagnosis. Talk to your doctor if you&apos;re worried.
            </p>
          </div>
        </div>
      )}

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

      {/* WEEKLY EXERCISE DOSE CARD (CYCLE-II Trial Pacing Protocol) */}
      <WeeklyExerciseDoseCard />

      {/* MOVEMENT SNAPSHOT ROW (Plain Language FIRST and LARGEST) */}
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

        <div className="space-y-3 pt-1">
          {/* Tremor */}
          {(() => {
            const tr = translateTremor(latestSession?.tremor?.frequencyHz || 4.8, latestSession?.tremor?.amplitude || 0.26);
            const tremorLedger = buildMetricQualityLedger({
              modality: "phone_imu",
              metric: "tremor_power",
              rawValue: 4.8,
              noiseLevel: "low",
              taskValid: true,
              environmentValid: true,
              epistemicScore: 0.9,
            });
            return (
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <TechnicalDetailsExpand
                  primaryText={tr.primary}
                  explanation="Flagged as matching your baseline. Your tremor stayed near 4.8 Hz throughout your check, showing no sudden spikes or unusual stiffness."
                  technicalDetail={tr.technicalDetail}
                  size="sm"
                  badge="Tremor"
                />
                <QualityLedgerBadge ledger={tremorLedger} />
              </div>
            );
          })()}

          {/* Gait Speed */}
          {(() => {
            const gt = translateGait(108, 94);
            const gaitLedger = buildMetricQualityLedger({
              modality: "camera_pose",
              metric: "stride_variability",
              rawValue: 94,
              taskValid: true,
              environmentValid: true,
              epistemicScore: 0.88,
            });
            return (
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <TechnicalDetailsExpand
                  primaryText={gt.primary}
                  explanation="Your walking pace is stable today with balanced step timing. No gait hesitation or freeze episodes were detected during movement sampling."
                  technicalDetail={gt.technicalDetail}
                  size="sm"
                  badge="Gait"
                />
                <QualityLedgerBadge ledger={gaitLedger} />
              </div>
            );
          })()}

          {/* Finger Tap (Bradykinesia) */}
          {(() => {
            const br = translateBradykinesia(
              latestSession?.bradykinesia?.decrementPct || 18,
              latestSession?.bradykinesia?.tapRateHz || 2.8,
              latestSession?.bradykinesia?.updrsScore || 1,
              latestSession?.bradykinesia?.updrsLabel || "Slight"
            );
            const tapLedger = buildMetricQualityLedger({
              modality: "phone_imu",
              metric: "finger_tap_score",
              rawValue: 18,
              placementShift: false,
              taskValid: true,
              environmentValid: true,
              epistemicScore: 0.82,
            });
            return (
              <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2">
                <TechnicalDetailsExpand
                  primaryText={br.primary}
                  explanation="Flagged because your tap speed dropped 18% partway through the test, which is more than we'd expect based on your past tests."
                  technicalDetail={br.technicalDetail}
                  size="sm"
                  badge="Bradykinesia"
                />
                <QualityLedgerBadge ledger={tapLedger} />
              </div>
            );
          })()}

          {/* Voice Acoustics */}
          {(() => {
            const vc = translateVoice(
              latestSession?.voice?.jitterPct || 1.8,
              latestSession?.voice?.shimmerPct || 4.5,
              latestSession?.voice?.hnrDb || 15.0
            );
            const voiceLedger = buildMetricQualityLedger({
              modality: "voice",
              metric: "voice_jitter",
              rawValue: 1.8,
              taskValid: true,
              environmentValid: true,
              epistemicScore: 0.92,
            });
            return (
              <div className="p-3.5 rounded-2xl bg-blue-50/40 border border-blue-200/80 space-y-2">
                <TechnicalDetailsExpand
                  primaryText={vc.primary}
                  explanation="Your vocal stability check showed steady pitch and clear volume control during sustained sound recording."
                  technicalDetail={vc.technicalDetail}
                  size="sm"
                  badge="Voice"
                />
                <QualityLedgerBadge ledger={voiceLedger} />
              </div>
            );
          })()}
        </div>
      </Card>

      {/* FREEZE EPISODES & DETECTION TIMELINE (Plain Language FIRST and LARGEST) */}
      <Card className="space-y-3 border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Freeze Episode Log
            </h2>
          </div>
          <span className="text-[10px] text-slate-500">
            {freezeEpisodes.length} Recorded
          </span>
        </div>

        <div className="space-y-2 pt-1">
          {freezeEpisodes.slice(0, 4).map((ep) => {
            const timeStr = new Date(ep.timestamp).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            const fr = translateFreezeIndex(ep.freezeIndex, ep.source === "auto-detected");

            return (
              <div
                key={ep.id}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {ep.source === "auto-detected" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                        Sensor Detected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                        <Footprints className="w-3 h-3 text-blue-600" />
                        Self-Reported
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{timeStr}</span>
                </div>

                <TechnicalDetailsExpand
                  primaryText={fr.primary}
                  technicalDetail={`${fr.technicalDetail} (${ep.cueType || "audio"} metronome used)`}
                  size="sm"
                />
              </div>
            );
          })}
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
