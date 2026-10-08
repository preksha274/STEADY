"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { addSession } from "@/lib/sessions";
import {
  calculateBradykinesiaScore,
  BradykinesiaCalculationResult,
  UPDRS_RATING_INFO,
  TapSample,
} from "@/lib/bradykinesia";
import {
  Hand,
  Play,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Timer,
  Zap,
  Activity,
  Award,
  TrendingDown,
  Info,
  Sparkles,
  Fingerprint,
} from "lucide-react";

type TestStage = "setup" | "countdown" | "tapping" | "results";
type HandSelection = "right" | "left" | "both";

export default function BradykinesiaPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [selectedHand, setSelectedHand] = useState<HandSelection>("right");
  const [activeHandIndex, setActiveHandIndex] = useState<number>(0); // for "both" sequence
  const [stage, setStage] = useState<TestStage>("setup");

  // Countdown timers
  const [startCountdown, setStartCountdown] = useState<number>(3);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(10.0);

  // Tap recording
  const [taps, setTaps] = useState<TapSample[]>([]);
  const [activeZone, setActiveZone] = useState<"A" | "B" | null>(null);
  const [ripplePos, setRipplePos] = useState<{ zone: "A" | "B"; x: number; y: number } | null>(null);
  const [wasInterrupted, setWasInterrupted] = useState<boolean>(false);

  // Results
  const [result, setResult] = useState<BradykinesiaCalculationResult | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const tappingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    return () => {
      clearAllTimers();
    };
  }, []);

  const clearAllTimers = () => {
    if (tappingTimerRef.current) clearInterval(tappingTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  };

  // Start 3-2-1 countdown
  const handleStartTest = () => {
    setStage("countdown");
    setStartCountdown(3);
    setTaps([]);
    setWasInterrupted(false);
    setResult(null);
    setSavedSessionId(null);

    let count = 3;
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setStartCountdown(count);
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        begin10sTappingWindow();
      }
    }, 1000);
  };

  // Begin 10.0s Tapping Window
  const begin10sTappingWindow = () => {
    setStage("tapping");
    setTimeLeftSec(10.0);
    setTaps([]);
    startTimeRef.current = Date.now();

    const startTime = startTimeRef.current;
    const durationMs = 10000;

    tappingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      setTimeLeftSec(Number(remaining.toFixed(1)));

      if (elapsed >= durationMs) {
        finishTappingWindow(false);
      }
    }, 50);
  };

  // Record a tap event on Zone A or Zone B
  const handleZoneTap = (zone: "A" | "B", e: React.MouseEvent | React.TouchEvent) => {
    if (stage !== "tapping") return;

    // Prevent zoom/scroll on rapid mobile touch
    if (e.cancelable) e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);

    const newTap: TapSample = {
      timestamp: Date.now(),
      zone,
      x,
      y,
    };

    setTaps((prev) => [...prev, newTap]);
    setActiveZone(zone);
    setRipplePos({ zone, x, y });

    setTimeout(() => {
      setActiveZone(null);
    }, 120);
  };

  // Stop test manually early
  const handleStopEarly = () => {
    finishTappingWindow(true);
  };

  // Finish 10s Window and Compute UPDRS Score
  const finishTappingWindow = (interrupted = false) => {
    clearAllTimers();
    setWasInterrupted(interrupted);

    // Calculate metrics
    setTaps((finalTaps) => {
      const calculated = calculateBradykinesiaScore(finalTaps, 10, interrupted);
      setResult(calculated);
      setStage("results");
      return finalTaps;
    });
  };

  // Save score to session history
  const handleSaveToSession = () => {
    if (!result) return;

    const currentHandLabel =
      selectedHand === "both"
        ? activeHandIndex === 0
          ? "right"
          : "left"
        : selectedHand;

    const timestamp = new Date().toISOString();
    const session = addSession({
      timestamp,
      tremor: {
        frequencyHz: 4.8,
        amplitude: 0.22,
        intensity: result.updrsScore >= 3 ? "high" : result.updrsScore === 2 ? "moderate" : "mild",
        confidence: result.confidence,
        confidenceReason: "Associated finger-tap session",
      },
      bradykinesia: {
        hand: currentHandLabel as "right" | "left" | "both",
        tapCount: result.tapCount,
        tapRateHz: result.tapRateHz,
        amplitudePx: result.amplitudePx,
        decrementPct: result.decrementPct,
        updrsScore: result.updrsScore,
        updrsLabel: result.updrsLabel,
        confidence: result.confidence,
        confidenceReason: result.confidenceReason,
      },
      source: "live",
    });

    setSavedSessionId(session.id);
  };

  if (!mounted) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading finger tap test...</div>;
  }

  const currentHandDisplay =
    selectedHand === "right"
      ? "Right Hand"
      : selectedHand === "left"
      ? "Left Hand"
      : "Right & Left Hand";

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/analyze"
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#172554] tracking-tight">
                Finger Tap Test
              </h1>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                MDS-UPDRS 3.4
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Bradykinesia &amp; Sequence Effect Analysis
            </p>
          </div>
        </div>
        <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-xs">
          <Hand className="w-5 h-5" />
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* STAGE 1: SETUP & HAND SELECTION */}
      {/* ------------------------------------------------------------- */}
      {stage === "setup" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#172554]">Select Hand to Test</h2>
                <p className="text-xs text-[#64748B]">
                  Test right or left hand for 10 seconds of fast alternate tapping.
                </p>
              </div>
              <Hand className="w-5 h-5 text-amber-500" />
            </div>

            {/* Hand Selection Segment */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedHand("right")}
                className={`py-2 rounded-lg text-center transition-all ${
                  selectedHand === "right"
                    ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Right Hand
              </button>
              <button
                type="button"
                onClick={() => setSelectedHand("left")}
                className={`py-2 rounded-lg text-center transition-all ${
                  selectedHand === "left"
                    ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Left Hand
              </button>
              <button
                type="button"
                onClick={() => setSelectedHand("both")}
                className={`py-2 rounded-lg text-center transition-all ${
                  selectedHand === "both"
                    ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Both Hands
              </button>
            </div>

            {/* Instructions Box */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Test Instructions (MDS-UPDRS Item 3.4)</span>
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                Tap alternately between Target A (Left) and Target B (Right) as fast and as wide as possible for 10 seconds.
              </p>
              <ul className="text-[11px] text-amber-800 space-y-1 list-disc pl-4">
                <li>Maintain maximum speed and tapping distance.</li>
                <li>The test measures tap rate and decrement (% drop in 2nd half).</li>
              </ul>
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={handleStartTest}
              className="bg-brand-gradient shadow-md font-bold py-3.5"
            >
              <Play className="w-5 h-5 mr-2" />
              <span>Start 10s Finger Tap Test ({currentHandDisplay})</span>
            </Button>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STAGE 2: 3-2-1 COUNTDOWN */}
      {/* ------------------------------------------------------------- */}
      {stage === "countdown" && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-8 text-center space-y-4 animate-in fade-in">
          <div className="text-xs font-black text-amber-700 uppercase tracking-widest">
            Get Ready ({currentHandDisplay})
          </div>
          <div className="text-7xl font-black text-amber-600 animate-bounce">
            {startCountdown}
          </div>
          <div className="text-sm font-bold text-[#172554]">
            Place fingers over the screen targets...
          </div>
          <p className="text-xs text-slate-500">
            Tap alternately between Target A and Target B as fast as you can!
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STAGE 3: ACTIVE 10-SECOND FINGER TAPPING */}
      {/* ------------------------------------------------------------- */}
      {stage === "tapping" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Top Timer Bar */}
          <div className="bg-[#172554] text-white rounded-2xl p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white animate-pulse">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-300 block">
                  Time Remaining
                </span>
                <span className="text-2xl font-black tracking-tight text-white">
                  {timeLeftSec.toFixed(1)}s
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-300 block">
                Taps Recorded
              </span>
              <span className="text-2xl font-black text-amber-400">
                {taps.length}
              </span>
            </div>
          </div>

          {/* TWO LARGE TAP ZONES ON SCREEN */}
          <div className="grid grid-cols-2 gap-3 h-72">
            {/* Zone A (Left) */}
            <button
              type="button"
              onMouseDown={(e) => handleZoneTap("A", e)}
              onTouchStart={(e) => handleZoneTap("A", e)}
              className={`relative rounded-3xl border-2 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer select-none active:scale-95 ${
                activeZone === "A"
                  ? "bg-blue-500 text-white border-blue-600 ring-4 ring-blue-300 shadow-lg scale-95"
                  : "bg-gradient-to-b from-blue-50 to-blue-100 border-blue-300 text-blue-900 hover:bg-blue-100 shadow-md"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <div className="w-16 h-16 rounded-full bg-blue-600/10 border-2 border-blue-400 flex items-center justify-center mb-2">
                <span className="text-2xl font-black text-blue-700">A</span>
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-800">
                TAP HERE
              </span>
              <span className="text-[10px] text-blue-600 mt-1 font-medium">Target 1</span>

              {/* Ripple Effect */}
              {ripplePos && ripplePos.zone === "A" && (
                <span
                  className="absolute rounded-full bg-blue-400/40 animate-ping pointer-events-none"
                  style={{
                    width: 80,
                    height: 80,
                    left: ripplePos.x - 40,
                    top: ripplePos.y - 40,
                  }}
                />
              )}
            </button>

            {/* Zone B (Right) */}
            <button
              type="button"
              onMouseDown={(e) => handleZoneTap("B", e)}
              onTouchStart={(e) => handleZoneTap("B", e)}
              className={`relative rounded-3xl border-2 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer select-none active:scale-95 ${
                activeZone === "B"
                  ? "bg-amber-500 text-white border-amber-600 ring-4 ring-amber-300 shadow-lg scale-95"
                  : "bg-gradient-to-b from-amber-50 to-amber-100 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-md"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <div className="w-16 h-16 rounded-full bg-amber-600/10 border-2 border-amber-400 flex items-center justify-center mb-2">
                <span className="text-2xl font-black text-amber-700">B</span>
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                TAP HERE
              </span>
              <span className="text-[10px] text-amber-600 mt-1 font-medium">Target 2</span>

              {/* Ripple Effect */}
              {ripplePos && ripplePos.zone === "B" && (
                <span
                  className="absolute rounded-full bg-amber-400/40 animate-ping pointer-events-none"
                  style={{
                    width: 80,
                    height: 80,
                    left: ripplePos.x - 40,
                    top: ripplePos.y - 40,
                  }}
                />
              )}
            </button>
          </div>

          <Button
            variant="outline"
            fullWidth
            onClick={handleStopEarly}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold py-2.5"
          >
            <span>Stop Recording</span>
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STAGE 4: RESULTS DISPLAY (UPDRS SCORE & CLINICAL METRICS) */}
      {/* ------------------------------------------------------------- */}
      {stage === "results" && result && (
        <div className="space-y-4 animate-in fade-in">
          {/* Main Trend Banner */}
          {(() => {
            const meta = UPDRS_RATING_INFO[result.updrsScore];
            return (
              <Card className={`space-y-3 p-5 border ${meta.bgClass}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                      Finger-Tap Session Trend
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-2xl font-black ${meta.textClass}`}>
                        {result.tapRateHz} <span className="text-xs font-normal text-slate-600">taps/sec ({result.decrementPct}% fatigue decay)</span>
                      </span>
                    </div>
                  </div>
                  <ConfidenceBadge level={result.confidence} reason={result.confidenceReason} attribution={result.attribution} />
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Trend across repeated sessions. Sequence fatigue drop: {result.firstHalfRateHz}Hz → {result.secondHalfRateHz}Hz.
                </p>

                <div className="p-3 bg-white/80 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-[#172554] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Estimated trend, not a clinical rating</span>
                  </div>
                  <p className="text-slate-700 text-[11px] font-medium leading-relaxed">
                    {result.attribution}
                  </p>
                </div>
              </Card>
            );
          })()}


          {/* Key Clinical Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Metric 1: Tap Speed */}
            <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0]">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                  Speed
                </span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[#64748B] block">
                  Tap Rate
                </span>
                <div className="text-xl font-bold text-[#172554] mt-0.5">
                  {result.tapRateHz}{" "}
                  <span className="text-xs text-slate-500 font-normal">taps/sec</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">
                  Total: {result.tapCount} taps in 10s
                </span>
              </div>
            </Card>

            {/* Metric 2: Decrement % (Sequence Effect) */}
            <Card className="p-4 space-y-2 border-[0.5px] border-[#E2E8F0]">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                  Sequence Effect
                </span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[#64748B] block">
                  Fatigue Decrement
                </span>
                <div className="text-xl font-bold text-[#172554] mt-0.5">
                  {result.decrementPct}%{" "}
                  <span className="text-xs text-slate-500 font-normal">drop</span>
                </div>
                <span className="text-[10px] text-amber-700 font-medium block mt-1">
                  1st half ({result.firstHalfRateHz}Hz) → 2nd ({result.secondHalfRateHz}Hz)
                </span>
              </div>
            </Card>
          </div>

          {/* Clinical Rationale Accordion Card */}
          <Card className="space-y-2.5 border-[0.5px] border-[#E2E8F0]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#172554]">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Sequence Effect Breakdown</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              MDS-UPDRS finger tapping evaluates the progressive reduction in speed or amplitude (the <em>sequence effect</em>), which is a characteristic clinical signal of parkinsonian bradykinesia.
            </p>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {!savedSessionId ? (
              <PrimaryButton fullWidth onClick={handleSaveToSession}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                <span>Save to Movement Session History</span>
              </PrimaryButton>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Saved to Movement History!</span>
                </div>
                <Link
                  href={`/fingerprint?session=${savedSessionId}`}
                  className="text-xs text-blue-700 underline font-extrabold flex items-center gap-1"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>View Fingerprint</span>
                </Link>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setStage("setup");
                  setResult(null);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                <span>Test Again</span>
              </Button>
              <Link href="/fingerprint" className="flex-1">
                <Button variant="outline" fullWidth>
                  <Fingerprint className="w-4 h-4 mr-1.5" />
                  <span>Fingerprint</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
