"use client";

import React, { useState, useEffect } from "react";
import { getWeeklyDose, WeeklyDoseResult, CYCLE_II_CITATION } from "@/lib/exerciseDose";
import { Card } from "@/components/Card";
import { Flame, Info, CheckCircle2, Award, Activity } from "lucide-react";

interface WeeklyExerciseDoseCardProps {
  className?: string;
  isDemoMode?: boolean;
}

export const WeeklyExerciseDoseCard: React.FC<WeeklyExerciseDoseCardProps> = ({
  className = "",
  isDemoMode = true,
}) => {
  const [dose, setDose] = useState<WeeklyDoseResult>(() => getWeeklyDose(isDemoMode));
  const [showCitation, setShowCitation] = useState(false);

  useEffect(() => {
    const updateDose = () => {
      setDose(getWeeklyDose(isDemoMode));
    };
    updateDose();
    window.addEventListener("focus", updateDose);
    window.addEventListener("storage", updateDose);
    return () => {
      window.removeEventListener("focus", updateDose);
      window.removeEventListener("storage", updateDose);
    };
  }, [isDemoMode]);

  const minPct = Math.min(100, Math.round((dose.minutesThisWeek / dose.targetMinutes) * 100));
  const sessionPct = Math.min(100, Math.round((dose.sessionsThisWeek / dose.targetSessions) * 100));

  return (
    <Card className={`space-y-3.5 border-emerald-200 bg-emerald-50/40 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
            <Flame className="w-5 h-5 text-emerald-600 fill-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#172554] flex items-center gap-1.5">
              <span>Weekly Exercise Dose</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                CYCLE-II Protocol
              </span>
            </h2>
            <div className="text-[10px] text-[#64748B]">Cadence-paced aerobic target</div>
          </div>
        </div>

        {/* Info Citation Toggle Button */}
        <button
          type="button"
          onClick={() => setShowCitation(!showCitation)}
          className="p-1.5 text-slate-400 hover:text-emerald-700 rounded-full hover:bg-emerald-100/60 transition-colors cursor-pointer"
          title="Click for clinical trial citation"
          aria-label="Clinical trial citation note"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* One-line Citation Note visible on tap/hover */}
      {showCitation && (
        <div className="p-2.5 bg-white/90 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 font-normal leading-relaxed animate-in fade-in duration-150">
          <span className="font-bold text-emerald-900 block mb-0.5">Clinical Protocol Basis:</span>
          {CYCLE_II_CITATION}
        </div>
      )}

      {/* Dual Progress Bars: Minutes & Sessions */}
      <div className="space-y-3 pt-1">
        {/* Progress 1: Cadence-Paced Minutes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              Cadence Sync Minutes
            </span>
            <span className="font-mono font-extrabold text-[#172554]">
              {dose.minutesThisWeek} / {dose.targetMinutes} min
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${minPct}%` }}
            />
          </div>
        </div>

        {/* Progress 2: Weekly Sessions */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              Weekly Sessions
            </span>
            <span className="font-mono font-extrabold text-[#172554]">
              {dose.sessionsThisWeek} / {dose.targetSessions} sessions
            </span>
          </div>

          {/* Session Badges (3 Session Dots) */}
          <div className="flex items-center gap-2 pt-0.5">
            {[1, 2, 3].map((num) => {
              const isDone = num <= dose.sessionsThisWeek;
              return (
                <div
                  key={num}
                  className={`flex-1 py-1.5 rounded-xl border text-center text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isDone
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-white text-slate-400 border-slate-200"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : null}
                  <span>Session {num}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};
