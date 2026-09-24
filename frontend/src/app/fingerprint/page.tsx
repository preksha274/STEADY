"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAnalysis, IMUAnalysisResult, EEGAnalysisResult, GaitAnalysisResult } from "@/context/AnalysisContext";
import { getSessions, getBaseline, getChangeFromBaseline, Session } from "@/lib/sessions";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DataQualityStrip } from "@/components/DataQualityStrip";
import {
  Fingerprint as FingerprintIcon,
  Activity,
  Video,
  Brain,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Footprints,
  Scale,
  Info,
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
} from "recharts";

function FingerprintContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const { imuResult: contextIMU, eegResult: contextEEG, gaitResult: contextGait, isDemoMode } = useAnalysis();
  const [mounted, setMounted] = useState(false);
  const [showSignalChart, setShowSignalChart] = useState(true);
  const [showBaselineComparison, setShowBaselineComparison] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If sessionId query param exists, load stored session from localStorage
  const historicalSession = useMemo(() => {
    if (!mounted || !sessionId) return null;
    const all = getSessions(isDemoMode);
    return all.find((s) => s.id === sessionId) || null;
  }, [sessionId, isDemoMode, mounted]);

  // Construct effective analysis results
  const imuResult: IMUAnalysisResult | null = useMemo(() => {
    if (historicalSession) {
      return {
        metrics: {
          tremor_frequency_hz: historicalSession.tremor.frequencyHz,
          tremor_amplitude: historicalSession.tremor.amplitude,
          intensity: historicalSession.tremor.intensity,
          signal_magnitude: 9.81,
          variability: 0.1,
          gyro_rms: 0.05,
        },
        quality: {
          duration_s: 30,
          sample_rate_hz: 100,
          missing_samples_pct: 0,
          is_short: false,
          is_noisy: false,
        },
        confidence: historicalSession.tremor.confidence,
        confidence_reason: historicalSession.tremor.confidenceReason,
        chart_data: {
          signal: [
            { time_s: 0, raw_magnitude: 9.8, filtered_magnitude: 0.1 },
            { time_s: 5, raw_magnitude: 9.9, filtered_magnitude: 0.4 },
            { time_s: 10, raw_magnitude: 9.8, filtered_magnitude: 0.2 },
          ],
          psd: [
            { freq_hz: 1, power: 0.01 },
            { freq_hz: 3, power: 0.05 },
            { freq_hz: historicalSession.tremor.frequencyHz, power: 0.45 },
            { freq_hz: 8, power: 0.04 },
            { freq_hz: 12, power: 0.01 },
          ],
        },
        analyzed_at: historicalSession.timestamp,
      };
    }
    return contextIMU;
  }, [historicalSession, contextIMU]);

  const gaitResult: GaitAnalysisResult | null = useMemo(() => {
    if (historicalSession && historicalSession.gait) {
      return {
        metrics: {
          cadence_steps_per_min: historicalSession.gait.cadence,
          step_count: Math.round((historicalSession.gait.cadence / 60) * 10),
          symmetry_pct: historicalSession.gait.symmetry,
          gait_speed_category: "typical",
        },
        quality: {
          duration_s: 10,
          avg_foot_visibility: 0.9,
          is_feet_visible: true,
          frame_count: 100,
        },
        confidence: historicalSession.gait.confidence,
        confidence_reason: "Historical gait record",
        analyzed_at: historicalSession.timestamp,
      };
    }
    return contextGait;
  }, [historicalSession, contextGait]);

  const eegResult: EEGAnalysisResult | null = useMemo(() => {
    if (historicalSession && historicalSession.eeg) {
      return {
        channel_count: 4,
        channels: ["ch1", "ch2", "ch3", "ch4"],
        band_powers: {
          delta: { absolute: 0.05, relative: historicalSession.eeg.delta, band_hz: [0.5, 4] },
          theta: { absolute: 0.08, relative: historicalSession.eeg.theta, band_hz: [4, 8] },
          alpha: { absolute: 0.65, relative: historicalSession.eeg.alpha, band_hz: [8, 13] },
          beta: { absolute: 0.2, relative: historicalSession.eeg.beta, band_hz: [13, 30] },
          total_power_0_5_30hz: 1.0,
        },
        quality: {
          duration_s: 60,
          sample_rate_hz: 250,
          flat_channels: [],
          artifact_channels: [],
          line_noise_present: false,
          is_short: false,
        },
        confidence: historicalSession.eeg.confidence,
        confidence_reason: "Historical EEG record",
        chart_data: { psd: [] },
        analyzed_at: historicalSession.timestamp,
      };
    }
    return contextEEG;
  }, [historicalSession, contextEEG]);

  // Construct dummy session object for baseline calculation
  const currentSessionObject: Session | null = useMemo(() => {
    if (historicalSession) return historicalSession;
    if (!imuResult) return null;
    return {
      id: "current",
      timestamp: imuResult.analyzed_at || new Date().toISOString(),
      tremor: {
        frequencyHz: imuResult.metrics.tremor_frequency_hz,
        amplitude: imuResult.metrics.tremor_amplitude,
        intensity: imuResult.metrics.intensity,
        confidence: imuResult.confidence,
        confidenceReason: imuResult.confidence_reason,
      },
      gait: gaitResult
        ? {
            cadence: gaitResult.metrics.cadence_steps_per_min,
            symmetry: gaitResult.metrics.symmetry_pct,
            confidence: gaitResult.confidence,
          }
        : undefined,
      eeg: eegResult
        ? {
            delta: eegResult.band_powers.delta.relative,
            theta: eegResult.band_powers.theta.relative,
            alpha: eegResult.band_powers.alpha.relative,
            beta: eegResult.band_powers.beta.relative,
            confidence: eegResult.confidence,
          }
        : undefined,
      source: "upload",
    };
  }, [historicalSession, imuResult, gaitResult, eegResult]);

  const baseline = useMemo(() => {
    return currentSessionObject ? getBaseline(currentSessionObject, isDemoMode) : null;
  }, [currentSessionObject, isDemoMode]);

  const baselineComparison = useMemo(() => {
    return currentSessionObject ? getChangeFromBaseline(currentSessionObject, isDemoMode) : null;
  }, [currentSessionObject, isDemoMode]);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Empty State
  if (!imuResult && !gaitResult && !eegResult) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              Movement Fingerprint
            </h1>
            <p className="text-xs text-[#64748B]">Your unique motor symptom profile</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-purple-50 text-[#8B5CF6]">
            <FingerprintIcon className="w-6 h-6" />
          </div>
        </header>

        <Card className="text-center py-10 space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-50 text-[#8B5CF6] flex items-center justify-center mx-auto">
            <FingerprintIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172554]">No Movement Fingerprint Yet</h2>
            <p className="text-xs text-[#64748B] max-w-xs mx-auto mt-1">
              Run an IMU motion or video gait analysis to generate your personal movement profile.
            </p>
          </div>
          <Link href="/analyze" className="block w-full">
            <Button variant="primary" fullWidth size="lg" className="bg-brand-gradient">
              <Sparkles className="w-4 h-4 mr-2" />
              <span>Run First Analysis</span>
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const formattedDate = (imuResult?.analyzed_at || gaitResult?.analyzed_at || eegResult?.analyzed_at)
    ? new Date(
        imuResult?.analyzed_at || gaitResult?.analyzed_at || eegResult?.analyzed_at || ""
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";

  const isCurrentDemoData = historicalSession
    ? historicalSession.source === "seed" || historicalSession.source === "demo"
    : isDemoMode;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                Movement Fingerprint
              </h1>
              {historicalSession?.source === "live" ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Live</span>
                </span>
              ) : isCurrentDemoData ? (
                <span className="text-[10px] bg-amber-100 text-[#D97706] border border-amber-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-[#F59E0B]" />
                  <span>Demo data</span>
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[#64748B]" suppressHydrationWarning>
              {sessionId ? "Historical session" : "Session"} recorded at {formattedDate}
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-brand-gradient text-white shadow-sm">
            <FingerprintIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Quality Strip */}
        <DataQualityStrip
          motion={
            imuResult
              ? { active: true, confidence: imuResult.confidence, reason: imuResult.confidence_reason }
              : { active: false }
          }
          camera={
            gaitResult
              ? { active: true, confidence: gaitResult.confidence, reason: gaitResult.confidence_reason }
              : { active: false }
          }
          eeg={
            eegResult
              ? { active: true, confidence: eegResult.confidence, reason: eegResult.confidence_reason }
              : { active: false }
          }
        />
      </header>

      {/* BASELINE COMPARISON OVERLAY CARD */}
      {showBaselineComparison && (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#8B5CF6]" />
              <h3 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                Personal Baseline Comparison
              </h3>
            </div>
            {baseline && (
              <span className="text-[10px] bg-purple-100 text-[#8B5CF6] font-bold px-2 py-0.5 rounded-full">
                {baseline.sampleCount} prior sessions
              </span>
            )}
          </div>

          {!baseline ? (
            <div className="bg-white/80 p-3 rounded-xl border border-purple-100 text-xs text-purple-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-500 shrink-0" />
              <span>Not enough history yet (Requires 3+ prior sessions to compute personal baseline).</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {/* Tremor Amp Comparison */}
              {baselineComparison?.tremorAmplitude && (
                <div className="bg-white p-3 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#172554]">Tremor Amplitude</div>
                    <div className="text-[10px] text-slate-500">
                      Current: {baselineComparison.tremorAmplitude.currentValue} m/s² | Base: {baseline.tremorAmplitudeMean} m/s²
                    </div>
                  </div>
                  <div
                    className={`font-extrabold px-2.5 py-1 rounded-full text-xs ${
                      baselineComparison.tremorAmplitude.direction === "better"
                        ? "bg-emerald-100 text-emerald-700"
                        : baselineComparison.tremorAmplitude.direction === "worse"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {baselineComparison.tremorAmplitude.direction === "better" && `↓ ${Math.abs(baselineComparison.tremorAmplitude.pctChange)}% Better`}
                    {baselineComparison.tremorAmplitude.direction === "worse" && `↑ ${Math.abs(baselineComparison.tremorAmplitude.pctChange)}% Worse`}
                    {baselineComparison.tremorAmplitude.direction === "similar" && `→ Similar (${baselineComparison.tremorAmplitude.pctChange}%)`}
                  </div>
                </div>
              )}

              {/* Gait Cadence Comparison */}
              {baselineComparison?.gaitCadence && (
                <div className="bg-white p-3 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#172554]">Gait Cadence</div>
                    <div className="text-[10px] text-slate-500">
                      Current: {baselineComparison.gaitCadence.currentValue} steps/min | Base: {baseline.gaitCadenceMean} steps/min
                    </div>
                  </div>
                  <div
                    className={`font-extrabold px-2.5 py-1 rounded-full text-xs ${
                      baselineComparison.gaitCadence.direction === "better"
                        ? "bg-emerald-100 text-emerald-700"
                        : baselineComparison.gaitCadence.direction === "worse"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {baselineComparison.gaitCadence.direction === "better" && `↑ ${Math.abs(baselineComparison.gaitCadence.pctChange)}% Better`}
                    {baselineComparison.gaitCadence.direction === "worse" && `↓ ${Math.abs(baselineComparison.gaitCadence.pctChange)}% Worse`}
                    {baselineComparison.gaitCadence.direction === "similar" && `→ Similar (${baselineComparison.gaitCadence.pctChange}%)`}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* TREMOR CARD */}
      {imuResult ? (
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172554]">Tremor Spectrum</h2>
                <div className="text-xs text-[#64748B]">Resting & movement acceleration</div>
              </div>
            </div>
            <ConfidenceBadge level={imuResult.confidence} reason={imuResult.confidence_reason} />
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
            <div>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">Dominant Freq</div>
              <div className="text-lg font-black text-[#6366F1] mt-0.5">
                {imuResult.metrics.tremor_frequency_hz}{" "}
                <span className="text-xs font-semibold text-slate-500">Hz</span>
              </div>
              <div className="text-[9px] text-slate-400">compared to usual</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">RMS Amplitude</div>
              <div className="text-lg font-black text-[#172554] mt-0.5">
                {imuResult.metrics.tremor_amplitude}{" "}
                <span className="text-xs font-semibold text-slate-500">m/s²</span>
              </div>
              <div className="text-[9px] text-slate-400">band filtered</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">Intensity</div>
              <div className="mt-1">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                    imuResult.metrics.intensity === "high"
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : imuResult.metrics.intensity === "moderate"
                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {imuResult.metrics.intensity}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">motor severity</div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                Power Spectrum (PSD) & 3-8 Hz Tremor Band
              </span>
              <button
                onClick={() => setShowSignalChart(!showSignalChart)}
                className="text-xs text-[#2563EB] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>{showSignalChart ? "Hide Signal" : "View Signal"}</span>
                {showSignalChart ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="h-44 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={imuResult.chart_data.psd} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="freq_hz" unit="Hz" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [val, "Power"]}
                    labelFormatter={(lbl) => `Freq: ${lbl} Hz`}
                    contentStyle={{ fontSize: "12px", borderRadius: "12px" }}
                  />
                  <ReferenceArea x1={3} x2={8} fill="#6366F1" fillOpacity={0.15} label="" />
                  
                  {/* Purple Baseline Reference Marker */}
                  {showBaselineComparison && baseline && (
                    <ReferenceLine
                      x={baseline.tremorFrequencyMean}
                      stroke="#8B5CF6"
                      strokeDasharray="3 3"
                      strokeWidth={2}
                      label={{
                        value: `Base: ${baseline.tremorFrequencyMean}Hz`,
                        fill: "#8B5CF6",
                        fontSize: 10,
                      }}
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="power"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fill="#6366F1"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {showSignalChart && (
              <div className="space-y-1.5 pt-2 animate-in fade-in">
                <div className="text-[11px] font-semibold text-[#64748B] flex items-center justify-between">
                  <span>Raw & Filtered IMU Signal (Indigo: Accel, Cyan: Gyro)</span>
                  <span>Max 1000 pts</span>
                </div>
                <div className="h-40 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={imuResult.chart_data.signal} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="time_s" unit="s" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
                      <Line
                        type="monotone"
                        dataKey="filtered_magnitude"
                        name="Filtered Accel"
                        stroke="#6366F1"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      {imuResult.metrics.gyro_rms !== null && (
                        <Line
                          type="monotone"
                          dataKey="raw_magnitude"
                          name="Raw Mag"
                          stroke="#06B6D4"
                          strokeWidth={1}
                          strokeDasharray="2 2"
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="space-y-3 bg-slate-50/50 border-slate-200 text-center py-6">
          <Activity className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-[#172554]">No Motion Analysis Uploaded</div>
          <Link href="/analyze">
            <Button variant="outline" size="sm">
              Upload IMU CSV
            </Button>
          </Link>
        </Card>
      )}

      {/* WALKING CARD */}
      {gaitResult ? (
        <Card className="space-y-4 bg-white border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#10B981]">
                <Footprints className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172554]">Walking & Gait Cadence</h2>
                <div className="text-xs text-[#64748B]">MirrorMotion pose estimation</div>
              </div>
            </div>
            <ConfidenceBadge level={gaitResult.confidence} reason={gaitResult.confidence_reason} />
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
            <div>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">Cadence</div>
              <div className="text-lg font-black text-[#10B981] mt-0.5">
                {gaitResult.metrics.cadence_steps_per_min}{" "}
                <span className="text-xs font-semibold text-slate-500">steps/min</span>
              </div>
              <div className="text-[9px] text-slate-400">compared to usual</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">Step Count</div>
              <div className="text-lg font-black text-[#172554] mt-0.5">
                {gaitResult.metrics.step_count}
              </div>
              <div className="text-[9px] text-slate-400">steps detected</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">Symmetry</div>
              <div className="text-lg font-black text-[#2563EB] mt-0.5">
                {gaitResult.metrics.symmetry_pct}%
              </div>
              <div className="text-[9px] text-slate-400">left / right ratio</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-slate-50/80 border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-100 text-[#10B981]">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172554]">Walking & Gait Cadence</h2>
                <div className="text-xs text-[#64748B]">Step symmetry and stride length</div>
              </div>
            </div>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">
              Pending Video
            </span>
          </div>

          <p className="text-xs text-[#64748B]">
            Add a walking video to see gait measurements and step symmetry score.
          </p>

          <Link href="/analyze/video" className="block w-full">
            <Button variant="outline" fullWidth size="md" className="border-emerald-200 text-[#10B981]">
              <span>Add Walking Video</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </Card>
      )}

      {/* EEG CARD */}
      {eegResult && (
        <Card className="space-y-4 bg-purple-50/30 border-purple-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-purple-100 text-[#8B5CF6]">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172554]">EEG Band Powers</h2>
                <div className="text-xs text-[#64748B]">
                  {eegResult.channel_count} channels analyzed
                </div>
              </div>
            </div>
            <ConfidenceBadge level={eegResult.confidence} reason={eegResult.confidence_reason} />
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-[#172554] mb-1">
                <span>Delta (0.5 – 4 Hz)</span>
                <span>{(eegResult.band_powers.delta.relative * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-400 h-2 rounded-full"
                  style={{ width: `${Math.min(100, eegResult.band_powers.delta.relative * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#172554] mb-1">
                <span>Theta (4 – 8 Hz)</span>
                <span>{(eegResult.band_powers.theta.relative * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-cyan-400 h-2 rounded-full"
                  style={{ width: `${Math.min(100, eegResult.band_powers.theta.relative * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#172554] mb-1">
                <span>Alpha (8 – 13 Hz)</span>
                <span>{(eegResult.band_powers.alpha.relative * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, eegResult.band_powers.alpha.relative * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 bg-purple-100/70 border border-purple-200 rounded-xl">
              <div className="flex justify-between font-bold text-[#8B5CF6] mb-1">
                <span>Beta (13 – 30 Hz) ★ Highlighted</span>
                <span>{(eegResult.band_powers.beta.relative * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2.5">
                <div
                  className="bg-[#8B5CF6] h-2.5 rounded-full"
                  style={{ width: `${Math.min(100, eegResult.band_powers.beta.relative * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-2">
        <Button
          variant="outline"
          fullWidth
          size="lg"
          onClick={() => setShowBaselineComparison(!showBaselineComparison)}
          className="border-purple-300 text-[#8B5CF6] hover:bg-purple-50"
        >
          <Scale className="w-4 h-4 mr-2" />
          <span>{showBaselineComparison ? "Hide Baseline Comparison" : "Compare With Baseline"}</span>
        </Button>

        <Link href="/progress" className="block w-full">
          <Button variant="primary" fullWidth size="lg" className="bg-brand-gradient">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            <span>View Timeline</span>
          </Button>
        </Link>
      </div>
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
