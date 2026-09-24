"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  DiaryEntry,
  DoseLog,
  getDiaryEntries,
  addDiaryEntry,
  getDoseLogs,
  addDoseLog,
  getLastDose,
  hoursSinceLastDose,
} from "@/lib/diary";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
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
} from "lucide-react";

type SymptomLevel = 0 | 1 | 2 | 3;

const SYMPTOM_LABELS: Record<SymptomLevel, string> = {
  0: "None",
  1: "Mild",
  2: "Moderate",
  3: "High",
};

const MOOD_OPTIONS = [
  { value: 4, emoji: "😊", label: "Great" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 1, emoji: "😔", label: "Low" },
];

export default function DiaryPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();

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
  const [selectedOnOff, setSelectedOnOff] = useState<"on" | "off">("on");
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
    }, 3000);
  };

  const handleLogDose = () => {
    addDoseLog(selectedOnOff);
    refreshData();
    showToast(`💊 Dose logged (${selectedOnOff.toUpperCase()} state)`);
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
    showToast("Check-in saved successfully!");
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554]">
              How are you feeling today?
            </h1>
            <p className="text-xs text-[#64748B]">10-second symptom check-in</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#10B981]">
            <BookOpen className="w-6 h-6" />
          </div>
        </header>
        <Card className="animate-pulse py-12 text-center text-slate-400">
          Loading check-in form...
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-24">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
            How are you feeling today?
          </h1>
          <p className="text-xs text-[#64748B]">
            10-second daily check-in to track symptoms, mood & doses
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#10B981]">
          <BookOpen className="w-6 h-6" />
        </div>
      </header>

      {/* SECTION 1: SYMPTOMS */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <span>Symptoms</span>
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">Select current level</span>
        </div>

        {/* Tremor Row */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-[#172554]">
            <span>Tremor</span>
            <span className="text-[#2563EB] font-bold">{SYMPTOM_LABELS[tremor]}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as SymptomLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setTremor(lvl)}
                className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                  tremor === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-slate-50 text-[#64748B] border-slate-200 hover:bg-slate-100"
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
            <span>Slowness (Bradykinesia)</span>
            <span className="text-[#2563EB] font-bold">{SYMPTOM_LABELS[slowness]}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as SymptomLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSlowness(lvl)}
                className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                  slowness === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-slate-50 text-[#64748B] border-slate-200 hover:bg-slate-100"
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
            <span>Freezing of Gait</span>
            <span className="text-[#2563EB] font-bold">{SYMPTOM_LABELS[freezing]}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as SymptomLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFreezing(lvl)}
                className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                  freezing === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-slate-50 text-[#64748B] border-slate-200 hover:bg-slate-100"
                }`}
              >
                {SYMPTOM_LABELS[lvl]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* SECTION 2: MOOD & FATIGUE */}
      <Card className="space-y-4">
        {/* Mood Selector */}
        <div>
          <div className="text-xs font-bold text-[#172554] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-amber-500" />
            <span>Mood</span>
          </div>
          <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(m.value as any)}
                className={`flex flex-col items-center p-2.5 rounded-xl transition-all ${
                  mood === m.value
                    ? "bg-white ring-2 ring-blue-500 shadow-sm scale-105"
                    : "hover:bg-slate-200/50 opacity-75 hover:opacity-100"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-semibold text-[#172554] mt-1">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Fatigue Segmented Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-purple-500" />
              <span>Fatigue</span>
            </span>
            <span className="text-xs font-semibold text-[#2563EB]">
              {fatigue === 1
                ? "Energetic (1)"
                : fatigue === 2
                ? "Mild (2)"
                : fatigue === 3
                ? "Moderate (3)"
                : fatigue === 4
                ? "High (4)"
                : "Exhausted (5)"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFatigue(lvl as any)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  fatigue === lvl
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-slate-50 text-[#172554] border-slate-200 hover:bg-slate-100"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* SECTION 3: SLEEP */}
      <Card className="space-y-4">
        <div className="text-xs font-bold text-[#172554] uppercase tracking-wider border-b border-slate-100 pb-2">
          Last Night&apos;s Sleep
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Sleep Hours Stepper */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#64748B]">Duration (hours)</span>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-1.5">
              <button
                onClick={() => setSleepHours(Math.max(0, Math.round((sleepHours - 0.5) * 10) / 10))}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm shadow-xs"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-base font-extrabold text-[#172554]">
                {sleepHours}h
              </span>
              <button
                onClick={() => setSleepHours(Math.min(14, Math.round((sleepHours + 0.5) * 10) / 10))}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sleep Quality 5-Star Rating */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#64748B]">Quality</span>
            <div className="flex items-center justify-around bg-slate-50 border border-slate-200 rounded-xl p-2 h-11">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSleepQuality(star as any)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-5 h-5 ${
                      star <= sleepQuality
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 fill-slate-100"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 4: MEDICATION LOG */}
      <Card className="space-y-3.5 bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 text-[#6366F1]">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172554]">Medication Log</h2>
              {lastDoseInfo ? (
                <p className="text-xs text-[#2563EB] font-semibold">
                  Last dose: {lastDoseInfo.timeStr} ({lastDoseInfo.agoStr})
                </p>
              ) : (
                <p className="text-xs text-[#64748B]">No dose recorded today yet</p>
              )}
            </div>
          </div>

          {/* ON / OFF State Chips */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setSelectedOnOff("on")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedOnOff === "on"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-emerald-600"
              }`}
            >
              ON
            </button>
            <button
              onClick={() => setSelectedOnOff("off")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedOnOff === "off"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-amber-600"
              }`}
            >
              OFF
            </button>
          </div>
        </div>

        <Button
          variant="secondary"
          fullWidth
          size="md"
          onClick={handleLogDose}
          className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
        >
          <Pill className="w-4 h-4 mr-2" />
          <span>💊 Log Dose Now</span>
        </Button>
      </Card>

      {/* SECTION 5: PRIMARY SAVE CHECK-IN BUTTON */}
      <div className="space-y-3">
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={handleSaveCheckIn}
          className="bg-brand-gradient hover:opacity-95 shadow-md py-4 text-base font-extrabold"
        >
          <span>Save Check-in</span>
          <CheckCircle2 className="w-5 h-5 ml-2" />
        </Button>

        {savedSuccess && (
          <Link href="/forecast" className="block w-full">
            <Button
              variant="outline"
              fullWidth
              size="md"
              className="border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            >
              <Sparkles className="w-4 h-4 mr-2 text-emerald-600" />
              <span>See your Day Forecast</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        )}
      </div>

      {/* SECTION 6: RECENT CHECK-INS LIST */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Recent Check-ins (Last 5)
          </h2>
          <span className="text-xs text-[#2563EB] font-medium">
            {recentEntries.length} logged
          </span>
        </div>

        {recentEntries.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
            No check-ins recorded yet. Fill out the form above to log your first entry!
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentEntries.map((entry) => {
              const dateObj = new Date(entry.timestamp);
              const dateStr = dateObj.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });
              const timeStr = dateObj.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              const moodEmoji =
                MOOD_OPTIONS.find((m) => m.value === entry.mood)?.emoji || "🙂";

              return (
                <div
                  key={entry.id}
                  className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{moodEmoji}</span>
                      <span className="text-xs font-bold text-[#172554]">
                        {dateStr} at {timeStr}
                      </span>
                      {entry.source === "seed" ? (
                        <span className="text-[10px] bg-amber-100 text-[#D97706] border border-amber-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-[#F59E0B]" />
                          <span>Demo</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-blue-50 text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">
                          User
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Fatigue: {entry.fatigue}/5
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-semibold text-[#172554]">Symptoms: </span>
                      <span>
                        Tremor {SYMPTOM_LABELS[entry.symptoms.tremor]} • Slowness{" "}
                        {SYMPTOM_LABELS[entry.symptoms.slowness]} • Freezing{" "}
                        {SYMPTOM_LABELS[entry.symptoms.freezing]}
                      </span>
                    </div>

                    {entry.sleepHours !== undefined && (
                      <div className="text-[11px] font-semibold text-purple-700 shrink-0 ml-2">
                        🌙 {entry.sleepHours}h ({entry.sleepQuality}★)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
