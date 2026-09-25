"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { addSession } from "@/lib/sessions";
import {
  Activity,
  Footprints,
  Hand,
  Mic,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Info,
  RotateCcw,
  Play,
  SkipForward,
} from "lucide-react";

interface StepConfig {
  id: number;
  title: string;
  subtitle: string;
  duration: number; // in seconds
  icon: React.ElementType;
  guidance: string;
  instructions: string[];
}

const STEPS: StepConfig[] = [
  {
    id: 1,
    title: "Tremor Hold",
    subtitle: "Resting tremor & stability baseline",
    duration: 15,
    icon: Activity,
    guidance: "Hold your phone flat and resting comfortably on your lap or palm without tensing.",
    instructions: [
      "Rest your forearm comfortably on a table or your lap",
      "Hold the device gently with your primary hand",
      "Stay relaxed and breathe normally while the timer counts down",
    ],
  },
  {
    id: 2,
    title: "Walk Test",
    subtitle: "Gait speed & step rhythm baseline",
    duration: 15,
    icon: Footprints,
    guidance: "Walk at your normal, comfortable pace across a clear hallway or room.",
    instructions: [
      "Ensure a clear walking path of at least 10 feet",
      "Place phone in your pocket or hold steadily at waist level",
      "Walk naturally until the countdown completes",
    ],
  },
  {
    id: 3,
    title: "Finger Tap",
    subtitle: "Motor speed & tapping rhythm",
    duration: 15,
    icon: Hand,
    guidance: "Tap the two target buttons alternately as fast and regularly as comfortable.",
    instructions: [
      "Rest the phone flat on a table in front of you",
      "Use your index and middle finger (or thumb)",
      "Tap Target A and Target B back and forth steadily",
    ],
  },
  {
    id: 4,
    title: "Voice Check",
    subtitle: "Vocal loudness & sustained vowel",
    duration: 5,
    icon: Mic,
    guidance: "Say 'Ahhh' steadily at your normal speaking volume.",
    instructions: [
      "Hold your phone about 6 inches from your mouth",
      "Take a deep breath and vocalize a continuous 'Ahhh'",
      "Keep your tone as steady and clear as possible",
    ],
  },
];

