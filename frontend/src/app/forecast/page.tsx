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
import { getDiaryEntries, DiaryEntry, getDoseLogs, DoseLog } from "@/lib/diary";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { StatusDot } from "@/components/StatusDot";
import {
  Sun,
  Sparkles,
  Pill,
  Clock,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Download,
  Calendar,
  X,
  Share2,
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

export default function DayForecastNeuroDiaryPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();

  const [mounted, setMounted] = useState(false);
  const [showPreVisitSummary, setShowPreVisitSummary] = useState(false);

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

  const diaryEntries = useMemo(() => {
    if (!mounted) return [];
    return getDiaryEntries(isDemoMode);
  }, [isDemoMode, mounted]);

  const doseLogs = useMemo(() => {
    if (!mounted) return [];
    return getDoseLogs(isDemoMode);
  }, [isDemoMode, mounted]);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4 text-left">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const currentItem = forecast.hourly.find((h) => h.isCurrentHour) || forecast.hourly[0];

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Header */}
      <header className="flex items-start justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              Day Forecast &amp; Diary
            </h1>
            <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
              Core 3
            </span>
            {isDemoMode && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Simulated Demo Patient
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Hourly ON/OFF window prediction with overlaid patient context
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
          <Sun className="w-6 h-6" />
        </div>
      </header>

      {/* BEST-WINDOW BADGE HERO CARD */}
      <div className="bg-background-gradient rounded-[18px] border-[0.5px] border-[#E2E8F0] p-5 shadow-xs space-y-3 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white text-amber-500 shadow-xs">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider block">
                ✨ Best Mobility Window
              </span>
              <div className="text-xl font-bold text-[#172554] mt-0.5">
                {forecast.bestWindow ? forecast.bestWindow.timeSpanLabel : "10:00 AM – 12:30 PM"}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ConfidenceBadge level={forecast.confidenceLevel} reason="Calculated from baseline & daily diary responses" />
            <span className="text-[10px] font-medium text-[#2563EB]/90">
              {isDemoMode ? "Forecast confidence: 21 of 14 days logged" : "Forecast confidence: 5 of 14 days logged"}
            </span>
          </div>
        </div>


        <p className="text-xs text-[#172554] font-normal leading-relaxed">
          Peak medication effect interval. Movement and outdoor tasks are easiest during this window.
        </p>

        {/* HOURLY GOOD/HARD WINDOW BAR (GREEN/AMBER SEGMENTS) */}
        <div className="space-y-1.5 pt-2 border-t border-blue-100">
          <div className="flex justify-between text-[11px] font-semibold text-[#172554]">
            <span>Hourly Good/Hard Window Bar</span>
            <span className="text-slate-500 font-normal">7 AM – 9 PM</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {forecast.hourly.slice(0, 7).map((item) => (
              <div key={item.hour} className="space-y-1 text-center">
                <div
                  className={`h-3 rounded-full transition-all ${
                    item.status === "good"
                      ? "bg-[#10B981]"
                      : item.status === "variable"
                      ? "bg-[#F59E0B]"
                      : "bg-[#EF4444]"
                  }`}
                  title={`${item.hourLabel}: ${item.status}`}
                />
                <span className="text-[10px] text-[#64748B] block">{item.hourLabel.replace(":00", "")}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] font-medium pt-1">
            <span className="inline-flex items-center gap-1 text-[#065F46]">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Good Window
            </span>
            <span className="inline-flex items-center gap-1 text-[#92400E]">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Variable / Hard
            </span>
          </div>
        </div>
      </div>

      {/* EXPORT PRE-VISIT SUMMARY ACTION BUTTON */}
      <div>
        <Button
          variant="outline"
          fullWidth
          onClick={() => setShowPreVisitSummary(true)}
          className="border-[#2563EB]/40 text-[#2563EB] hover:bg-[#EFF6FF] min-h-[48px] font-medium"
        >
          <FileText className="w-4 h-4 mr-2 text-[#2563EB]" />
          <span>Export Pre-Visit Clinical Summary</span>
        </Button>
      </div>

      {/* PREDICTED DIFFICULTY CHART WITH CONFIDENCE BAND */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6366F1]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Predicted Movement Difficulty Timeline
            </h2>
          </div>
          <span className="text-[10px] text-[#6366F1] font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
            Lower is better
          </span>
        </div>

        <div className="h-44 w-full bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecast.hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
              <Area
                type="monotone"
                dataKey="bandMax"
                stroke="none"
                fill="#6366F1"
                fillOpacity={0.15}
                name="Confidence Band"
              />
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
      </Card>

      {/* DIARY ENTRY LIST OVERLAID ON THE TIMELINE */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between pl-1">
          <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            NeuroDiary Check-Ins Overlaid on Timeline
          </h2>
          <Link href="/diary" className="text-xs text-[#2563EB] font-medium hover:underline">
            + New Check-in
          </Link>
        </div>

        <div className="space-y-2.5">
          {diaryEntries.slice(0, 4).map((entry) => {
            const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            const moodEmoji = entry.mood >= 4 ? "😊 Great" : entry.mood >= 3 ? "🙂 Good" : entry.mood >= 2 ? "😐 Okay" : "😔 Tough";

            return (
              <div
                key={entry.id}
                className="p-3.5 bg-white rounded-[18px] border-[0.5px] border-[#E2E8F0] shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#10B981]" />
                    <span className="text-xs font-semibold text-[#172554]">
                      Check-in at {timeStr}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[#172554] bg-[#F8FAFC] px-2.5 py-0.5 rounded-full border border-slate-200">
                    {moodEmoji}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs bg-[#F8FAFC] p-2 rounded-xl border-[0.5px] border-[#E2E8F0]">
                  <div className="flex gap-2">
                    <span>Tremor: <strong>{entry.symptoms.tremor === 0 ? "None" : entry.symptoms.tremor === 1 ? "Mild" : "Mod"}</strong></span>
                    <span>•</span>
                    <span>Slowness: <strong>{entry.symptoms.slowness === 0 ? "None" : entry.symptoms.slowness === 1 ? "Mild" : "Mod"}</strong></span>
                  </div>
                  <span className="text-[#64748B]">Fatigue: {entry.fatigue}/5</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRE-VISIT SUMMARY MODAL */}
      {showPreVisitSummary && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172554]/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-[24px] border-[0.5px] border-[#E2E8F0] shadow-2xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2563EB]" />
                <div>
                  <h3 className="text-base font-bold text-[#172554]">
                    Pre-Visit Clinical Summary
                  </h3>
                  <p className="text-xs text-[#64748B]">Patient-generated report for doctor visit</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreVisitSummary(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-[#EFF6FF] rounded-2xl border-[0.5px] border-[#BFDBFE] space-y-1 text-xs text-[#1E40AF]">
              <div className="font-semibold">Patient: Sarah Miller • Age 64</div>
              <div>Report Period: Last 30 Days • 18 verified sessions</div>
              <div>Active Medication: Carbidopa/Levodopa 25/100mg</div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-semibold text-[#172554] uppercase tracking-wider">
                Longitudinal Observations (Compared to usual)
              </h4>
              <ul className="space-y-1.5 pl-4 list-disc text-[#64748B] font-normal">
                <li>Resting tremor frequency maintained around 4.8 Hz with ±12% stability.</li>
                <li>Peak ON mobility window observed at 2.5 to 4.5 hours post-dose.</li>
                <li>Reported wearing-off fatigue states clustered between 4:30 PM - 6:00 PM.</li>
                <li>Gait cadence steady at 106–108 steps/min during morning sessions.</li>
              </ul>
            </div>

            <p className="text-[11px] text-[#64748B] italic bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-200">
              Note: This report contains personal sensor &amp; symptom logs. It is not a clinical MDS-UPDRS score or diagnostic claim.
            </p>

            <div className="flex gap-2.5 pt-2">
              <PrimaryButton
                fullWidth
                onClick={() => {
                  alert("Pre-visit summary prepared for download / print!");
                  setShowPreVisitSummary(false);
                }}
              >
                <Download className="w-4 h-4 mr-1.5" />
                <span>Download PDF</span>
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
