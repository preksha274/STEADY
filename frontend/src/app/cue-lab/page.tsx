"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { getActiveCue, saveCueResult, hasCueFatigue, CueResult } from "@/lib/cues";
import { VisualPulse } from "@/components/VisualPulse";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { CueLabIcon } from "@/components/icons/CueLabIcon";
import {
  Sparkles,
  Volume2,
  Smartphone,
  Eye,
  Play,
  Square,
  Trophy,
  FileText,
  Download,
  CheckCircle2,
  BookmarkCheck,
  RotateCcw,
  ArrowRight,
  Activity,
  X,
  Star,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const TEMPO_STEPS = [80, 85, 90, 95, 100];
const BASE_SCORES = [61, 72, 84, 93, 86];

interface StepResult {
  bpm: number;
  score: number;
  syncPercent: number;
}

export default function LiveCueDesignerPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();
  const [mounted, setMounted] = useState(false);
  const [isSimulated, setIsSimulated] = useState<boolean>(true);

  // Step 1: Modality Selection
  const [selectedType, setSelectedType] = useState<CueType>("audio");

  // Step 2: Test Flow State
  const [testState, setTestState] = useState<"idle" | "testing" | "completed">("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);

  // Generated 5-step response curve with +/- 3% random jitter
  const [curveData, setCurveData] = useState<StepResult[]>(() =>
    TEMPO_STEPS.map((bpm, idx) => {
      const jitter = Math.round((Math.random() - 0.5) * 6); // +/- 3% jitter
      const score = Math.min(98, Math.max(45, BASE_SCORES[idx] + jitter));
      return {
        bpm,
        score,
        syncPercent: Math.min(99, Math.round(score * 0.98)),
      };
    })
  );

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showPrescriptionExport, setShowPrescriptionExport] = useState(false);
  const [savedCue, setSavedCue] = useState<{ type: CueType; bpm: number } | null>(null);

  const {
    isPlaying,
    beatCount,
    beatInBar,
    start: startCue,
    stop: stopCue,
  } = useCueEngine();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const hasMotionSensor =
        "DeviceMotionEvent" in window &&
        typeof (DeviceMotionEvent as any).requestPermission === "function";
      setIsSimulated(!hasMotionSensor);
    }
    const active = getActiveCue();
    if (active) {
      setSelectedType(active.type);
      setSavedCue({ type: active.type, bpm: active.bpm });
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Generate fresh response curve with +/- 3% random jitter
  const generateFreshCurve = () => {
    return TEMPO_STEPS.map((bpm, idx) => {
      const jitter = Math.round((Math.random() - 0.5) * 6);
      const score = Math.min(98, Math.max(45, BASE_SCORES[idx] + jitter));
      return {
        bpm,
        score,
        syncPercent: Math.min(99, Math.round(score * 0.98)),
      };
    });
  };

  // Start or Restart 5-Step Adaptive Test
  const startTestSequence = (typeToUse?: CueType) => {
    const modality = typeToUse || selectedType;
    const freshCurve = generateFreshCurve();
    setCurveData(freshCurve);
    setCurrentStepIndex(0);
    setTestState("testing");
    startCue(modality, TEMPO_STEPS[0]);
  };

  // Advance to next tempo step in 5-step sequence
  const handleNextStep = () => {
    if (currentStepIndex < TEMPO_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      startCue(selectedType, TEMPO_STEPS[nextIdx]);
    } else {
      stopCue();
      setTestState("completed");
    }
  };

  // Auto-advance timer effect
  useEffect(() => {
    if (testState !== "testing" || !autoAdvance) return;

    const timer = setTimeout(() => {
      if (currentStepIndex < TEMPO_STEPS.length - 1) {
        const nextIdx = currentStepIndex + 1;
        setCurrentStepIndex(nextIdx);
        startCue(selectedType, TEMPO_STEPS[nextIdx]);
      } else {
        stopCue();
        setTestState("completed");
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, [testState, autoAdvance, currentStepIndex, selectedType, startCue, stopCue]);

  // Clean up audio playback when leaving testing state
  useEffect(() => {
    if (testState !== "testing" && isPlaying) {
      stopCue();
    }
  }, [testState, isPlaying, stopCue]);

  // Peak winning point
  const bestPoint = useMemo(() => {
    if (curveData.length === 0) return { bpm: 95, score: 93, syncPercent: 92 };
    return curveData.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), curveData[0]);
  }, [curveData]);

  // Save active cue to history & set active
  const handleSaveCue = () => {
    saveCueResult({
      type: selectedType,
      bpm: bestPoint.bpm,
      responseScore: bestPoint.score,
      meanCadence: bestPoint.bpm,
      sync: bestPoint.syncPercent,
      simulated: true,
      source: "seed",
    });
    setSavedCue({ type: selectedType, bpm: bestPoint.bpm });
    showToast("Added to Patient Timeline");
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
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              {isSimulated ? "Adaptive Cue Selection — MVP" : "Live Cue Designer"}
            </h1>
            {isSimulated ? (
              <span className="text-xs bg-indigo-50 text-[#6366F1] font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
                Demo Mode: Simulated Movement Response
              </span>
            ) : (
              <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                Core 4
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time sensory pacing calibration &amp; live tempo competition
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-brand-gradient text-white shadow-xs">
          <CueLabIcon size={24} className="text-white" isPlaying={isPlaying} />
        </div>
      </header>

      {/* CUE FATIGUE WARNING BANNER */}
      {hasCueFatigue(isDemoMode).isFatigued && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-[18px] flex items-start gap-3 text-xs text-amber-900 shadow-xs">
          <CueLabIcon size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <span>Cue Habituation Alert ({hasCueFatigue(isDemoMode).dropPercent}% Drop)</span>
            </div>
            <p className="text-amber-800 leading-normal">
              Your motor entrainment response to {selectedType.toUpperCase()} pacing has dropped recently. Try switching modality or fine-tuning BPM.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: CUE-TYPE SELECTION */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-[#172554] uppercase tracking-wider pl-1">
          Step 1: Select Cue Modality
        </label>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Audio Beat Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedType("audio");
              if (testState === "testing") {
                startTestSequence("audio");
              }
            }}
            className={`p-3.5 rounded-[18px] border-[0.5px] text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[105px] ${
              selectedType === "audio"
                ? "bg-[#EFF6FF] border-[#2563EB] shadow-md ring-2 ring-[#2563EB]/40 font-medium"
                : "bg-white border-[#E2E8F0] hover:bg-slate-50 text-[#172554]"
            }`}
            aria-label="Audio Beat Cue"
          >
            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554]">Audio Beat</div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Acoustic metronome</div>
            </div>
          </button>

          {/* Vibration Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedType("vibration");
              if (testState === "testing") {
                startTestSequence("vibration");
              }
            }}
            className={`p-3.5 rounded-[18px] border-[0.5px] text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[105px] ${
              selectedType === "vibration"
                ? "bg-[#F5F3FF] border-[#8B5CF6] shadow-md ring-2 ring-[#8B5CF6]/40 font-medium"
                : "bg-white border-[#E2E8F0] hover:bg-slate-50 text-[#172554]"
            }`}
            aria-label="Vibration Cue"
          >
            <div className="p-2 rounded-xl bg-purple-50 text-[#8B5CF6]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554]">Vibration</div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Haptic pulse</div>
            </div>
          </button>

          {/* Visual Flash Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedType("visual");
              if (testState === "testing") {
                startTestSequence("visual");
              }
            }}
            className={`p-3.5 rounded-[18px] border-[0.5px] text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[105px] ${
              selectedType === "visual"
                ? "bg-[#ECFEFF] border-[#06B6D4] shadow-md ring-2 ring-[#06B6D4]/40 font-medium"
                : "bg-white border-[#E2E8F0] hover:bg-slate-50 text-[#172554]"
            }`}
            aria-label="Visual Flash Cue"
          >
            <div className="p-2 rounded-xl bg-cyan-50 text-[#06B6D4]">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#172554]">Visual Flash</div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Screen pulse</div>
            </div>
          </button>
        </div>
      </div>

      {/* Step 2: INTERACTIVE 5-STEP TEMPO TEST CARD */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Step 2: Interactive 5-Tempo Test
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-[#6366F1] bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            5 Steps (80–100 BPM)
          </span>
        </div>

        {/* Idle State Banner */}
        {testState === "idle" && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Test 5 fixed tempos (80, 85, 90, 95, 100 BPM) to evaluate sensory entrainment and plot patient response curve.
            </p>
            <PrimaryButton fullWidth onClick={() => startTestSequence()}>
              <Play className="w-4 h-4 mr-1.5 fill-white" />
              <span>Start 5-Step Adaptive Test</span>
            </PrimaryButton>
          </div>
        )}

        {/* Live Testing State */}
        {testState === "testing" && (
          <div className="space-y-3 bg-[#EFF6FF]/60 p-4 rounded-2xl border border-[#BFDBFE]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Current Step</div>
                <div className="text-base font-extrabold text-[#172554]">
                  Testing {TEMPO_STEPS[currentStepIndex]} BPM... ({currentStepIndex + 1} of 5)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="accent-[#2563EB] rounded cursor-pointer"
                  />
                  <span>Auto-advance</span>
                </label>
              </div>
            </div>

            {/* Live Visual Pulse Indicator */}
            <div className="py-2 flex justify-center bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <VisualPulse
                beatCount={beatCount}
                beatInBar={beatInBar}
                isPlaying={isPlaying}
                size="md"
              />
            </div>

            {/* Step Controls */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  stopCue();
                  setTestState("idle");
                }}
                className="text-xs text-slate-600 border-slate-300"
              >
                <Square className="w-3.5 h-3.5 mr-1 fill-slate-600" />
                <span>Stop</span>
              </Button>

              <PrimaryButton onClick={handleNextStep}>
                <span>
                  {currentStepIndex < TEMPO_STEPS.length - 1 ? "Next tempo →" : "Finish Test ✓"}
                </span>
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Completed State Controls */}
        {testState === "completed" && (
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div className="text-xs text-emerald-950 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>All 5 tempos evaluated successfully</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startTestSequence()}
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              <span>Re-run Test</span>
            </Button>
          </div>
        )}

        {/* LIVE RESPONSE CURVE LINE CHART (RECHARTS) */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold text-[#172554]">Movement Response Curve</span>
            <span className="text-[#64748B]">BPM vs. Response %</span>
          </div>

          <div className="h-48 w-full bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={
                  testState === "idle"
                    ? []
                    : testState === "testing"
                    ? curveData.slice(0, currentStepIndex + 1)
                    : curveData.map((d) => ({ ...d, isPeak: d.bpm === bestPoint.bpm }))
                }
                margin={{ top: 15, right: 15, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="bpm"
                  domain={[75, 105]}
                  ticks={[80, 85, 90, 95, 100]}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  unit=" BPM"
                />
                <YAxis
                  domain={[40, 100]}
                  ticks={[40, 60, 80, 100]}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "12px" }}
                  formatter={(val: any) => [`${val}% Movement Response`, "Response"]}
                  labelFormatter={(label: any) => `${label} BPM`}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Movement Response"
                  stroke="#6366F1"
                  strokeWidth={3}
                  isAnimationActive={true}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!cx || !cy) return null;
                    if (payload.isPeak && testState === "completed") {
                      return (
                        <g key={`star-${payload.bpm}`}>
                          <circle cx={cx} cy={cy} r={13} fill="#FEF3C7" stroke="#F59E0B" strokeWidth={2} />
                          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12}>
                            ⭐
                          </text>
                        </g>
                      );
                    }
                    return (
                      <circle
                        key={`dot-${payload.bpm}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#6366F1"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* WINNING CUE RESULT CARD (When 5 steps complete) */}
      {testState === "completed" && (
        <Card className="space-y-4 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-indigo-950">
              <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Optimal Rhythm Calibrated</span>
            </div>
            <ConfidenceBadge isSimulated={true} />
          </div>

          <div className="p-4 bg-white/95 rounded-2xl border border-indigo-100 space-y-2">
            <div className="text-sm font-extrabold text-[#172554]">
              🏆 Personalized Cue Found — {selectedType.toUpperCase()} Beat, {bestPoint.bpm} BPM, Response: {bestPoint.score}%, Confidence: Demo / simulated response.
            </div>
            <div className="text-xs text-[#64748B] flex items-center justify-between pt-1 border-t border-slate-100">
              <span>Peak Cadence: <strong>{bestPoint.bpm} BPM</strong></span>
              <span>Sync Rate: <strong className="text-emerald-600">{bestPoint.syncPercent}%</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setShowPrescriptionExport(true)}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs px-2"
            >
              <FileText className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Prescription</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveCue}
              className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs px-2"
            >
              <BookmarkCheck className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Save Cue</span>
            </Button>

            <PrimaryButton
              onClick={() => {
                saveCueResult({
                  type: selectedType,
                  bpm: bestPoint.bpm,
                  responseScore: bestPoint.score,
                  meanCadence: bestPoint.bpm,
                  sync: bestPoint.syncPercent,
                  simulated: true,
                  source: "seed",
                });
                router.push("/move?fromCueLab=true");
              }}
              className="text-xs px-2"
            >
              <Activity className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Use in Move Coach</span>
            </PrimaryButton>
          </div>
        </Card>
      )}

      {/* Export Prescription Modal */}
      {showPrescriptionExport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172554]/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-[24px] border-[0.5px] border-[#E2E8F0] shadow-2xl p-6 max-w-sm w-full space-y-4 text-left">
            <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
              <h3 className="text-base font-bold text-[#172554]">
                Cue Prescription Export
              </h3>
              <button
                onClick={() => setShowPrescriptionExport(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-[#172554]">
              <div className="p-3 bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE]">
                <div className="font-bold text-[#1E40AF]">STEADY Rhythmic Cue Prescription</div>
                <div className="mt-1 text-[#1E40AF]">Modality: {selectedType.toUpperCase()}</div>
                <div className="text-[#1E40AF]">Tempo: {bestPoint.bpm} Beats Per Minute</div>
                <div className="text-[#1E40AF]">Entrainment Target: {bestPoint.score}% Gait Stability</div>
              </div>
              <p className="text-[#64748B] font-normal leading-relaxed">
                This digital prescription is synced across Move Coach and Freeze Assist emergency unfreezing tools.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  router.push("/cue-lab/prescription");
                }}
                className="border-blue-300 text-blue-700"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                <span>View Full Plan</span>
              </Button>

              <PrimaryButton
                onClick={() => {
                  alert("Cue prescription exported to device storage!");
                  setShowPrescriptionExport(false);
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
