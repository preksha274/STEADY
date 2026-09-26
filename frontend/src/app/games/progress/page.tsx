"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getGameSessions,
  getPersonalBaseline,
  getStreakState,
  GameSession,
  StreakState,
} from "@/lib/games";
import { ConfidenceBadge, ConfidenceLevel } from "@/components/ConfidenceBadge";
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Music,
  Piano,
  Flame,
  Award,
  Calendar,
  CheckCircle2,
  Sparkles,
  Trophy,
} from "lucide-react";

export default function GamesProgressPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [streakState, setStreakState] = useState<StreakState | null>(null);
  const [focusBaseline, setFocusBaseline] = useState<any>(null);
  const [rhythmBaseline, setRhythmBaseline] = useState<any>(null);
  const [pianoBaseline, setPianoBaseline] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const all = getGameSessions();
    setSessions(all);
    setStreakState(getStreakState());
    setFocusBaseline(getPersonalBaseline("focus-target"));
    setRhythmBaseline(getPersonalBaseline("rhythm-tap"));
    setPianoBaseline(getPersonalBaseline("finger-piano"));
  }, []);

  if (!mounted || !streakState) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading Progress Hub...</div>
      </div>
    );
  }

  const focusSessions = sessions.filter((s) => s.gameId === "focus-target");
  const rhythmSessions = sessions.filter((s) => s.gameId === "rhythm-tap");
  const pianoSessions = sessions.filter((s) => s.gameId === "finger-piano");

  const latestFocus = focusSessions[0];
  const latestRhythm = rhythmSessions[0];
  const latestPiano = pianoSessions[0];

  const focusDiff =
    latestFocus && focusBaseline
      ? latestFocus.accuracy - focusBaseline.meanAccuracy
      : 0;

  const rhythmDiff =
    latestRhythm && rhythmBaseline
      ? latestRhythm.accuracy - rhythmBaseline.meanAccuracy
      : 0;

  const pianoDiff =
    latestPiano && pianoBaseline
      ? latestPiano.accuracy - pianoBaseline.meanAccuracy
      : 0;

  // Monthly consistency calculation (out of 30 days)
  const monthlyCount = Math.min(30, streakState.monthlyCompletedDays.length);
  const monthlyPct = Math.round((monthlyCount / 30) * 100);

  // Milestone Definitions
  const totalSessions = sessions.length;
  const milestones = [
    {
      id: "m-1",
      title: "First Session",
      desc: "Complete your first game",
      icon: "🏅",
      achieved: totalSessions > 0,
      color: "border-amber-400/50 bg-amber-500/10 text-amber-300",
    },
    {
      id: "m-3",
      title: "3-Day Streak",
      desc: "Maintain 3 consecutive days",
      icon: "🔥",
      achieved: streakState.longestStreak >= 3 || streakState.currentStreak >= 3,
      color: "border-orange-400/50 bg-orange-500/10 text-orange-300",
    },
    {
      id: "m-7",
      title: "7-Day Streak",
      desc: "Maintain 7 consecutive days",
      icon: "🔥",
      achieved: streakState.longestStreak >= 7 || streakState.currentStreak >= 7,
      color: "border-rose-400/50 bg-rose-500/10 text-rose-300",
    },
    {
      id: "m-14",
      title: "14-Day Streak",
      desc: "Maintain 14 consecutive days",
      icon: "🔥",
      achieved: streakState.longestStreak >= 14 || streakState.currentStreak >= 14,
      color: "border-purple-400/50 bg-purple-500/10 text-purple-300",
    },
    {
      id: "m-50-cog",
      title: "50 Cognitive",
      desc: "Complete 50 Focus sessions",
      icon: "🧠",
      achieved: focusSessions.length >= 50,
      color: "border-indigo-400/50 bg-indigo-500/10 text-indigo-300",
    },
    {
      id: "m-25-rhy",
      title: "25 Rhythm",
      desc: "Complete 25 Rhythm sessions",
      icon: "🎵",
      achieved: rhythmSessions.length >= 25,
      color: "border-blue-400/50 bg-blue-500/10 text-blue-300",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 flex flex-col justify-between max-w-lg mx-auto space-y-5 text-left">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/games")}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Back to Games"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>Your Progress &amp; Baseline</span>
            </h1>
            <p className="text-xs text-slate-400">Personal performance &amp; consistency trends</p>
          </div>
        </div>
      </header>

      {/* STREAK & MONTHLY CONSISTENCY BAR */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Streak</span>
            <span className="text-2xl font-black text-amber-400">🔥 {streakState.currentStreak} Days</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Longest Record</span>
            <span className="text-2xl font-black text-indigo-400">{streakState.longestStreak} Days</span>
          </div>
        </div>

        {/* Monthly Consistency Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">Monthly Consistency</span>
            <span className="text-indigo-300 font-mono">{monthlyCount} / 30 days ({monthlyPct}%)</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* PER-GAME ACCURACY VS PERSONAL BASELINE CARDS (3 CARDS) */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Per-Game Performance vs Baseline
        </h2>

        <div className="grid grid-cols-3 gap-2">
          {/* Focus Target Card */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 text-left">
            <div className="flex items-center gap-1 text-indigo-400">
              <Target className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase truncate">Focus</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block">Baseline</span>
              <span className="text-lg font-black text-white">{focusBaseline?.meanAccuracy}%</span>
            </div>
            {latestFocus && (
              <div className="pt-1 border-t border-slate-800 text-[10px] flex items-center justify-between">
                <span className="text-slate-400">Latest</span>
                <span className={`font-bold ${focusDiff >= 0 ? "text-emerald-300" : "text-slate-400"}`}>
                  {focusDiff >= 0 ? `+${focusDiff}%` : `${focusDiff}%`}
                </span>
              </div>
            )}
          </div>

          {/* Rhythm Tap Card */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 text-left">
            <div className="flex items-center gap-1 text-blue-400">
              <Music className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase truncate">Rhythm</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block">Baseline</span>
              <span className="text-lg font-black text-blue-300">{rhythmBaseline?.meanAccuracy}%</span>
            </div>
            {latestRhythm && (
              <div className="pt-1 border-t border-slate-800 text-[10px] flex items-center justify-between">
                <span className="text-slate-400">Latest</span>
                <span className={`font-bold ${rhythmDiff >= 0 ? "text-emerald-300" : "text-slate-400"}`}>
                  {rhythmDiff >= 0 ? `+${rhythmDiff}%` : `${rhythmDiff}%`}
                </span>
              </div>
            )}
          </div>

          {/* Finger Piano Card */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 text-left">
            <div className="flex items-center gap-1 text-purple-400">
              <Piano className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase truncate">Piano</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block">Baseline</span>
              <span className="text-lg font-black text-purple-300">{pianoBaseline?.meanAccuracy}%</span>
            </div>
            {latestPiano && (
              <div className="pt-1 border-t border-slate-800 text-[10px] flex items-center justify-between">
                <span className="text-slate-400">Latest</span>
                <span className={`font-bold ${pianoDiff >= 0 ? "text-emerald-300" : "text-slate-400"}`}>
                  {pianoDiff >= 0 ? `+${pianoDiff}%` : `${pianoDiff}%`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MILESTONES ROW */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Earned Milestones</span>
        </h2>

        <div className="grid grid-cols-2 gap-2.5">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-2xl border transition-all text-left flex items-start gap-2.5 ${
                m.achieved
                  ? m.color
                  : "border-slate-800/80 bg-slate-900/40 text-slate-600 grayscale opacity-60"
              }`}
            >
              <span className="text-xl shrink-0">{m.icon}</span>
              <div>
                <h3 className={`text-xs font-bold ${m.achieved ? "text-white" : "text-slate-500"}`}>
                  {m.title}
                </h3>
                <p className="text-[10px] opacity-80 mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT SESSION LOG WITH CONFIDENCE BADGE */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Session History &amp; Quality
        </h2>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {focusSessions.slice(0, 10).map((fS, idx) => {
            const rS = rhythmSessions[idx];
            const pS = pianoSessions[idx];
            const dateStr = new Date(fS.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            // Confidence check logic
            const isShort = fS.durationSec < 60 && (!rS || rS.durationSec < 60);
            const isInconsistent = fS.accuracy < 50 || (rS && rS.accuracy < 50);

            let confidenceLevel: ConfidenceLevel = "high";
            let confidenceReason = "Sufficient duration & steady signal baseline";

            if (isShort) {
              confidenceLevel = "low";
              confidenceReason = "Very short session window";
            } else if (isInconsistent) {
              confidenceLevel = "low";
              confidenceReason = "Inconsistent performance sample";
            }

            return (
              <div
                key={fS.id}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{dateStr}</span>
                    <ConfidenceBadge
                      level={confidenceLevel}
                      reason={confidenceReason}
                      showText={false}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Reaction: {fS.reactionTimeMs}ms • Piano: {pS?.accuracy || 100}%
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-mono font-extrabold text-indigo-300 block">
                    {fS.accuracy}% / {rS?.accuracy || 88}% / {pS?.accuracy || 100}%
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {confidenceReason.includes("Very short") ? "Brief" : "Recorded"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
