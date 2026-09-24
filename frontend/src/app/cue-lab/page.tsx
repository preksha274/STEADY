"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { useMotionCapture, CueTrialResult } from "@/lib/motionCapture";
import { getActiveCue, saveCueResult, hasCueFatigue } from "@/lib/cues";
import { VisualPulse } from "@/components/VisualPulse";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  Sparkles,
  Volume2,
  Smartphone,
  Eye,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Activity,
  Sliders,
  ArrowRight,
  TrendingUp,
  Star,
  Trophy,
  FastForward,
  BookmarkCheck,
  FileText,
  X,
  Zap,
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

type Step = 1 | 2 | 3;

export interface AdaptTrialRecord {
  trialNumber: number;
  bpm: number;
  type: CueType;
  responseScore: number;
  meanCadence: number;
  sync: number;
  isSimulated: boolean;
}

export interface TypeSummary {
  type: CueType;
  bestBpm: number;
  bestScore: number;
  label: "Strong" | "Good" | "Weak";
  isOverallWinner: boolean;
}

export default function CueLabPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // STEP 1: DESIGN STATE
  const [selectedType, setSelectedType] = useState<CueType>("audio");
  const [bpm, setBpm] = useState<number>(80);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);

  // STEP 2: TEST STATE
  const [trialTimeLeft, setTrialTimeLeft] = useState<number>(20);
  const [isTrialActive, setIsTrialActive] = useState<boolean>(false);
  const [trialCompleted, setTrialCompleted] = useState<boolean>(false);
  const [trialResult, setTrialResult] = useState<AdaptTrialRecord | null>(null);

  // STEP 3: ADAPT STATE
  const [adaptTrials, setAdaptTrials] = useState<AdaptTrialRecord[]>([]);
  const [allCompletedTrials, setAllCompletedTrials] = useState<AdaptTrialRecord[]>([]);
  const [adaptIndex, setAdaptIndex] = useState<number>(0);
  const [isAdaptRunning, setIsAdaptRunning] = useState<boolean>(false);

  // UI Modals & Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedCue, setSavedCue] = useState<{ type: CueType; bpm: number } | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState<boolean>(false);

  // Cue Engine Hook
  const {
    isPlaying,
    beatCount,
    beatInBar,
    vibrationSupported,
    start: startCue,
    stop: stopCue,
  } = useCueEngine();

  // Motion Capture Hook
  const {
    hasSensor,
    isSimulated,
    currentCadence,
    syncPercent,
    detectedSteps,
    dataHistory,
    simulatedMode,
    setSimulatedMode,
    requestMotionPermission,
  } = useMotionCapture(bpm, isTrialActive);

  const [fatigueInfo, setFatigueInfo] = useState<{ isFatigued: boolean; dropPercent: number; currentCue: any }>({
    isFatigued: false,
    dropPercent: 0,
    currentCue: null,
  });

  useEffect(() => {
    setMounted(true);
    // Check URL params for rotate action
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("rotate") === "true") {
        const active = getActiveCue();
        if (active?.type === "audio") setSelectedType("vibration");
        else if (active?.type === "vibration") setSelectedType("visual");
        else setSelectedType("audio");
      }
    }

    const fatigue = hasCueFatigue();
    setFatigueInfo(fatigue);

    try {
      const storedCue = localStorage.getItem("movepilot_saved_cue");
      if (storedCue) {
        const parsed = JSON.parse(storedCue);
        setSavedCue(parsed);
      }
    } catch (e) {
      console.error("Failed to load saved cue", e);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Preview Cue (3.5s)
  const handlePreviewCue = () => {
    if (isPlaying) {
      stopCue();
      setIsPreviewing(false);
    } else {
      setIsPreviewing(true);
      startCue(selectedType, bpm);
      setTimeout(() => {
        stopCue();
        setIsPreviewing(false);
      }, 3500);
    }
  };

  // Start Step 2 Test
  const handleStartTest = async () => {
    if (isPreviewing) {
      stopCue();
      setIsPreviewing(false);
    }

    await requestMotionPermission();
    setStep(2);
    setTrialTimeLeft(20);
    setTrialCompleted(false);
    setTrialResult(null);
    setIsTrialActive(true);
    startCue(selectedType, bpm);
  };

  // Stop Test
  const handleStopTest = () => {
    stopCue();
    setIsTrialActive(false);
    setTrialCompleted(false);
    setIsAdaptRunning(false);
    setStep(1);
  };

  // Skip Wait (Dev button to immediately end current 12s trial in Adapt mode)
  const handleSkipWait = () => {
    if (isTrialActive && trialTimeLeft > 1) {
      setTrialTimeLeft(1);
    }
  };

  // Helper to evaluate trial completion
  const evaluateCurrentTrial = (trialNum: number, durationSec: number): AdaptTrialRecord => {
    const history = dataHistory.length > 0 ? dataHistory : [{ timeSec: durationSec, cadence: bpm, sync: 80 }];
    const meanCadence = Math.round(
      history.reduce((sum, item) => sum + item.cadence, 0) / history.length
    );
    const avgSync = Math.round(
      history.reduce((sum, item) => sum + item.sync, 0) / history.length
    );

    const proximityError = Math.abs(meanCadence - bpm) / bpm;
    const proximityScore = Math.max(0, 100 - proximityError * 100);
    const responseScore = Math.round(avgSync * 0.6 + proximityScore * 0.4);

    return {
      trialNumber: trialNum,
      bpm,
      type: selectedType,
      responseScore,
      meanCadence,
      sync: avgSync,
      isSimulated,
    };
  };

  // 12s / 20s Trial Countdown Timer & Adapt Sequence State Machine
  useEffect(() => {
    if (!isTrialActive) return;

    const timer = setInterval(() => {
      setTrialTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopCue();

          if (step === 2) {
            // Step 2 Single Trial Finish
            setIsTrialActive(false);
            const res = evaluateCurrentTrial(1, 20);
            setTrialResult(res);
            setTrialCompleted(true);
            setAdaptTrials([res]);
            setAllCompletedTrials((prevAll) => [...prevAll, res]);
          } else if (step === 3) {
            // Step 3 Adapt Trial Finish
            const trialNum = adaptTrials.length + 1;
            const res = evaluateCurrentTrial(trialNum, 12);
            const updatedAdapt = [...adaptTrials, res];
            setAdaptTrials(updatedAdapt);
            setAllCompletedTrials((prevAll) => [...prevAll, res]);

            // Determine next trial tempo (Max 5 trials in hill climb)
            if (updatedAdapt.length < 5) {
              const startBpm = updatedAdapt[0].bpm;
              let nextTempo = startBpm;

              if (updatedAdapt.length === 1) nextTempo = Math.min(120, startBpm + 4);
              else if (updatedAdapt.length === 2) nextTempo = Math.min(120, startBpm + 8);
              else if (updatedAdapt.length === 3) nextTempo = Math.max(60, startBpm - 4);
              else if (updatedAdapt.length === 4) {
                // Hill climb refinement around best
                const sorted = [...updatedAdapt].sort((a, b) => b.responseScore - a.responseScore);
                const bestBpm = sorted[0].bpm;
                if (bestBpm >= startBpm + 8) nextTempo = Math.min(120, startBpm + 12);
                else if (bestBpm <= startBpm - 4) nextTempo = Math.max(60, startBpm - 8);
                else nextTempo = bestBpm + 4;
              }

              setBpm(nextTempo);
              setTrialTimeLeft(12);
              setIsTrialActive(true);
              startCue(selectedType, nextTempo);
            } else {
              // Adaptive search completed all 5 trials!
              setIsTrialActive(false);
              setIsAdaptRunning(false);
              showToast("🏆 Adaptive Cue Optimization Completed!");
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTrialActive, step, adaptTrials, bpm, selectedType, isSimulated, dataHistory, stopCue]);

  // Transition to Step 3 Adapt Mode
  const handleStartAdaptSearch = () => {
    setStep(3);
    setIsAdaptRunning(true);

    const initialTrial = trialResult || (adaptTrials.length > 0 ? adaptTrials[0] : null);
    const startBpm = initialTrial ? initialTrial.bpm : bpm;

    const firstRecord: AdaptTrialRecord = initialTrial || {
      trialNumber: 1,
      bpm: startBpm,
      type: selectedType,
      responseScore: 82,
      meanCadence: startBpm,
      sync: 85,
      isSimulated,
    };

    setAdaptTrials([firstRecord]);
    const nextBpm = Math.min(120, startBpm + 4);
    setBpm(nextBpm);
    setTrialTimeLeft(12);
    setIsTrialActive(true);
    startCue(selectedType, nextBpm);
  };

  // Best trial in current Adapt run
  const winningTrial = useMemo(() => {
    if (adaptTrials.length === 0) return null;
    return [...adaptTrials].sort((a, b) => b.responseScore - a.responseScore)[0];
  }, [adaptTrials]);

  // Response label helper
  const getResponseLabel = (score: number): "Strong" | "Good" | "Weak" => {
    if (score >= 75) return "Strong";
    if (score >= 55) return "Good";
    return "Weak";
  };

  // Save winning cue to localStorage & cues history module
  const handleSaveWinningCue = () => {
    if (!winningTrial) return;

    saveCueResult({
      type: winningTrial.type,
      bpm: winningTrial.bpm,
      responseScore: winningTrial.responseScore,
      meanCadence: winningTrial.meanCadence,
      sync: winningTrial.sync,
      simulated: winningTrial.isSimulated,
    });

    const pref = {
      type: winningTrial.type,
      bpm: winningTrial.bpm,
      score: winningTrial.responseScore,
      label: getResponseLabel(winningTrial.responseScore),
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("movepilot_saved_cue", JSON.stringify(pref));
      setSavedCue(pref);
      setFatigueInfo(hasCueFatigue());
      showToast(`Saved ${winningTrial.bpm} BPM ${winningTrial.type.toUpperCase()} as your winning cue!`);
    } catch (e) {
      console.error("Failed to save cue preference", e);
    }
  };

  const handleRotateCue = () => {
    const currentActive = getActiveCue();
    let nextType: CueType = "vibration";
    if (currentActive?.type === "vibration") nextType = "visual";
    else if (currentActive?.type === "visual") nextType = "audio";

    setSelectedType(nextType);
    setStep(1);
    showToast(`Switched to ${nextType.toUpperCase()} cue mode`);
  };

  // Cross-type comparison summary
  const typeSummaries = useMemo(() => {
    if (allCompletedTrials.length === 0) return [];
    const map: Partial<Record<CueType, AdaptTrialRecord[]>> = {};
    allCompletedTrials.forEach((t) => {
      if (!map[t.type]) map[t.type] = [];
      map[t.type]!.push(t);
    });

    const summaries: TypeSummary[] = Object.entries(map).map(([type, records]) => {
      const best = [...records].sort((a, b) => b.responseScore - a.responseScore)[0];
      return {
        type: type as CueType,
        bestBpm: best.bpm,
        bestScore: best.responseScore,
        label: getResponseLabel(best.responseScore),
        isOverallWinner: false,
      };
    });

    if (summaries.length > 0) {
      const highestScore = Math.max(...summaries.map((s) => s.bestScore));
      summaries.forEach((s) => {
        if (s.bestScore === highestScore) s.isOverallWinner = true;
      });
    }

    return summaries;
  }, [allCompletedTrials]);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554]">Cue Lab</h1>
            <p className="text-xs text-[#64748B]">Find the rhythm that helps you move best</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
            <Sparkles className="w-6 h-6" />
          </div>
        </header>
        <Card className="animate-pulse py-12 text-center text-slate-400">
          Loading Cue Lab...
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER & PROGRESS STEPPER */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              Cue Lab
            </h1>
            <p className="text-xs text-[#64748B]">
              Find the rhythm that helps you move best
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* Amber Cue Fatigue Warning Banner */}
        {fatigueInfo.isFatigued && (
          <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="text-xs font-black text-amber-950 uppercase tracking-wide">
                  Cue Fatigue Detected
                </div>
                <div className="text-xs text-amber-900 mt-0.5 leading-snug font-medium">
                  Your audio cue seems to be losing its effect. Try rotating to vibration or a new tempo.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotateCue}
              className="bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200 shrink-0 font-bold self-end sm:self-auto text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Rotate cue
            </Button>
          </div>
        )}

        {/* 3-Step Progress Stepper Header */}
        <div className="bg-slate-100 p-2 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#172554] uppercase tracking-wider px-1">
            <span className={step === 1 ? "text-[#2563EB]" : "text-slate-500"}>
              1. Design
            </span>
            <span className={step === 2 ? "text-[#2563EB]" : "text-slate-500"}>
              2. Test (20s)
            </span>
            <span className={step === 3 ? "text-[#2563EB]" : "text-slate-500"}>
              3. Adapt
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-brand-gradient h-full transition-all duration-300 ease-out"
              style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
            />
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* STEP 1: DESIGN */}
      {/* ========================================================= */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Card 1: Selectable Cue Type Cards */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#172554] uppercase tracking-wider pl-1">
              Select Cue Type
            </label>

            <div className="grid gap-3">
              {/* Audio Card */}
              <div
                onClick={() => setSelectedType("audio")}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                  selectedType === "audio"
                    ? "bg-white border-[#2563EB] shadow-md ring-1 ring-blue-500"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="p-3 rounded-2xl bg-blue-50 text-[#2563EB] shrink-0">
                  <Volume2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#172554] flex items-center justify-between">
                    <span>🔊 Audio Beat</span>
                    {selectedType === "audio" && (
                      <span className="text-xs text-[#2563EB] font-bold">Selected</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Web Audio metronome with pitch-accented beat 1
                  </p>
                </div>
              </div>

              {/* Vibration Card */}
              <div
                onClick={() => setSelectedType("vibration")}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                  selectedType === "vibration"
                    ? "bg-white border-[#2563EB] shadow-md ring-1 ring-blue-500"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#172554] flex items-center justify-between">
                    <span>📳 Vibration</span>
                    {selectedType === "vibration" && (
                      <span className="text-xs text-[#2563EB] font-bold">Selected</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Tactile haptic pulse on every beat
                  </p>
                  {!vibrationSupported && (
                    <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                      Works on most Android phones
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Flash Card */}
              <div
                onClick={() => setSelectedType("visual")}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                  selectedType === "visual"
                    ? "bg-white border-[#2563EB] shadow-md ring-1 ring-blue-500"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="p-3 rounded-2xl bg-cyan-50 text-[#06B6D4] shrink-0">
                  <Eye className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#172554] flex items-center justify-between">
                    <span>✨ Visual Flash</span>
                    {selectedType === "visual" && (
                      <span className="text-xs text-[#2563EB] font-bold">Selected</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Glowing rhythmic screen pulse
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Starting Tempo Slider 60-120 BPM */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#2563EB]" />
                <span>Starting Tempo</span>
              </span>
              <span className="text-xs font-semibold text-[#64748B]">60–120 BPM</span>
            </div>

            {/* Big Number Display */}
            <div className="text-center py-2">
              <div className="text-4xl font-black text-[#172554] tracking-tight">
                {bpm} <span className="text-base font-bold text-[#2563EB]">BPM</span>
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                {bpm < 75
                  ? "Slow pacing pace"
                  : bpm <= 95
                  ? "Standard walking cadence target"
                  : "Fast brisk pace"}
              </p>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={60}
              max={120}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              className="w-full accent-[#2563EB] h-2 bg-slate-200 rounded-lg cursor-pointer"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-2">
              {[70, 80, 90, 100].map((presetBpm) => (
                <button
                  key={presetBpm}
                  onClick={() => setBpm(presetBpm)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    bpm === presetBpm
                      ? "bg-[#2563EB] text-white border-[#2563EB]"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {presetBpm} BPM
                </button>
              ))}
            </div>

            {/* Preview Button */}
            <Button
              variant="outline"
              fullWidth
              size="md"
              onClick={handlePreviewCue}
              className="border-indigo-200 text-[#6366F1] hover:bg-indigo-50"
            >
              {isPreviewing ? (
                <>
                  <Square className="w-4 h-4 mr-2 fill-[#6366F1]" />
                  <span>Stop Preview</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  <span>Preview Cue (3s)</span>
                </>
              )}
            </Button>
          </Card>

          {/* Primary Start Test Button */}
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={handleStartTest}
            className="bg-brand-gradient hover:opacity-95 shadow-md py-4 text-base font-extrabold"
          >
            <span>Start Test (20s Trial)</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          {/* Saved Cue Summary Badge if exists */}
          {savedCue && (
            <Card className="bg-emerald-50/80 border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="font-bold text-[#172554]">Saved Preferred Cue: </span>
                  <span className="text-emerald-800 font-extrabold capitalize">
                    {savedCue.bpm} BPM {savedCue.type}
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                Active Cue
              </span>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: TEST */}
      {/* ========================================================= */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {!trialCompleted ? (
            <>
              {/* Trial Status & Visual Pulse Card */}
              <Card className="flex flex-col items-center text-center py-6 space-y-4 relative overflow-hidden">
                {simulatedMode && (
                  <div className="absolute top-3 right-3 text-[10px] bg-amber-100 text-[#D97706] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                    <span>Simulated</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs font-bold text-[#172554] uppercase tracking-wider">
                  <span className="capitalize">{selectedType} Cue</span>
                  <span>•</span>
                  <span className="text-[#2563EB]">{bpm} BPM</span>
                </div>

                <VisualPulse
                  beatCount={beatCount}
                  beatInBar={beatInBar}
                  isPlaying={isTrialActive}
                  size="md"
                />

                <div className="bg-slate-100 text-[#172554] font-black text-2xl px-5 py-2 rounded-2xl border border-slate-200">
                  {trialTimeLeft}s <span className="text-xs font-semibold text-slate-500">left</span>
                </div>

                {/* Live Cadence & Sync Display */}
                <div className="grid grid-cols-2 gap-3 w-full pt-2 border-t border-slate-100">
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <div className="text-[10px] uppercase font-bold text-emerald-700">
                      Live Cadence
                    </div>
                    <div className="text-xl font-extrabold text-emerald-900 mt-0.5">
                      {currentCadence} <span className="text-xs font-normal">steps/min</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                    <div className="text-[10px] uppercase font-bold text-[#2563EB]">
                      Beat Sync
                    </div>
                    <div className="text-xl font-extrabold text-blue-900 mt-0.5">
                      {syncPercent}%
                    </div>
                  </div>
                </div>

                {/* Simulation Toggle Option */}
                <div className="flex items-center justify-between w-full pt-2 text-xs border-t border-slate-100">
                  <span className="text-slate-500 font-medium">
                    {simulatedMode
                      ? "Sensor unavailable (Simulated movement active)"
                      : "Capturing DeviceMotion acceleration..."}
                  </span>
                  <button
                    onClick={() => setSimulatedMode(!simulatedMode)}
                    className="text-[#2563EB] font-bold underline text-[11px]"
                  >
                    {simulatedMode ? "Use Real Sensor" : "Simulate Movement"}
                  </button>
                </div>
              </Card>

              {/* Live Cadence Line Chart (Green #10B981) */}
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#10B981]" />
                    <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                      Live Trial Cadence
                    </h2>
                  </div>
                  <span className="text-[10px] text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    Target: {bpm} BPM
                  </span>
                </div>

                <div className="h-36 w-full bg-slate-50/70 p-2 rounded-2xl border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={
                        dataHistory.length > 0
                          ? dataHistory
                          : [{ timeSec: 0, cadence: bpm, sync: 80 }]
                      }
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="timeSec" unit="s" tick={{ fontSize: 10 }} />
                      <YAxis domain={[40, 140]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
                      <Line
                        type="monotone"
                        dataKey="cadence"
                        name="Cadence"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#10B981" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Stop Test Button */}
              <Button
                variant="outline"
                fullWidth
                size="md"
                onClick={handleStopTest}
                className="border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <Square className="w-4 h-4 mr-2 fill-rose-600" />
                <span>Stop Test</span>
              </Button>
            </>
          ) : (
            /* TRIAL COMPLETED SUMMARY SCREEN & ADAPT TRIGGER */
            <div className="space-y-4 animate-in fade-in duration-200">
              <Card className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-[#172554]">
                    Trial 1 Completed!
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1">
                    Initial test for {selectedType.toUpperCase()} cue at {bpm} BPM
                  </p>
                </div>

                {/* Score Grid */}
                {trialResult && (
                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Response Score
                      </div>
                      <div className="text-2xl font-black text-[#2563EB] mt-0.5">
                        {trialResult.responseScore}
                        <span className="text-xs font-normal">/100</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Mean Cadence
                      </div>
                      <div className="text-2xl font-black text-emerald-700 mt-0.5">
                        {trialResult.meanCadence}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Beat Sync
                      </div>
                      <div className="text-2xl font-black text-purple-700 mt-0.5">
                        {trialResult.sync}%
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* ACTION BUTTON TO START STEP 3 ADAPTIVE SEARCH */}
              <div className="space-y-2">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleStartAdaptSearch}
                  className="bg-brand-gradient hover:opacity-95 shadow-md py-4 text-base font-extrabold"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  <span>Start Adaptive Optimization (Step 3)</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={() => setStep(1)}
                  className="border-slate-200 text-slate-700"
                >
                  <span>Back to Design</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: ADAPT (Hill-Climbing Adaptive Search & Cue Race) */}
      {/* ========================================================= */}
      {step === 3 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Active Search Running Status Banner */}
          {isAdaptRunning && (
            <Card className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <VisualPulse
                  beatCount={beatCount}
                  beatInBar={beatInBar}
                  isPlaying={isTrialActive}
                  size="sm"
                />
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-blue-100 animate-pulse">
                    Finding your best rhythm...
                  </div>
                  <div className="text-sm font-black mt-0.5">
                    Testing Trial {adaptTrials.length + 1} of 5 ({bpm} BPM)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 12s Countdown Badge */}
                <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full border border-white/30">
                  {trialTimeLeft}s
                </span>

                {/* Dev Skip Wait Button */}
                <button
                  onClick={handleSkipWait}
                  title="Dev Skip Wait (Instantly complete 12s trial)"
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all text-xs font-bold flex items-center gap-1"
                >
                  <FastForward className="w-4 h-4" />
                  <span className="hidden sm:inline">Skip</span>
                </button>
              </div>
            </Card>
          )}

          {/* LIVE "CUE RACE" HORIZONTAL BAR CHART */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider">
                  Live Cue Race
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {adaptTrials.length} / 5 Trials
              </span>
            </div>

            {/* Horizontal Bar Chart */}
            <div className="space-y-3">
              {adaptTrials.map((trial) => {
                const isWinner = winningTrial && winningTrial.trialNumber === trial.trialNumber;
                return (
                  <div key={trial.trialNumber} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#172554]">
                      <span className="flex items-center gap-1.5">
                        {isWinner && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                        <span>
                          Trial {trial.trialNumber} • {trial.bpm} BPM ({trial.type})
                        </span>
                      </span>
                      <span className="text-[#2563EB]">{trial.responseScore}/100</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isWinner
                            ? "bg-brand-gradient shadow-xs"
                            : "bg-[#6366F1]"
                        }`}
                        style={{ width: `${trial.responseScore}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* RESULT CARD: "🏆 YOUR WINNING CUE" */}
          {!isAdaptRunning && winningTrial && (
            <Card className="bg-gradient-to-br from-amber-50/80 via-white to-indigo-50/50 border-amber-200/90 shadow-xl space-y-4 relative overflow-hidden animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-amber-100 text-amber-600 shadow-xs">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-[#172554] uppercase tracking-wider">
                      🏆 Your Winning Cue
                    </h2>
                    <p className="text-xs text-[#64748B]">Optimal pacing parameters identified</p>
                  </div>
                </div>

                {/* Response Label Pill */}
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full border ${
                    getResponseLabel(winningTrial.responseScore) === "Strong"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : getResponseLabel(winningTrial.responseScore) === "Good"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {getResponseLabel(winningTrial.responseScore)} Response
                </span>
              </div>

              {/* Winning Parameters Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Cue Type</div>
                  <div className="text-sm font-extrabold text-[#172554] capitalize mt-1 flex items-center justify-center gap-1">
                    {winningTrial.type === "audio" && "🔊 Audio"}
                    {winningTrial.type === "vibration" && "📳 Vibration"}
                    {winningTrial.type === "visual" && "✨ Visual"}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Optimal Tempo</div>
                  <div className="text-xl font-black text-[#2563EB] mt-0.5">
                    {winningTrial.bpm} <span className="text-xs font-normal">BPM</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Response Score</div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">
                    {winningTrial.responseScore}<span className="text-xs font-normal">/100</span>
                  </div>
                </div>
              </div>

              {/* Confidence Badge */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 font-medium">Algorithm Confidence:</span>
                <ConfidenceBadge
                  level={adaptTrials.length < 3 || winningTrial.isSimulated ? "low" : "high"}
                  reason={
                    winningTrial.isSimulated
                      ? `Simulated movement model (${adaptTrials.length} trials evaluated)`
                      : `${adaptTrials.length} real movement sensor trials evaluated`
                  }
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleSaveWinningCue}
                  className="bg-brand-gradient shadow-md font-bold"
                >
                  <BookmarkCheck className="w-4 h-4 mr-2" />
                  <span>Use as my cue</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    fullWidth
                    size="md"
                    onClick={() => setStep(1)}
                    className="border-slate-200 text-slate-700 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    <span>Test another type</span>
                  </Button>

                  <Button
                    variant="secondary"
                    fullWidth
                    size="md"
                    onClick={() => router.push("/cue-lab/prescription")}
                    className="bg-indigo-50 text-[#6366F1] hover:bg-indigo-100 text-xs font-bold"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    <span>Generate Cue Prescription</span>
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* CUE RACE ACROSS TYPES (Multi-Type Comparison Table) */}
          {typeSummaries.length > 1 && (
            <Card className="space-y-3 bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Cue Race Across Modalities</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">
                  {typeSummaries.length} Modalities Tested
                </span>
              </div>

              <div className="space-y-2">
                {typeSummaries.map((summary) => (
                  <div
                    key={summary.type}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      summary.isOverallWinner
                        ? "bg-white border-amber-300 ring-2 ring-amber-400 shadow-xs"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold capitalize text-[#172554] flex items-center gap-1">
                        {summary.type === "audio" && "🔊 Audio"}
                        {summary.type === "vibration" && "📳 Vibration"}
                        {summary.type === "visual" && "✨ Visual"}
                      </span>
                      {summary.isOverallWinner && (
                        <span className="text-[10px] bg-amber-100 text-[#D97706] font-extrabold px-2 py-0.2 rounded-full border border-amber-200 flex items-center gap-0.5">
                          <Trophy className="w-2.5 h-2.5 text-[#F59E0B]" />
                          <span>Overall Winner</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 font-semibold">{summary.bestBpm} BPM</span>
                      <span className="font-bold text-[#2563EB]">{summary.bestScore}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* STOP ADAPT SEARCH BUTTON (IF STILL RUNNING) */}
          {isAdaptRunning && (
            <Button
              variant="outline"
              fullWidth
              size="md"
              onClick={handleStopTest}
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              <Square className="w-4 h-4 mr-2 fill-rose-600" />
              <span>Cancel Adaptive Search</span>
            </Button>
          )}
        </div>
      )}

      {/* CUE PRESCRIPTION MODAL */}
      {showPrescriptionModal && winningTrial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowPrescriptionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-brand-gradient text-white">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#172554]">Cue Prescription</h3>
                <p className="text-xs text-[#64748B]">Personalized Pacing Target</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-200 pb-1.5 font-bold">
                <span>Modality:</span>
                <span className="text-[#2563EB] capitalize">{winningTrial.type} Metronome</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5 font-bold">
                <span>Target Tempo:</span>
                <span className="text-emerald-700">{winningTrial.bpm} BPM</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5 font-bold">
                <span>Response Quality:</span>
                <span className="text-purple-700">{getResponseLabel(winningTrial.responseScore)}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                <strong>Usage Advice:</strong> Use this {winningTrial.bpm} BPM {winningTrial.type} cue during morning walks or when experiencing hesitation or freezing of gait.
              </p>
            </div>

            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={() => setShowPrescriptionModal(false)}
              className="bg-brand-gradient"
            >
              Close Prescription
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
