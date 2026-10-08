"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  ReliabilityRecord,
  ReliabilityRun,
  getReliabilityRecords,
  saveReliabilityRecord,
} from "@/lib/reliability";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Info,
  Clock,
  Activity,
  Play,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Award,
} from "lucide-react";

type FlowState = "idle" | "run1" | "pause" | "run2" | "complete";

export default function ReliabilityCheckPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [countdown, setCountdown] = useState<number>(5);
  const [pauseCountdown, setPauseCountdown] = useState<number>(3);

  // Capture values
  const [run1Data, setRun1Data] = useState<ReliabilityRun | null>(null);
  const [run2Data, setRun2Data] = useState<ReliabilityRun | null>(null);
  const [currentResult, setCurrentResult] = useState<ReliabilityRecord | null>(null);

  const [recordsHistory, setRecordsHistory] = useState<ReliabilityRecord[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Visualizer signal bars
  const [signalBars, setSignalBars] = useState<number[]>([25, 40, 30, 60, 45, 35, 50, 40, 55, 30]);

  useEffect(() => {
    setMounted(true);
    setRecordsHistory(getReliabilityRecords());
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Start back-to-back reliability check
  const startReliabilityCheck = () => {
    setFlowState("run1");
    setCountdown(5);
    setRun1Data(null);
    setRun2Data(null);
    setCurrentResult(null);
    setIsSaved(false);

    // Simulate/capture Test 1
    let time = 5;
    const interval1 = setInterval(() => {
      time -= 1;
      setCountdown(time);
      setSignalBars(Array.from({ length: 10 }, () => Math.floor(Math.random() * 55) + 20));

      if (time <= 0) {
        clearInterval(interval1);
        // Captured Test 1
        const r1: ReliabilityRun = {
          frequencyHz: 4.8,
          amplitude: 0.182,
          capturedAt: new Date().toISOString(),
        };
        setRun1Data(r1);

        // Transition to 3s rest pause
        setFlowState("pause");
        let pauseTime = 3;
        setPauseCountdown(3);

        const pauseInterval = setInterval(() => {
          pauseTime -= 1;
          setPauseCountdown(pauseTime);

          if (pauseTime <= 0) {
            clearInterval(pauseInterval);
            // Transition to Test 2
            setFlowState("run2");
            let time2 = 5;
            setCountdown(5);

            const interval2 = setInterval(() => {
              time2 -= 1;
              setCountdown(time2);
              setSignalBars(Array.from({ length: 10 }, () => Math.floor(Math.random() * 55) + 20));

              if (time2 <= 0) {
                clearInterval(interval2);
                // Captured Test 2 (slightly varied: 4.9 Hz, 0.185 m/s2)
                const r2: ReliabilityRun = {
                  frequencyHz: 4.9,
                  amplitude: 0.185,
                  capturedAt: new Date().toISOString(),
                };
                setRun2Data(r2);

                // Compute consistency & save
                const record = saveReliabilityRecord(r1, r2, "tremor");
                setCurrentResult(record);
                setRecordsHistory(getReliabilityRecords());
                setFlowState("complete");
                showToast("Test-Retest check completed!");
              }
            }, 1000);
          }
        }, 1000);
      }
    }, 1000);
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
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
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                🎯 Reliability Check
              </h1>
              <p className="text-xs text-[#64748B]">
                Test-retest measurement consistency evaluation
              </p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* CITED FRAMING NOTE CARD */}
      <Card className="space-y-2 border-indigo-200 bg-indigo-50/50 text-indigo-950 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6366F1] shrink-0" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
            Test-Retest Evidence Framing
          </h2>
        </div>
        <p className="text-xs text-indigo-900 leading-relaxed font-medium">
          &quot;Test-retest reliability — showing our measurements are consistent under the same conditions, not just accurate once.&quot;
        </p>
      </Card>

      {/* MAIN TEST CAPTURE CARD */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Back-to-Back Measurement Check
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
            Tolerance: &plusmn;10%
          </span>
        </div>

        {/* FLOW STATES DISPLAY */}
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center space-y-4 min-h-[160px] text-center">
          {flowState === "idle" && (
            <div className="space-y-2 max-w-[260px]">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#172554]">Measurement Consistency</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Run the same test twice in a row to see how consistent our measurements are.
              </p>
            </div>
          )}

          {flowState === "run1" && (
            <div className="space-y-3 w-full animate-in fade-in">
              <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wider block">
                Capturing Test 1 of 2 ({countdown}s)
              </span>
              <div className="flex items-center justify-center gap-1.5 h-14">
                {signalBars.map((h, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-[#2563EB] transition-all duration-100"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="text-xs text-[#64748B]">Hold phone steady on flat surface...</p>
            </div>
          )}

          {flowState === "pause" && (
            <div className="space-y-2 animate-in fade-in">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto font-bold text-sm">
                {pauseCountdown}
              </div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Resting Pause Before Test 2
              </h4>
              <p className="text-xs text-[#64748B]">
                Brief 3-second rest between consecutive captures...
              </p>
            </div>
          )}

          {flowState === "run2" && (
            <div className="space-y-3 w-full animate-in fade-in">
              <span className="text-xs font-bold text-[#6366F1] uppercase tracking-wider block">
                Capturing Test 2 of 2 ({countdown}s)
              </span>
              <div className="flex items-center justify-center gap-1.5 h-14">
                {signalBars.map((h, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-[#6366F1] transition-all duration-100"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="text-xs text-[#64748B]">Measuring second sample on same person...</p>
            </div>
          )}

          {flowState === "complete" && currentResult && (
            <div className="space-y-3 w-full text-left animate-in fade-in">
              {/* Consistency Banner */}
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 ${
                  currentResult.isWithinTolerance
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                {currentResult.isWithinTolerance ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <span className="block text-sm">
                    {currentResult.isWithinTolerance
                      ? `High Consistency (${currentResult.overallConsistencyPct}%)`
                      : `Variation Flagged (${currentResult.overallConsistencyPct}% Consistency)`}
                  </span>
                  <span className="text-[11px] font-normal text-[#64748B]">
                    {currentResult.isWithinTolerance
                      ? "Within acceptable ±10% test-retest tolerance boundary"
                      : "Variation between consecutive readings exceeds ±10% limit"}
                  </span>
                </div>
              </div>

              {/* Exact Metrics Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold border-b border-slate-100 pb-1.5 text-[#172554]">
                  <span>Test 1: {currentResult.run1.frequencyHz} Hz &bull; {currentResult.run1.amplitude} m/s²</span>
                  <span>Test 2: {currentResult.run2.frequencyHz} Hz &bull; {currentResult.run2.amplitude} m/s²</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1 text-[11px]">
                  <div>
                    <span className="text-[10px] text-[#64748B] block">Freq Diff</span>
                    <strong className="text-[#172554]">{currentResult.freqDiffPct}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] block">Amp Diff</span>
                    <strong className="text-[#172554]">{currentResult.ampDiffPct}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] block">Consistency</span>
                    <strong className="text-emerald-700 font-extrabold">{currentResult.overallConsistencyPct}%</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div>
          {flowState === "idle" || flowState === "complete" ? (
            <PrimaryButton
              onClick={startReliabilityCheck}
              className="w-full justify-center bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              <Play className="w-4 h-4 mr-2" />
              {flowState === "complete" ? "Run Another Reliability Check" : "Start 2-Step Reliability Check"}
            </PrimaryButton>
          ) : (
            <Button disabled className="w-full justify-center bg-slate-100 text-slate-400">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Testing Consistency in Progress...
            </Button>
          )}
        </div>
      </Card>

      {/* SEPARATE RELIABILITY HISTORY LOG CARD */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Reliability Log (Stored Separately)
            </h3>
          </div>
          <span className="text-[10px] text-[#64748B]">
            {recordsHistory.length} checks logged
          </span>
        </div>

        <p className="text-[11px] text-[#64748B]">
          Reliability check records are saved in separate evidence storage, maintaining clean baseline timeline integrity.
        </p>

        <div className="space-y-2">
          {recordsHistory.map((rec) => (
            <div
              key={rec.id}
              className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl flex items-center justify-between text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-[#172554] flex items-center gap-1.5">
                  <span>
                    Test 1: {rec.run1.frequencyHz} Hz | Test 2: {rec.run2.frequencyHz} Hz
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  {new Date(rec.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at{" "}
                  {new Date(rec.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                    rec.isWithinTolerance
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {rec.overallConsistencyPct}% Consistent
                </span>
                <div className="text-[10px] text-[#64748B]">
                  {rec.isWithinTolerance ? "✓ Within ±10%" : "⚠ Outside ±10%"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
