"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  buildForecast,
  DayForecastResult,
  HourlyForecastItem,
  MergedForecastWindow,
} from "@/lib/forecast";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  Sun,
  Sparkles,
  CloudSun,
  Pill,
  Clock,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ForecastPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute Day Forecast
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

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554]">Day Forecast</h1>
            <p className="text-xs text-[#64748B]">Hourly movement & mobility prediction</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
            <Sun className="w-6 h-6" />
          </div>
        </header>
        <Card className="animate-pulse py-12 text-center text-slate-400">
          Building your daily forecast...
        </Card>
      </div>
    );
  }

  const currentItem = forecast.hourly.find((h) => h.isCurrentHour) || forecast.hourly[0];

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {/* SECTION 1: HEADER WEATHER CARD WITH GRADIENT */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white p-6 shadow-xl space-y-4">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-white/20 backdrop-blur-md text-amber-300">
              <Sun className="w-6 h-6 animate-pulse" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
              Movement Outlook • Today
            </span>
          </div>
          {forecast.coverageLevel === "low" && (
            <span className="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
              Early estimate
            </span>
          )}
        </div>

        <div className="relative z-10 space-y-1">
          <div className="text-xs text-blue-100 font-medium">Optimal Movement Window</div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            {forecast.bestWindow
              ? forecast.bestWindow.timeSpanLabel
              : "10:00 AM - 12:00 PM"}
          </h1>
          <p className="text-xs text-blue-100/90 font-medium pt-1">
            {forecast.bestWindow
              ? `${forecast.bestWindow.title} based on medication response curve`
              : "Best mobility interval for walking or daily activities"}
          </p>
        </div>

        {currentItem && (
          <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs relative z-10">
            <span className="font-semibold text-blue-100">Current Hour ({currentItem.hourLabel})</span>
            <span className="font-bold flex items-center gap-1 bg-white/20 px-2.5 py-0.5 rounded-full">
              {currentItem.status === "good" ? "🟢 Good mobility" : currentItem.status === "variable" ? "🟡 Variable" : "🔴 Difficult"}
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: HORIZONTAL SCROLLABLE HOURLY STRIP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pl-1">
          <span className="text-xs font-bold text-[#172554] uppercase tracking-wider">
            Hourly Mobility Strip (7 AM - 9 PM)
          </span>
          <span className="text-[11px] text-slate-400">Scroll →</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
          {forecast.hourly.map((item) => (
            <div
              key={item.hour}
              className={`flex flex-col items-center justify-between p-2.5 rounded-2xl shrink-0 w-16 border transition-all ${
                item.isCurrentHour
                  ? "bg-white border-blue-500 ring-2 ring-blue-500 shadow-md scale-105"
                  : "bg-white border-slate-200"
              }`}
            >
              <span className="text-[10px] font-bold text-[#64748B]">
                {item.hourLabel.replace(":00", "")}
              </span>
              <div className="my-1.5">
                {item.status === "good" ? (
                  <span className="text-lg">🟢</span>
                ) : item.status === "variable" ? (
                  <span className="text-lg">🟡</span>
                ) : (
                  <span className="text-lg">🔴</span>
                )}
              </div>
              <span className="text-[9px] font-extrabold text-[#172554]">
                {Math.round((1 - item.score) * 100)}% ON
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: PREDICTED DIFFICULTY RECHARTS AREA CHART */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6366F1]" />
            <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
              Predicted Difficulty Curve
            </h2>
          </div>
          {forecast.coverageLevel === "low" && (
            <span className="text-[10px] bg-amber-100 text-[#D97706] font-bold px-2 py-0.5 rounded-full border border-amber-200">
              Early estimate
            </span>
          )}
        </div>

        {forecast.coverageLevel === "none" ? (
          /* HONEST EMPTY STATE WHEN NO DATA AVAILABLE */
          <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172554]">Not Enough Data Yet</h3>
              <p className="text-xs text-[#64748B] max-w-xs mx-auto mt-1">
                Complete a few more daily check-ins and dose logs to build your personal forecast.
              </p>
            </div>
            <Link href="/diary" className="block w-full pt-1">
              <Button variant="primary" fullWidth size="md" className="bg-brand-gradient">
                <BookOpen className="w-4 h-4 mr-2" />
                <span>Log Today&apos;s Check-in</span>
              </Button>
            </Link>
          </div>
        ) : (
          /* PREDICTED DIFFICULTY CHART WITH CONFIDENCE BAND */
          <div className="h-44 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast.hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `${Math.round(val * 100)}%`}
                />
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "12px" }}
                  formatter={(val: any) => [`${Math.round(Number(val) * 100)}% Difficulty`, "Predicted Difficulty"]}
                />

                {/* Shaded Confidence Band (Light Indigo) */}
                <Area
                  type="monotone"
                  dataKey="bandMax"
                  stroke="none"
                  fill="#6366F1"
                  fillOpacity={0.18}
                  name="Confidence Band"
                />

                {/* Main Predicted Score Line */}
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Difficulty"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#6366F1" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* SECTION 4: WINDOW SUMMARY ROWS */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider pl-1">
          Daily Mobility Windows
        </h2>

        {forecast.windows.map((win, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
              win.status === "good"
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                : win.status === "variable"
                ? "bg-amber-50/90 border-amber-200 text-amber-900"
                : "bg-rose-50/90 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {win.status === "good" ? "🟢" : win.status === "variable" ? "🟡" : "🔴"}
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {win.title}
                </div>
                <div className="text-sm font-extrabold mt-0.5">{win.timeSpanLabel}</div>
              </div>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                win.status === "good"
                  ? "bg-emerald-200 text-emerald-900"
                  : win.status === "variable"
                  ? "bg-amber-200 text-amber-900"
                  : "bg-rose-200 text-rose-900"
              }`}
            >
              {win.status === "good"
                ? "Best for walking"
                : win.status === "variable"
                ? "Moderate fatigue"
                : "Wearing off"}
            </span>
          </div>
        ))}
      </div>

      {/* SECTION 5: CONFIDENCE BAR & REASONS LIST */}
      <Card className="space-y-3 bg-slate-50/80 border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Forecast Confidence ({forecast.confidenceScore}%)
            </span>
          </div>
          <ConfidenceBadge
            level={forecast.confidenceLevel}
            reason={`Based on ${forecast.reasons.join(", ")}`}
          />
        </div>

        {/* Confidence Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              forecast.confidenceLevel === "high"
                ? "bg-emerald-500"
                : forecast.confidenceLevel === "medium"
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${forecast.confidenceScore}%` }}
          />
        </div>

        {/* Based On Tag List */}
        <div className="pt-1">
          <span className="text-[11px] font-semibold text-[#64748B] block mb-1.5">
            Forecast based on:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {forecast.reasons.map((r) => (
              <span
                key={r}
                className="text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full"
              >
                ✓ {r}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
