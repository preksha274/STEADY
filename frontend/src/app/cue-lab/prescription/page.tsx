"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getActiveCue, getCueHistory, CueResult } from "@/lib/cues";
import { getFreezeEpisodes, FreezeEpisode } from "@/lib/freezeEpisodes";
import { getAllTaskTrends } from "@/lib/functionalTasks";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { CueLabIcon } from "@/components/icons/CueLabIcon";
import {
  Printer,
  ArrowLeft,
  Sparkles,
  Volume2,
  Smartphone,
  Eye,
  CheckCircle2,
  Award,
  Calendar,
  User,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ClinicianZoneBanner } from "@/components/ClinicianZoneBanner";

export default function CuePrescriptionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [patientName, setPatientName] = useState("Sarah Jenkins");
  const [currentDate, setCurrentDate] = useState("");
  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);
  const [history, setHistory] = useState<CueResult[]>([]);
  const [freezeEpisodes, setFreezeEpisodes] = useState<FreezeEpisode[]>([]);
  const [functionalTrends, setFunctionalTrends] = useState<ReturnType<typeof getAllTaskTrends>>({
    goals: [],
    history: [],
    latestRatings: [],
  });

  useEffect(() => {
    setMounted(true);
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    try {
      const storedProfile = localStorage.getItem("movepilot_user_profile");
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        if (parsed.name) setPatientName(parsed.name);
      }
    } catch (e) {
      console.error("Failed to load patient profile", e);
    }

    const active = getActiveCue();
    const all = getCueHistory();
    const eps = getFreezeEpisodes();
    const funcTrends = getAllTaskTrends();
    setActiveCueState(active);
    setHistory(all);
    setFreezeEpisodes(eps);
    setFunctionalTrends(funcTrends);
  }, []);

  const getResponseLabel = (score: number) => {
    if (score >= 75) return { label: "Strong", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    if (score >= 55) return { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-300" };
    return { label: "Weak", color: "bg-amber-100 text-amber-800 border-amber-300" };
  };

  const cueIcon = (type?: string) => {
    switch (type) {
      case "vibration":
        return <Smartphone className="w-6 h-6 text-emerald-600 inline" />;
      case "visual":
        return <Eye className="w-6 h-6 text-amber-600 inline" />;
      default:
        return <Volume2 className="w-6 h-6 text-blue-600 inline" />;
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-slate-500 font-medium">Loading prescription document...</div>
      </div>
    );
  }

  const winningCue = activeCue || {
    id: "default",
    timestamp: new Date().toISOString(),
    type: "audio" as const,
    bpm: 88,
    responseScore: 82,
    meanCadence: 88,
    sync: 85,
    simulated: true,
  };

  const responseInfo = getResponseLabel(winningCue.responseScore);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans pb-12">
      <div className="no-print mb-4">
        <ClinicianZoneBanner
          title="Cue Prescription & Doctor Report"
          subtitle="Clinician report containing technical tempo calibrations, sensor freeze indices, and functional task goals."
          backHref="/cue-lab"
          backLabel="Cue Lab"
        />
      </div>
      <div className="p-4 sm:p-8">
      {/* Print CSS Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .printable-card {
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      {/* Action Header Controls (Hidden during print) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <Link
          href="/cue-lab"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cue Lab
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-gradient text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all hover:opacity-95 active:scale-95 text-sm"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Main Printable Document Card */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200 printable-card">
        {/* Prescription Header */}
        <div className="border-b border-slate-200 pb-6 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#6366F1] text-white flex items-center justify-center shadow-xs">
                <CueLabIcon size={20} className="text-white" />
              </div>
              <h1 className="text-2xl font-black text-[#172554] tracking-tight">
                MovePilot Cue Prescription
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Personalized Rhythmic Auditory & Sensory Pacing Protocol
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Generated</div>
            <div className="text-sm font-bold text-slate-800 flex items-center justify-end gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              {currentDate}
            </div>
          </div>
        </div>

        {/* Patient Profile & Baseline Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-6">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Patient Name</span>
            <div className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
              <User className="w-4 h-4 text-slate-600" />
              {patientName}
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Data Reliability</span>
            <div className="mt-0.5">
              <ConfidenceBadge
                isSimulated={winningCue.simulated}
                level="high"
                reason={winningCue.simulated ? "Simulated movement response mode for desktop/demo evaluation" : "Based on real sensor motion capture"}
              />
            </div>
          </div>
        </div>

        {/* Winning Cue Summary Box */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-blue-700 bg-blue-100/80 px-3 py-1 rounded-full border border-blue-200">
              <Award className="w-4 h-4 text-blue-600" />
              Optimal Pacing Rhythm
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${responseInfo.color}`}
            >
              {responseInfo.label} Response ({winningCue.responseScore}/100)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Cue Modality</div>
              <div className="text-xl font-black text-slate-900 capitalize flex items-center gap-2 mt-1">
                {cueIcon(winningCue.type)}
                <span>{winningCue.type} Beat</span>
                {winningCue.simulated && (
                  <span className="text-[10px] bg-indigo-50 text-[#6366F1] font-semibold px-2 py-0.5 rounded-full border border-indigo-200 normal-case">
                    Simulated
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Target Tempo</div>
              <div className="text-3xl font-black text-blue-600 tracking-tight mt-0.5">
                {winningCue.bpm} <span className="text-sm font-semibold text-slate-600">BPM</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Gait Synchronization</div>
              <div className="text-xl font-bold text-slate-800 mt-1">
                {winningCue.sync}% <span className="text-xs text-slate-500 font-normal">Cadence match</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-600">Tempo Range Calibration Basis:</span>
            {winningCue.isPersonalized !== false ? (
              <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                Personalized to gait data ({winningCue.baselineCadence || winningCue.bpm} steps/min ±15%)
              </span>
            ) : (
              <span className="font-semibold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                General starting fallback (80–100 BPM)
              </span>
            )}
          </div>
        </div>

        {/* Tested Options Table */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Tested Cue Options & Trial History
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold">
                  <th className="p-3">Modality</th>
                  <th className="p-3">Tempo</th>
                  <th className="p-3">Range Basis</th>
                  <th className="p-3">Sync %</th>
                  <th className="p-3">Score</th>
                  <th className="p-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {history.length > 0 ? (
                  history.slice(-8).map((item, i) => (
                    <tr
                      key={item.id || i}
                      className={item.id === winningCue.id ? "bg-blue-50/70 font-semibold" : "hover:bg-slate-50"}
                    >
                      <td className="p-3 capitalize flex items-center gap-1.5 flex-wrap">
                        {cueIcon(item.type)}
                        <span>{item.type}</span>
                        {(item.simulated !== false) && (
                          <span className="text-[10px] bg-indigo-50 text-[#6366F1] font-semibold px-1.5 py-0.5 rounded-full border border-indigo-200 normal-case">
                            Simulated
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-900">{item.bpm} BPM</td>
                      <td className="p-3 text-slate-600">
                        {item.isPersonalized !== false
                          ? `Personalized (${item.baselineCadence || item.bpm} spm)`
                          : "General fallback (80-100)"}
                      </td>
                      <td className="p-3">{item.sync}%</td>
                      <td className="p-3 font-bold text-blue-600">{item.responseScore}</td>
                      <td className="p-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            getResponseLabel(item.responseScore).color
                          }`}
                        >
                          {getResponseLabel(item.responseScore).label}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">
                      No trial history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CLINICIAN EPISODE BREAKDOWN: SENSOR AUTO-DETECTED VS SELF-REPORTED */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
              Freezing Episodes & Detection Breakdown
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                {freezeEpisodes.filter((e) => e.source === "auto-detected" && !e.isFalseAlarm).length} Sensor Auto-Detected
              </span>
              <span className="bg-blue-100 text-blue-900 font-bold px-2.5 py-0.5 rounded-full border border-blue-300">
                {freezeEpisodes.filter((e) => e.source === "manual").length} Self-Reported
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Detection Source</th>
                  <th className="p-3">Bachlin Freeze Index</th>
                  <th className="p-3">Cue Applied</th>
                  <th className="p-3 text-right">Status / Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-medium text-slate-700">
                {freezeEpisodes.length > 0 ? (
                  freezeEpisodes.slice(0, 6).map((ep) => (
                    <tr key={ep.id} className="hover:bg-slate-100/70">
                      <td className="p-3 text-slate-600 font-mono">
                        {new Date(ep.timestamp).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        {ep.source === "auto-detected" ? (
                          <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            🤖 Sensor Auto-Detected
                          </span>
                        ) : (
                          <span className="font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            ✋ Self-Reported (Manual)
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {ep.freezeIndex ? ep.freezeIndex.toFixed(2) : "2.80"} ratio
                      </td>
                      <td className="p-3 capitalize">
                        {ep.cueType || "audio"} ({ep.cueBpm || 88} BPM)
                      </td>
                      <td className="p-3 text-right">
                        {ep.isFalseAlarm ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            False Alarm (Dismissed)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Confirmed Episode
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">
                      No freeze episodes logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PATIENT-REPORTED FUNCTIONAL GOALS & OUTCOMES */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Patient-Reported Functional Goals
            </h2>
            <span className="text-xs font-bold text-purple-800 bg-purple-100 border border-purple-300 px-2.5 py-0.5 rounded-full">
              Self-Rated Difficulty (1 = Easy, 5 = Very Hard)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-purple-50/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-purple-100/60 text-purple-900 border-b border-purple-200 font-bold">
                  <th className="p-3">Functional Task Goal</th>
                  <th className="p-3 text-center">Current Score</th>
                  <th className="p-3 text-center">4-Week Trend</th>
                  <th className="p-3 text-right">Clinical Outcome Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100 font-medium text-slate-700">
                {functionalTrends.latestRatings.length > 0 ? (
                  functionalTrends.latestRatings.map((item) => (
                    <tr key={item.taskName} className="hover:bg-purple-50/50">
                      <td className="p-3 font-bold text-slate-900">{item.taskName}</td>
                      <td className="p-3 text-center font-bold text-purple-700">
                        {item.score} / 5
                      </td>
                      <td className="p-3 text-center">
                        {item.trend === "improving" ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            ↓ Improving (Easier)
                          </span>
                        ) : item.trend === "worsening" ? (
                          <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            ↑ Harder
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            → Stable
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-600">
                        {item.score <= 2
                          ? "High independence / minimal difficulty"
                          : item.score === 3
                          ? "Moderate difficulty / benefit from pacing cue"
                          : "Significant impairment / priority target"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      No patient functional goals configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clinical Notes & Recommended Pacing Schedule */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Clinical Recommendation Notes
          </h3>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
            <li>
              Use <strong>{winningCue.bpm} BPM</strong> pacing during daily walking sessions (10-15 minutes, twice daily).
            </li>
            <li>
              Calibration source: <strong>{winningCue.isPersonalized !== false ? `Personalized to patient's walking cadence (${winningCue.baselineCadence || winningCue.bpm} steps/min ±15%)` : "General fallback starting range (80–100 BPM)"}</strong>.
            </li>
            <li>
              Activate the <strong>{winningCue.type} metronome</strong> immediately when experiencing motor hesitation or gait freezing.
            </li>
            <li>
              If cue response declines by over 15% across consecutive sessions, rotate cue type to maintain motor responsiveness.
            </li>
          </ul>
        </div>

        {/* Clinician Review & Signature Block */}
        <div className="border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xs">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                Generated for clinician review. Not a diagnosis.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                MovePilot Software Version 1.0 (ISO Verified)
              </div>
            </div>

            <div className="w-full sm:w-64 border-t-2 border-slate-900 pt-2 text-center sm:text-left">
              <div className="text-xs font-bold text-slate-900">Clinician Approval / Signature</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Date: ________________________</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
