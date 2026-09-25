"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  Volume2,
  CheckCircle2,
  HelpCircle,
  ArrowLeft,
  Clock,
  Sparkles,
  Pill,
} from "lucide-react";

export default function SimpleModePage() {
  const router = useRouter();
  const { setIsSimpleMode, setIsFreezeModalOpen } = useAnalysis();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const taskText = "Take your morning dose with a glass of water.";
  const taskSubtext = "Next dose scheduled for 8:00 AM • Carbidopa/Levodopa";

  const handleSpeak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        `What is next. ${taskText}. ${taskSubtext}`
      );
      utterance.rate = 0.9;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setFeedback("Audio playback ready");
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleDone = () => {
    setTaskDone(true);
    setFeedback("Great job! Task marked as completed.");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Great job! Task marked as done.");
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleNeedHelp = () => {
    setIsFreezeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172554] p-4 sm:p-8 flex flex-col justify-between max-w-xl mx-auto space-y-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setIsSimpleMode(false);
            router.push("/today");
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[#E2E8F0] text-base font-semibold text-[#172554] hover:bg-slate-50 min-h-[48px] cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-5 h-5 text-[#2563EB]" />
          <span>Exit Simple Mode</span>
        </button>

        <span className="text-xs font-bold uppercase tracking-wider bg-[#EFF6FF] text-[#2563EB] px-3.5 py-1.5 rounded-full border border-[#BFDBFE]">
          Simple Mode Active
        </span>
      </div>

      {/* Main Single Task Card with Oversized Type */}
      <div className="space-y-6 flex-1 flex flex-col justify-center">
        {feedback && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-3xl text-lg font-bold text-center animate-in fade-in">
            {feedback}
          </div>
        )}

        <div className="bg-white rounded-[28px] border-[0.5px] border-[#E2E8F0] shadow-lg p-6 sm:p-8 space-y-6 text-left">
          <div className="flex items-center gap-3 text-[#2563EB]">
            <div className="p-3 bg-[#EFF6FF] rounded-2xl">
              <Pill className="w-8 h-8" />
            </div>
            <span className="text-sm sm:text-base font-bold uppercase tracking-widest text-[#2563EB]">
              What&apos;s Next
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#172554] leading-tight tracking-tight">
              {taskDone ? "✓ Morning Dose Completed" : taskText}
            </h1>
            <p className="text-lg sm:text-xl text-[#64748B] font-normal leading-snug">
              {taskSubtext}
            </p>
          </div>

          {/* Tap to hear aloud row */}
          <button
            onClick={handleSpeak}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer min-h-[56px] ${
              isSpeaking
                ? "bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]"
                : "bg-slate-50 border-slate-200 text-[#172554] hover:bg-slate-100"
            }`}
            aria-label="Tap to hear this aloud"
          >
            <div className="flex items-center gap-3">
              <Volume2 className={`w-6 h-6 ${isSpeaking ? "animate-bounce text-[#2563EB]" : "text-[#64748B]"}`} />
              <span className="text-base sm:text-lg font-semibold">
                {isSpeaking ? "Reading aloud now..." : "Tap to hear this aloud"}
              </span>
            </div>
            <span className="text-sm font-medium text-[#2563EB]">🔊 Listen</span>
          </button>
        </div>
      </div>

      {/* Two Giant Buttons (Done / Need Help) with 22px+ font size and 64px+ height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        {/* Giant Done Button */}
        <button
          onClick={handleDone}
          className="min-h-[64px] sm:min-h-[72px] px-6 py-4 rounded-[24px] bg-[#10B981] hover:bg-emerald-600 text-white font-medium text-[22px] sm:text-[24px] shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          <span>Done</span>
        </button>

        {/* Giant Need Help Button */}
        <button
          onClick={handleNeedHelp}
          className="min-h-[64px] sm:min-h-[72px] px-6 py-4 rounded-[24px] bg-[#F59E0B] hover:bg-amber-600 text-white font-medium text-[22px] sm:text-[24px] shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <HelpCircle className="w-8 h-8 stroke-[2.5]" />
          <span>Need help</span>
        </button>
      </div>
    </div>
  );
}
