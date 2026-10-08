"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getStreakState,
  getGameSessions,
  getPersonalBaseline,
  StreakState,
} from "@/lib/games";
import {
  Flame,
  Snowflake,
  Play,
  TrendingUp,
  Target,
  Music,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Brain,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function GamesHomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [streakState, setStreakState] = useState<StreakState | null>(null);
  const [focusBaseline, setFocusBaseline] = useState<any>(null);
  const [rhythmBaseline, setRhythmBaseline] = useState<any>(null);
  const [pianoBaseline, setPianoBaseline] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const streak = getStreakState();
    setStreakState(streak);

    const fBase = getPersonalBaseline("focus-target");
    const rBase = getPersonalBaseline("rhythm-tap");
    const pBase = getPersonalBaseline("finger-piano");
    setFocusBaseline(fBase);
    setRhythmBaseline(rBase);
    setPianoBaseline(pBase);
  }, []);

  if (!mounted || !streakState) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading Daily Brain &amp; Movement...</div>
      </div>
    );
  }

  // Week strip calculation (MON to SUN)
  const todayIso = new Date().toISOString().split("T")[0];
  const isTodayCompleted = streakState.monthlyCompletedDays.includes(todayIso);

  const getWeekDays = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);

    const days = [];
    const labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const isToday = iso === todayIso;
      const isFuture = d > now && !isToday;
      const isCompleted = streakState.monthlyCompletedDays.includes(iso);
      days.push({
        iso,
        label: labels[i],
        isToday,
        isFuture,
        isCompleted,
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 flex flex-col justify-between max-w-lg mx-auto space-y-5 text-left">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/today")}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Back to Today"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-400" />
              <span>Engagement &amp; Movement Support</span>
            </h1>
            <p className="text-xs text-slate-400">General exercise and engagement support</p>
          </div>
        </div>

        <Link
          href="/games/progress"
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          <span>Progress</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Mandatory Exercise & Engagement Support Disclaimer */}
      <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-2xl text-xs text-amber-200 space-y-1">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>General Engagement Support Notice</span>
        </div>
        <p className="text-[11px] text-amber-200 font-normal leading-relaxed">
          These games provide general exercise and engagement support only. Please <strong>check with your doctor or physiotherapist first</strong>. STEADY makes no medical treatment or cognitive-benefit claims.
        </p>
      </div>


      {/* 🔥 VISUAL STREAK CARD WITH MON-SUN WEEK STRIP */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between border-b border-indigo-900/40 pb-2.5">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-white uppercase tracking-wide">
              🔥 {streakState.currentStreak} Day Streak
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-bold text-blue-300">
              🛡️ {streakState.streakFreezesAvailable} Freeze Available
            </span>
          </div>
        </div>

        {/* MON-SUN Week Strip */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2 font-medium">
            <span>THIS WEEK&apos;S PROGRESS</span>
            <span>{streakState.monthlyCompletedDays.length} total active days</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekDays.map((wD) => (
              <div
                key={wD.iso}
                className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  wD.isCompleted
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : wD.isToday
                    ? "bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-2 ring-indigo-400/30"
                    : "bg-slate-900/80 border-slate-800 text-slate-500"
                }`}
              >
                <span className="text-[9px] font-bold uppercase">{wD.label}</span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    wD.isCompleted
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : wD.isToday
                      ? "bg-indigo-400 text-slate-950 font-bold animate-pulse"
                      : "bg-slate-800"
                  }`}
                >
                  {wD.isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                  ) : wD.isToday ? (
                    <span className="text-[10px]">●</span>
                  ) : (
                    <span className="text-[9px] text-slate-600">•</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's completion status prompt */}
        {!isTodayCompleted ? (
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200 font-medium">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Today&apos;s workout is ready! Complete to extend your streak.</span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 font-semibold justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Today&apos;s session complete! Great work keeping your streak.</span>
          </div>
        )}
      </div>

      {/* TODAY'S DAILY SESSION CARD */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
              Today&apos;s Workout
            </span>
            <h2 className="text-lg font-extrabold text-white mt-0.5">Dual Cognitive-Rhythmic Session</h2>
          </div>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2.5 py-1 rounded-full border border-indigo-500/30">
            ~4 min total
          </span>
        </div>

        {/* Module breakdown */}
        <div className="space-y-2.5">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">1. Focus Target</h3>
                <p className="text-xs text-slate-400">Visual search &amp; sequence memory</p>
              </div>
            </div>
            {focusBaseline && (
              <span className="text-[11px] text-indigo-300 font-semibold font-mono">
                {focusBaseline.meanAccuracy}% baseline
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">2. Rhythm Tap</h3>
                <p className="text-xs text-slate-400">Auditory beat pacing entrainment</p>
              </div>
            </div>
            {rhythmBaseline && (
              <span className="text-[11px] text-blue-300 font-semibold font-mono">
                {rhythmBaseline.meanAccuracy}% baseline
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">3. Finger Piano <span className="text-[10px] text-purple-300 font-normal">(Quick, 6 sec)</span></h3>
                <p className="text-xs text-slate-400">3-key sequence memory recall</p>
              </div>
            </div>
            {pianoBaseline && (
              <span className="text-[11px] text-purple-300 font-semibold font-mono">
                {pianoBaseline.meanAccuracy}% baseline
              </span>
            )}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={() => router.push("/games/session")}
          className="w-full min-h-[52px] py-3.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>{isTodayCompleted ? "Replay Today's Session" : "Start Today's Session"}</span>
        </button>
      </div>

      {/* YOUR PROGRESS LINK */}
      <Link
        href="/games/progress"
        className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-indigo-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
              Your Baseline &amp; Milestones
            </h3>
            <p className="text-xs text-slate-400">View streak consistency, achievements &amp; history</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
      </Link>
    </div>
  );
}
