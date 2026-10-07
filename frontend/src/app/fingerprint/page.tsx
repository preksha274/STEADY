"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAnalysis, IMUAnalysisResult, EEGAnalysisResult, GaitAnalysisResult } from "@/context/AnalysisContext";
import { getSessions, getBaseline, getChangeFromBaseline, Session } from "@/lib/sessions";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { StatusDot } from "@/components/StatusDot";
import { TechnicalDetailsExpand } from "@/components/TechnicalDetailsExpand";
import {
  translateTremor,
  translateGait,
  translateBetaBandPower,
  translateBradykinesia,
} from "@/lib/plainLanguage";
import {
  Fingerprint as FingerprintIcon,
  Activity,
  Footprints,
  Brain,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Video,
  Clock,
  Scale,
  Gauge,
  Info,
  Hand,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";

// Combined Multi-Signal Data Points (Tremor, Gyroscope, Gait, ECG, Baseline)
const COMBINED_SIGNAL_DATA = [
  { time: "0s", tremor: 0.18, gyro: 0.12, gait: 104, ecg: 72, baseline: 0.25 },
  { time: "2s", tremor: 0.24, gyro: 0.15, gait: 106, ecg: 74, baseline: 0.25 },
  { time: "4s", tremor: 0.38, gyro: 0.28, gait: 108, ecg: 76, baseline: 0.25 },
  { time: "6s", tremor: 0.32, gyro: 0.22, gait: 105, ecg: 75, baseline: 0.25 },
  { time: "8s", tremor: 0.22, gyro: 0.16, gait: 107, ecg: 73, baseline: 0.25 },
  { time: "10s", tremor: 0.19, gyro: 0.14, gait: 106, ecg: 72, baseline: 0.25 },
  { time: "12s", tremor: 0.29, gyro: 0.21, gait: 108, ecg: 74, baseline: 0.25 },
  { time: "14s", tremor: 0.21, gyro: 0.15, gait: 106, ecg: 73, baseline: 0.25 },
];

function FingerprintContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const { imuResult: contextIMU, eegResult: contextEEG, gaitResult: contextGait, isDemoMode } = useAnalysis();
  const [mounted, setMounted] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const historicalSession = useMemo(() => {
    if (!mounted || !sessionId) return null;
    const all = getSessions(isDemoMode);
    return all.find((s) => s.id === sessionId) || null;
  }, [sessionId, isDemoMode, mounted]);

  // Fallback defaults for rich rendering
  const metrics = useMemo(() => {
    const all = getSessions(isDemoMode);
    const latestWithBrady = [...all].reverse().find((s) => s.bradykinesia);

    return {
      tremorFrequency: historicalSession?.tremor.frequencyHz || contextIMU?.metrics.tremor_frequency_hz || 4.8,
      gaitSpeed: historicalSession?.gait?.cadence || contextGait?.metrics.cadence_steps_per_min || 108,
      bandPowerBeta: (historicalSession?.eeg?.beta || contextEEG?.band_powers.beta.relative || 0.24) * 100,
      amplitude: historicalSession?.tremor.amplitude || contextIMU?.metrics.tremor_amplitude || 0.26,
      bradykinesia: historicalSession?.bradykinesia || latestWithBrady?.bradykinesia || {
        hand: "right",
        tapCount: 28,
        tapRateHz: 2.8,
        decrementPct: 18,
        updrsScore: 1,
        updrsLabel: "Slight",
        confidence: "high",
        confidenceReason: "Standard 10s finger tap recording",
      },
    };
  }, [historicalSession, contextIMU, contextGait, contextEEG, isDemoMode]);

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
      {/* Header */}
      <header className="flex items-start justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              Movement Fingerprint
            </h1>
            <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
              Core 1
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Combined multi-sensor kinematic &amp; electrophysiological profile
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-brand-gradient text-white shadow-xs shrink-0">
          <FingerprintIcon className="w-6 h-6" />
        </div>
      </header>

      {/* MIRRORMOTION SUMMARY ROW */}
      <Link
        href="/analyze/video"
        className="p-3.5 bg-white rounded-[18px] border-[0.5px] border-[#E2E8F0] shadow-xs flex items-center justify-between gap-3 hover:border-blue-300 hover:shadow-sm transition-all block cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#ECFDF5] text-[#10B981] rounded-xl shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#172554] flex items-center gap-1.5">
              <span>MirrorMotion Pose Analysis</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-medium">
                {contextGait?.confidence === "low" ? "Moderate Vis" : "Verified"}
              </span>
            </div>
            <div className="text-[11px] text-[#64748B]">
              {contextGait
                ? `Walk analyzed recently • Symmetrical step length (${contextGait.metrics.symmetry_pct}%) • ${contextGait.metrics.cadence_steps_per_min} steps/min`
                : historicalSession?.gait
                ? `Walk analyzed • Symmetrical step length (${historicalSession.gait.symmetry}%) • ${historicalSession.gait.cadence} steps/min`
                : "Walk analyzed 2 hrs ago • Symmetrical step length (94%)"}
            </div>
          </div>
        </div>
        <StatusDot status={contextGait?.confidence === "low" ? "warning" : "success"} label={contextGait ? "Live" : "Active"} size="sm" />
      </Link>

      {/* COMBINED SIGNAL CHART WITH EXACT SPEC COLOR MAPPING */}
      {/* Tremor = #6366F1, Gyroscope = #06B6D4, Gait = #10B981, ECG = #EF4444, Baseline = #8B5CF6, Warning = #F59E0B */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#6366F1]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Combined Sensor Signal
            </h2>
          </div>
          <span className="text-[10px] text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            Multi-Signal Live View
          </span>
        </div>

        {/* Legend color chips */}
        <div className="flex flex-wrap gap-2 text-[10px] font-medium pt-0.5">
          <span className="inline-flex items-center gap-1 text-[#6366F1]">
            <span className="w-2.5 h-1 rounded-full bg-[#6366F1]" /> Tremor (Indigo)
          </span>
          <span className="inline-flex items-center gap-1 text-[#06B6D4]">
            <span className="w-2.5 h-1 rounded-full bg-[#06B6D4]" /> Gyroscope (Cyan)
          </span>
          <span className="inline-flex items-center gap-1 text-[#8B5CF6]">
            <span className="w-2.5 h-1 rounded-full bg-[#8B5CF6]" /> Baseline (Purple)
          </span>
          <span className="inline-flex items-center gap-1 text-[#10B981]">
            <span className="w-2.5 h-1 rounded-full bg-[#10B981]" /> Gait (Green)
          </span>
        </div>

        <div className="h-48 w-full bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={COMBINED_SIGNAL_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 0.5]} />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />

              {/* Shaded Personal Baseline */}
              <ReferenceLine
                y={0.25}
                stroke="#8B5CF6"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "Baseline", fill: "#8B5CF6", fontSize: 10, position: "insideTopRight" }}
              />

              {/* Tremor line = Indigo #6366F1 */}
              <Line
                type="monotone"
                dataKey="tremor"
                name="Tremor (m/s²)"
                stroke="#6366F1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366F1" }}
              />

              {/* Gyroscope line = Cyan #06B6D4 */}
              <Line
                type="monotone"
                dataKey="gyro"
                name="Gyroscope (rad/s)"
                stroke="#06B6D4"
                strokeWidth={1.75}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 4 METRIC CARDS (EACH WITH A CONFIDENCE BADGE & PLAIN LANGUAGE FIRST) */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider pl-1">
          Movement Profile Metrics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Metric 1: Tremor Frequency */}
          {(() => {
            const tr = translateTremor(metrics.tremorFrequency, metrics.amplitude);
            return (
              <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-indigo-50 text-[#6366F1]">
                    <Activity className="w-4 h-4" />
                  </div>
                  <ConfidenceBadge level="high" showText={false} reason="Continuous phone IMU accelerometer sample" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Tremor Rhythm
                  </span>
                  <TechnicalDetailsExpand
                    primaryText={tr.primary}
                    explanation="Flagged because your resting tremor frequency is consistently around 4.8 Hz, which matches your typical baseline range with no sudden shifts."
                    technicalDetail={tr.technicalDetail}
                    size="md"
                    badge="Tremor Rhythm"
                  />
                </div>
              </Card>
            );
          })()}

          {/* Metric 2: Gait Speed / Cadence */}
          {(() => {
            const gt = translateGait(metrics.gaitSpeed, 94);
            return (
              <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-emerald-50 text-[#10B981]">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <ConfidenceBadge level="high" showText={false} reason="Pose estimation foot strike tracking" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Walking Speed
                  </span>
                  <TechnicalDetailsExpand
                    primaryText={gt.primary}
                    explanation="Your step timing and left-right stride symmetry match your usual daily cadence. No gait freeze or hesitation was detected."
                    technicalDetail={gt.technicalDetail}
                    size="md"
                    badge="Walking Speed"
                  />
                </div>
              </Card>
            );
          })()}

          {/* Metric 3: Band Power */}
          {(() => {
            const bt = translateBetaBandPower(metrics.bandPowerBeta);
            return (
              <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-purple-50 text-[#8B5CF6]">
                    <Brain className="w-4 h-4" />
                  </div>
                  <ConfidenceBadge level="medium" showText={false} reason="Beta power (13-30 Hz) suppression signature" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Movement Readiness
                  </span>
                  <TechnicalDetailsExpand
                    primaryText={bt.primary}
                    explanation="Your movement readiness score shows good muscle responsiveness and low hesitation when initiating a step."
                    technicalDetail={bt.technicalDetail}
                    size="md"
                    badge="Readiness"
                  />
                </div>
              </Card>
            );
          })()}

          {/* Metric 4: Amplitude */}
          {(() => {
            const trAmp = translateTremor(metrics.tremorFrequency, metrics.amplitude);
            return (
              <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-cyan-50 text-[#06B6D4]">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <ConfidenceBadge level="high" showText={false} reason="Filtered peak-to-peak acceleration amplitude" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Tremor Strength
                  </span>
                  <TechnicalDetailsExpand
                    primaryText={trAmp.primary}
                    explanation="Tremor amplitude remains low and gentle, indicating minimal physical interference during routine resting posture."
                    technicalDetail={`Tremor amplitude: ${metrics.amplitude} m/s² acceleration`}
                    size="md"
                    badge="Strength"
                  />
                </div>
              </Card>
            );
          })()}
        </div>

        {/* Metric 5: Bradykinesia Finger Tap */}
        {metrics.bradykinesia && (
          <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0] bg-amber-50/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Hand className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#172554] uppercase tracking-wider block">
                    Finger Tapping Rhythm
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    Tested hand: {metrics.bradykinesia.hand.toUpperCase()}
                  </span>
                </div>
              </div>
              <ConfidenceBadge
                level={metrics.bradykinesia.confidence}
                reason={metrics.bradykinesia.confidenceReason}
              />
            </div>

            {(() => {
              const br = translateBradykinesia(
                metrics.bradykinesia.decrementPct,
                metrics.bradykinesia.tapRateHz,
                metrics.bradykinesia.updrsScore,
                metrics.bradykinesia.updrsLabel
              );
              return (
                <div className="pt-1">
                  <TechnicalDetailsExpand
                    primaryText={br.primary}
                    explanation="Flagged because your tap speed dropped 18% partway through the test, which is more than we'd expect based on your past tests."
                    technicalDetail={br.technicalDetail}
                    size="md"
                    badge="Finger Tapping"
                  />
                </div>
              );
            })()}
          </Card>
        )}
      </div>

      {/* Navigation to Progress Timeline */}
      <Link href="/progress" className="block w-full pt-1">
        <PrimaryButton fullWidth>
          <TrendingUp className="w-4 h-4 mr-1.5" />
          <span>View Progress Timeline</span>
        </PrimaryButton>
      </Link>
    </div>
  );
}

export default function FingerprintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading fingerprint...</div>}>
      <FingerprintContent />
    </Suspense>
  );
}
