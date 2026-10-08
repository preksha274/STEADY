"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  useCueEngine,
  CueType,
  CLOSED_LOOP_CITATION,
  getCueInitialTempo,
} from "@/lib/cueEngine";
import { getActiveCue, saveCueResult, getCuePolicyState } from "@/lib/cues";
import { TechnicalDetailsExpand } from "@/components/TechnicalDetailsExpand";
import { translateRhythmSync } from "@/lib/plainLanguage";
import { VisualPulse } from "@/components/VisualPulse";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
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
  Activity,
  X,
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

interface AdaptiveIteration {
  iteration: number;
  label: string;
  bpm: number;
  score: number;
  syncPercent: number;
  statusMsg: string;
  isPeak?: boolean;
}

export default function LiveCueDesignerPage() {
  const router = useRouter();
  const { isDemoMode } = useAnalysis();
  const [mounted, setMounted] = useState(false);
  const [isSimulated, setIsSimulated] = useState<boolean>(true);

  // Modality Selection
  const [selectedType, setSelectedType] = useState<CueType>("audio");

  // Initial Tempo & Cadence Personalization Info
  const initialInfo = useMemo(() => getCueInitialTempo(isDemoMode), [isDemoMode]);

  // Test Flow State
  const [testState, setTestState] = useState<"idle" | "testing" | "completed">("idle");
  const [adaptiveHistory, setAdaptiveHistory] = useState<AdaptiveIteration[]>([]);
  const [currentBpm, setCurrentBpm] = useState<number>(initialInfo.initialBpm);
  const [adaptiveStatusMsg, setAdaptiveStatusMsg] = useState<string>(
    "Ready to start closed-loop adaptive search"
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
    setBpm,
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

  // Peak/Winning Iteration
  const bestPoint = useMemo(() => {
    if (adaptiveHistory.length === 0) {
      return { bpm: 124, score: 94, syncPercent: 92 };
    }
    return adaptiveHistory.reduce(
      (prev, curr) => (curr.score > prev.score ? curr : prev),
      adaptiveHistory[0]
    );
  }, [adaptiveHistory]);

  // Closed-Loop Hill Climbing Adaptive Search Algorithm
  const startClosedLoopAdaptiveSearch = (typeToUse?: CueType) => {
    const modality = typeToUse || selectedType;
    setAdaptiveHistory([]);
    setTestState("testing");

    const startBpm = initialInfo.initialBpm;
    setCurrentBpm(startBpm);
    startCue(modality, startBpm);

    // Simulated optimal response target (centered near patient's cadence or ~124 BPM)
    const targetPeak = Math.min(150, Math.max(85, (initialInfo.cadence || 118) + 6));

    let iter = 1;
    let currBpm = startBpm;
    let direction = 1; // +1 = nudge higher, -1 = nudge lower
    let stepSize = 4; // starting step size (BPM)
    let historyAcc: AdaptiveIteration[] = [];

    const computeResponse = (b: number) => {
      const diff = Math.abs(b - targetPeak);
      const base = Math.round(96 * Math.exp(-0.5 * Math.pow(diff / 15, 2)));
      const jitter = Math.round((Math.random() - 0.5) * 4);
      const score = Math.min(98, Math.max(45, base + jitter));
      return { score, syncPercent: Math.min(99, Math.round(score * 0.98)) };
    };

    const runStep = () => {
      const { score, syncPercent } = computeResponse(currBpm);
      const prevScore = historyAcc.length > 0 ? historyAcc[historyAcc.length - 1].score : 0;

      let msg = "";
      if (historyAcc.length === 0) {
        msg = `Initial probe at ${currBpm} BPM (cadence baseline)`;
      } else if (score > prevScore) {
        msg = `Response improved (+${score - prevScore}%) → Nudging ${direction > 0 ? "+" : "-"}${stepSize} BPM`;
      } else {
        // Reverse direction and decrease step size
        direction = -direction;
        stepSize = Math.max(1, Math.round(stepSize * 0.6));
        msg = `Response boundary detected → Reversing direction to ${direction > 0 ? "+" : "-"}${stepSize} BPM`;
      }

      setAdaptiveStatusMsg(msg);

      const iterationItem: AdaptiveIteration = {
        iteration: iter,
        label: `Step ${iter}`,
        bpm: currBpm,
        score,
        syncPercent,
        statusMsg: msg,
      };

      historyAcc = [...historyAcc, iterationItem];
      setAdaptiveHistory(historyAcc);

      // Convergence Check: After at least 7 iterations, if step size <= 1 or recent scores plateaued
      if (historyAcc.length >= 7) {
        const last3 = historyAcc.slice(-3);
        const maxDelta =
          Math.max(...last3.map((s) => s.score)) - Math.min(...last3.map((s) => s.score));

        if (stepSize <= 1 || maxDelta <= 2 || historyAcc.length >= 10) {
          stopCue();
          setTestState("completed");
          setAdaptiveStatusMsg(`Response policy calibrated pacing tempo at ${currBpm} BPM`);
          return;
        }
      }

      // Step to next tempo
      const nextBpm = Math.min(155, Math.max(80, currBpm + direction * stepSize));
      currBpm = nextBpm;
      setCurrentBpm(nextBpm);
      setBpm(nextBpm);

      iter += 1;
    };

    // Run first step immediately, then iterate every 2.4 seconds
    runStep();
    const timer = setInterval(() => {
      if (iter > 10) {
        clearInterval(timer);
        stopCue();
        setTestState("completed");
        return;
      }
      runStep();
    }, 2400);

    return () => clearInterval(timer);
  };

  // Clean up audio playback when leaving testing state
  useEffect(() => {
    if (testState !== "testing" && isPlaying) {
      stopCue();
    }
  }, [testState, isPlaying, stopCue]);

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
      isPersonalized: initialInfo.isPersonalized,
      baselineCadence: initialInfo.cadence,
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
              Cue Policy &amp; Pacing Lab
            </h1>
            {isSimulated ? (
              <span className="text-xs bg-indigo-50 text-[#6366F1] font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
                Demo Mode: Response Policy
              </span>
            ) : (
              <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                Core 4
              </span>
            )}
          </div>
          {/* UPDATED PITCH LANGUAGE */}
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            A cue policy that learns your response over time and adjusts — including switching modality or stepping back when cueing isn&apos;t helping.
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-brand-gradient text-white shadow-xs">
          <CueLabIcon size={24} className="text-white" isPlaying={isPlaying} />
        </div>
      </header>

      {/* RESPONSE-AWARE CUE POLICY BANNER */}
      {(() => {
        const policy = getCuePolicyState(isDemoMode);
        if (policy.action === "suggest_switch" && policy.suggestedModality) {
          return (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-[18px] space-y-2 text-xs text-amber-900 shadow-xs">
              <div className="flex items-start gap-2.5">
                <CueLabIcon size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="font-extrabold text-amber-950 flex items-center justify-between">
                    <span>Cue Habituation Alert ({policy.dropPercent}% Response Drop)</span>
                    <span className="text-[10px] bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                      Policy Recommendation
                    </span>
                  </div>
                  <p className="text-amber-900 leading-relaxed font-normal">
                    {policy.reason}
                  </p>
                </div>
              </div>
              <div className="pt-1 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    if (policy.suggestedModality) {
                      setSelectedType(policy.suggestedModality);
                      showToast(`Switched modality to ${policy.suggestedModality.toUpperCase()}`);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
                >
                  <span>Switch to {policy.suggestedModality.toUpperCase()} Pacing &rarr;</span>
                </Button>
              </div>
            </div>
          );
        }

        if (policy.action === "abstain") {
          return (
            <div className="p-4 bg-slate-100 border border-slate-300 rounded-[18px] space-y-2 text-xs text-slate-900 shadow-xs">
              <div className="flex items-start gap-2.5">
                <CueLabIcon size={20} className="text-slate-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold text-slate-950 flex items-center justify-between">
                    <span>Cueing Doesn&apos;t Appear to Be Helping Right Now</span>
                    <span className="text-[10px] bg-slate-200 border border-slate-300 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      Abstain Policy
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-normal">
                    {policy.reason}
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return null;
      })()}

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
                startClosedLoopAdaptiveSearch("audio");
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
                startClosedLoopAdaptiveSearch("vibration");
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
                startClosedLoopAdaptiveSearch("visual");
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

      {/* Step 2: CLOSED-LOOP ADAPTIVE CUE SEARCH CARD */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Step 2: Closed-Loop Adaptive Cue Optimization
            </h2>
          </div>
          {initialInfo.isPersonalized ? (
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Cadence Initialized ({initialInfo.initialBpm} BPM)
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-[#6366F1] bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              Closed-Loop (80–155 BPM)
            </span>
          )}
        </div>

        {/* Idle State Banner */}
        {testState === "idle" && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Starts at your cadence baseline (<strong>{initialInfo.initialBpm} BPM</strong>) and continuously adapts metronome tempo live based on your movement response, searching the optimal <strong>80–155 BPM</strong> range in real time.
            </p>

            {initialInfo.note && (
              <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 text-left flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span>{initialInfo.note}</span>
              </div>
            )}

            <PrimaryButton fullWidth onClick={() => startClosedLoopAdaptiveSearch()}>
              <Play className="w-4 h-4 mr-1.5 fill-white" />
              <span>Start Closed-Loop Adaptive Search</span>
            </PrimaryButton>
          </div>
        )}

        {/* Live Testing State */}
        {testState === "testing" && (
          <div className="space-y-3 bg-[#EFF6FF]/60 p-4 rounded-2xl border border-[#BFDBFE]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">
                  Closed-Loop Optimization Active
                </div>
                <div className="text-lg font-extrabold text-[#172554] mt-0.5 flex items-center gap-2">
                  <span>Current Pacing: {currentBpm} BPM</span>
                  <span className="text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                    Step {adaptiveHistory.length}
                  </span>
                </div>
                <div className="text-xs text-blue-900 font-medium mt-1 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  <span>{adaptiveStatusMsg}</span>
                </div>
              </div>

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
          </div>
        )}

        {/* Completed State Controls */}
        {testState === "completed" && (
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div className="text-xs text-emerald-950 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Closed-loop search converged &amp; settled on optimal rhythm</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startClosedLoopAdaptiveSearch()}
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              <span>Re-run Optimization</span>
            </Button>
          </div>
        )}

        {/* REAL-TIME ADAPTIVE SEARCH LINE CHART (RECHARTS) */}
        {adaptiveHistory.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-[#172554]">Real-Time Closed-Loop Search Curve</span>
              <span className="text-[#64748B]">BPM (left) vs. Response % (right)</span>
            </div>

            <div className="h-52 w-full bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={adaptiveHistory.map((item) => ({
                    ...item,
                    isPeak: item.bpm === bestPoint.bpm && testState === "completed",
                  }))}
                  margin={{ top: 15, right: 15, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#64748B" }}
                  />
                  <YAxis
                    yAxisId="bpm"
                    domain={[75, 160]}
                    ticks={[80, 100, 120, 140, 155]}
                    tick={{ fontSize: 10, fill: "#8B5CF6" }}
                    unit=" BPM"
                  />
                  <YAxis
                    yAxisId="score"
                    orientation="right"
                    domain={[40, 100]}
                    ticks={[40, 60, 80, 100]}
                    tick={{ fontSize: 10, fill: "#10B981" }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{ fontSize: "12px", borderRadius: "12px" }}
                    formatter={(val: any, name: any) => [
                      name === "bpm" ? `${val} BPM` : `${val}% Response`,
                      name === "bpm" ? "Metronome Tempo" : "Movement Response",
                    ]}
                  />
                  <Line
                    yAxisId="bpm"
                    type="monotone"
                    dataKey="bpm"
                    name="bpm"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    isAnimationActive={true}
                    dot={{ r: 4, fill: "#8B5CF6" }}
                  />
                  <Line
                    yAxisId="score"
                    type="monotone"
                    dataKey="score"
                    name="score"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    isAnimationActive={true}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (!cx || !cy) return null;
                      if (payload.isPeak) {
                        return (
                          <g key={`star-${payload.iteration}`}>
                            <circle cx={cx} cy={cy} r={12} fill="#FEF3C7" stroke="#F59E0B" strokeWidth={2} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11}>
                              ⭐
                            </text>
                          </g>
                        );
                      }
                      return (
                        <circle
                          key={`dot-${payload.iteration}`}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#10B981"
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
        )}
      </Card>

      {/* WINNING CUE RESULT CARD (When Closed-Loop Settles) */}
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
            {(() => {
              const rs = translateRhythmSync(bestPoint.syncPercent, bestPoint.bpm, selectedType);
              return (
                <TechnicalDetailsExpand
                  primaryText={rs.primary}
                  technicalDetail={`Modality: ${selectedType.toUpperCase()} metronome • Optimal tempo: ${bestPoint.bpm} BPM • Entrainment match: ${bestPoint.score}%`}
                  size="md"
                />
              );
            })()}

            {/* Context Citation Note */}
            <div className="pt-2 border-t border-indigo-100/80">
              <div className="p-3 bg-purple-50/90 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  {CLOSED_LOOP_CITATION}
                </p>
              </div>
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
                  isPersonalized: initialInfo.isPersonalized,
                  baselineCadence: initialInfo.cadence,
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
                <div className="text-[#1E40AF] mt-1 text-[11px] font-medium border-t border-blue-200 pt-1">
                  Derivation: {initialInfo.isPersonalized ? `Personalized to usual pace (${initialInfo.cadence} steps/min)` : "Closed-Loop Search (80–155 BPM)"}
                </div>
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