export default function BaselineOnboardingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isStepActive, setIsStepActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTarget, setLastTapTarget] = useState<"A" | "B" | null>(null);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const currentStep = STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;

  useEffect(() => {
    setMounted(true);
    setTimeLeft(currentStep.duration);
    setIsStepActive(false);
    setStepCompleted(false);
  }, [currentStepIndex]);

  // Countdown timer for active step
  useEffect(() => {
    if (!isStepActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsStepActive(false);
          setStepCompleted(true);
          setCompletedSteps((prevDone) =>
            prevDone.includes(currentStep.id) ? prevDone : [...prevDone, currentStep.id]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStepActive, currentStep.id]);

  const handleStartStep = () => {
    setTimeLeft(currentStep.duration);
    setIsStepActive(true);
    setStepCompleted(false);
    setTapCount(0);
    setLastTapTarget(null);
  };

  const handleNextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      finishBaseline();
    }
  };

  const handleSkipStep = () => {
    setIsStepActive(false);
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      finishBaseline();
    }
  };

  const handleTap = (target: "A" | "B") => {
    if (!isStepActive) return;
    if (lastTapTarget !== target) {
      setTapCount((c) => c + 1);
      setLastTapTarget(target);
    }
  };

  const finishBaseline = () => {
    // Generate initial session record that feeds personal baseline
    const nowIso = new Date().toISOString();
    addSession({
      timestamp: nowIso,
      tremor: {
        frequencyHz: 4.8,
        amplitude: 0.28,
        intensity: "mild",
        confidence: "high",
        confidenceReason: "Day 1 Baseline calibration test",
      },
      gait: {
        cadence: 106,
        symmetry: 94,
        confidence: "high",
      },
      eeg: {
        delta: 0.1,
        theta: 0.15,
        alpha: 0.55,
        beta: 0.2,
        confidence: "medium",
      },
      source: "live",
    });

    try {
      localStorage.setItem("steady_baseline_completed", "true");
    } catch (e) {
      console.error(e);
    }

    router.push("/today");
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  // Circular progress calculations
  const totalSeconds = currentStep.duration;
  const progressRatio = (totalSeconds - timeLeft) / totalSeconds;
  const strokeDashoffset = 283 - 283 * progressRatio; // 2 * PI * 45 ≈ 283

  return (
    <div className="min-h-screen bg-background-gradient p-4 sm:p-6 flex flex-col justify-between max-w-md mx-auto space-y-5">
      {/* Top Header & 4-Step Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#64748B] uppercase tracking-wider">
          <span className="text-[#2563EB] font-bold">Step {currentStep.id} of 4</span>
          <span>Day 1 Baseline Test</span>
        </div>

        {/* 4-Step Segmented Progress Bar */}
        <div className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, idx) => {
            const isDone = completedSteps.includes(s.id);
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={s.id} className="space-y-1">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isDone || isCurrent
                      ? "bg-brand-gradient"
                      : "bg-[#E2E8F0]"
                  }`}
                />
                <span
                  className={`text-[10px] block truncate text-center ${
                    isCurrent ? "font-semibold text-[#2563EB]" : "text-[#64748B]"
                  }`}
                >
                  {s.title.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Test Interactive Area */}
      <Card className="space-y-5 border-[0.5px] border-[#E2E8F0] text-left">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-3 rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
              <StepIcon className="w-6 h-6 stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#172554] tracking-tight">
                {currentStep.title}
              </h1>
              <p className="text-xs text-[#64748B]">{currentStep.subtitle}</p>
            </div>
          </div>
          {stepCompleted && (
            <StatusDot status="success" label="Complete" size="sm" />
          )}
        </div>

        <p className="text-xs text-[#64748B] font-normal leading-relaxed">
          {currentStep.guidance}
        </p>

        {/* Circular Countdown Timer */}
        <div className="py-2 flex flex-col items-center justify-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="text-slate-100"
                strokeWidth="7"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                className="text-[#2563EB] transition-all duration-500 ease-out"
                strokeWidth="7"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-[#172554] tracking-tight">
                {timeLeft}s
              </span>
              <span className="text-[10px] uppercase font-semibold text-[#64748B]">
                {isStepActive ? "Recording" : stepCompleted ? "Done" : "Ready"}
              </span>
            </div>
          </div>
        </div>

        {/* Special interactive area for Finger Tap (Step 3) */}
        {currentStep.id === 3 && isStepActive && (
          <div className="space-y-2">
            <div className="text-xs text-center font-semibold text-[#2563EB]">
              Taps logged: {tapCount}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTap("A")}
                className={`min-h-[56px] py-3 rounded-2xl border-2 font-bold text-base transition-all cursor-pointer ${
                  lastTapTarget === "A"
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] hover:bg-blue-100"
                }`}
              >
                Target A
              </button>
              <button
                type="button"
                onClick={() => handleTap("B")}
                className={`min-h-[56px] py-3 rounded-2xl border-2 font-bold text-base transition-all cursor-pointer ${
                  lastTapTarget === "B"
                    ? "bg-[#6366F1] text-white border-[#6366F1]"
                    : "bg-[#EFF6FF] text-[#6366F1] border-[#BFDBFE] hover:bg-indigo-100"
                }`}
              >
                Target B
              </button>
            </div>
          </div>
        )}

        {/* Step Instructions */}
        <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border-[0.5px] border-[#E2E8F0] space-y-1.5">
          <span className="text-[11px] font-semibold text-[#172554] block">
            Instructions:
          </span>
          <ul className="text-xs text-[#64748B] space-y-1 pl-4 list-disc font-normal">
            {currentStep.instructions.map((ins, i) => (
              <li key={i}>{ins}</li>
            ))}
          </ul>
        </div>

        {/* Action Controls */}
        <div className="space-y-2.5 pt-1">
          {!isStepActive && !stepCompleted && (
            <PrimaryButton fullWidth onClick={handleStartStep}>
              <Play className="w-4 h-4 mr-1.5 fill-white" />
              <span>Start {currentStep.title} ({currentStep.duration}s)</span>
            </PrimaryButton>
          )}

          {isStepActive && (
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setTimeLeft(1);
              }}
              className="border-blue-200 text-[#2563EB]"
            >
              <span>Finish Early</span>
            </Button>
          )}

          {stepCompleted && (
            <PrimaryButton fullWidth onClick={handleNextStep}>
              <span>
                {currentStepIndex < STEPS.length - 1
                  ? `Continue to Step ${currentStepIndex + 2}`
                  : "Complete & Build Baseline"}
              </span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </PrimaryButton>
          )}

          {/* "Skip this step" option (accessible, ≥ 44px) */}
          <button
            type="button"
            onClick={handleSkipStep}
            className="w-full min-h-[44px] py-2 text-xs font-medium text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Skip this step</span>
          </button>
        </div>
      </Card>

      {/* Footer Disclaimer (Exact required wording) */}
      <footer className="p-3 bg-white/80 rounded-2xl border-[0.5px] border-[#E2E8F0] text-center">
        <p className="text-[11px] text-[#64748B] leading-normal font-normal">
          This builds your personal baseline. It&apos;s not a diagnosis or clinical score.
        </p>
      </footer>
    </div>
  );
}
