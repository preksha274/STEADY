"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  DiaryEntry,
  getDiaryEntries,
  addDiaryEntry,
  getDoseLogs,
  addDoseLog,
  getLastDose,
  hoursSinceLastDose,
} from "@/lib/diary";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  BookOpen,
  Pill,
  CheckCircle2,
  Minus,
  Plus,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  Activity,
  Smile,
  Zap,
  Calendar,
  FileText,
} from "lucide-react";

type SymptomLevel = 0 | 1 | 2 | 3;

const SYMPTOM_LABELS: Record<SymptomLevel, string> = {
  0: "None",
  1: "Mild",
  2: "Moderate",
  3: "Elevated",
};

const MOOD_OPTIONS = [
  { value: 4, emoji: "😊", label: "Great" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 1, emoji: "😔", label: "Tough" },
];

export default function DiaryPage() {
  const router = useRouter();
  const { isDemoMode, setIsDoseLogModalOpen } = useAnalysis();

  const [mounted, setMounted] = useState(false);

  // Form State
  const [tremor, setTremor] = useState<SymptomLevel>(1);
  const [slowness, setSlowness] = useState<SymptomLevel>(1);
  const [freezing, setFreezing] = useState<SymptomLevel>(0);
  const [mood, setMood] = useState<1 | 2 | 3 | 4>(3);
  const [fatigue, setFatigue] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [sleepHours, setSleepHours] = useState<number>(7.0);
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(4);

  // Dose state
  const [lastDoseInfo, setLastDoseInfo] = useState<{
    timeStr: string;
    agoStr: string;
  } | null>(null);

  // Toast & Submissions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [recentEntries, setRecentEntries] = useState<DiaryEntry[]>([]);

  const refreshData = () => {
    try {
      const entries = getDiaryEntries(isDemoMode);
      setRecentEntries(entries.slice(0, 5));

      const lastDose = getLastDose(isDemoMode);
      if (lastDose) {
        const timeObj = new Date(lastDose.timestamp);
        const timeStr = timeObj.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
        const hrsAgo = hoursSinceLastDose(undefined, isDemoMode);
        let agoStr = "";
        if (hrsAgo !== null) {
          if (hrsAgo < 0.1) {
            agoStr = "just now";
          } else if (hrsAgo < 1) {
            agoStr = `${Math.round(hrsAgo * 60)}m ago`;
          } else {
            agoStr = `${hrsAgo}h ago`;
          }
        }
        setLastDoseInfo({ timeStr, agoStr });
      } else {
        setLastDoseInfo(null);
      }
    } catch (e) {
      console.error("Failed to load diary entries or dose logs", e);
    }
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
  }, [isDemoMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleSaveCheckIn = () => {
    addDiaryEntry({
      symptoms: {
        tremor,
        slowness,
        freezing,
      },
      mood,
      fatigue,
      sleepHours,
      sleepQuality,
      source: "user",
    });

    refreshData();
    setSavedSuccess(true);
    showToast("Check-in saved to NeuroDiary!");
  };

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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
            NeuroDiary Check-in
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Log your daily symptoms, mood, and medication response
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#10B981]">
          <BookOpen className="w-6 h-6" />
        </div>
      </header>

      {/* MEDICATION DOSE CARD WITH MODAL TRIGGER */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0] bg-[#EFF6FF]/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#172554]">Medication Dose</h2>
              {lastDoseInfo ? (
                <p className="text-xs text-[#2563EB] font-medium">
                  Last dose: {lastDoseInfo.timeStr} ({lastDoseInfo.agoStr})
                </p>
              ) : (
                <p className="text-xs text-[#64748B]">No dose recorded today yet</p>
              )}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDoseLogModalOpen(true)}
            className="text-xs font-medium"
          >
            <span>+ Log Dose</span>
          </Button>
        </div>
      </Card>

      {/* SECTION 1: SYMPTOMS WITH LABELED STATUS BUTTONS (≥ 44PX) */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Symptom Severity (Compared to usual)
            </h2>
          </div>
          <span className="text-[10px] text-[#64748B]">Tap level</span>
        </div>

        {/* Tremor Row */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-[#172554]">
            <span>Resting Tremor</span>
            <StatusDot
              status={tremor === 0 ? "good" : tremor === 1 ? "good" : tremor === 2 ? "warning" : "danger"}
              label={SYMPTOM_LABELS[tremor]}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as SymptomLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setTremor(lvl)}
                className={`min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all border-[0.5px] cursor-pointer ${
                  tremor === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-[#F8FAFC] text-[#172554] border-[#E2E8F0] hover:bg-slate-100"
                }`}
              >
                {SYMPTOM_LABELS[lvl]}
              </button>
            ))}
          </div>
        </div>

        {/* Slowness Row */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-[#172554]">
            <span>Movement Slowness</span>
            <StatusDot
              status={slowness === 0 ? "good" : slowness === 1 ? "good" : slowness === 2 ? "warning" : "danger"}
              label={SYMPTOM_LABELS[slowness]}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as SymptomLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSlowness(lvl)}
                className={`min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all border-[0.5px] cursor-pointer ${
                  slowness === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-[#F8FAFC] text-[#172554] border-[#E2E8F0] hover:bg-slate-100"
                }`}
              >
                {SYMPTOM_LABELS[lvl]}
              </button>
            ))}
          </div>
        </div>

        {/* Freezing Row */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-[#172554]">
            <span>Gait Freezing / Hesitation</span>
            <StatusDot
              status={freezing === 0 ? "good" : freezing === 1 ? "good" : freezing === 2 ? "warning" : "danger"}
              label={SYMPTOM_LABELS[freezing]}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as SymptomLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFreezing(lvl)}
                className={`min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all border-[0.5px] cursor-pointer ${
                  freezing === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-[#F8FAFC] text-[#172554] border-[#E2E8F0] hover:bg-slate-100"
                }`}
              >
                {SYMPTOM_LABELS[lvl]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* SECTION 2: MOOD & FATIGUE */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div>
          <div className="text-xs font-semibold text-[#172554] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-amber-500" />
            <span>Mood</span>
          </div>
          <div className="grid grid-cols-4 gap-2 bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value as any)}
                className={`min-h-[48px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                  mood === m.value
                    ? "bg-white ring-2 ring-[#2563EB] shadow-xs scale-105"
                    : "hover:bg-slate-200/50 opacity-80 hover:opacity-100"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-[#172554] mt-0.5">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              <span>Fatigue Level (1 = Low, 5 = High)</span>
            </span>
            <span className="text-xs font-semibold text-[#2563EB]">
              Level {fatigue}/5
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFatigue(lvl as any)}
                className={`flex-1 min-h-[44px] rounded-xl text-xs font-medium border-[0.5px] transition-all cursor-pointer ${
                  fatigue === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-white text-[#172554] border-[#E2E8F0] hover:bg-slate-100"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* SAVE BUTTON */}
      <PrimaryButton fullWidth onClick={handleSaveCheckIn}>
        <CheckCircle2 className="w-5 h-5 mr-1.5" />
        <span>Save to NeuroDiary</span>
      </PrimaryButton>

      {/* Navigation to Forecast and Summary */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Link href="/forecast" className="block">
          <Button variant="outline" fullWidth size="md" className="border-blue-200 text-[#2563EB]">
            <span>Day Forecast</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
        <Link href="/voice-check" className="block">
          <Button variant="outline" fullWidth size="md" className="border-purple-200 text-[#8B5CF6]">
            <span>Voice Check</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
