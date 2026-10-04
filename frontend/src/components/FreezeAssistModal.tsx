"use client";

import React, { useState, useEffect } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { getActiveCue, CueResult } from "@/lib/cues";
import { reportFreezeAssist } from "@/lib/guardian";
import { VisualPulse } from "@/components/VisualPulse";
import { CueLabIcon } from "@/components/icons/CueLabIcon";
import {
  ShieldAlert,
  Footprints,
  ArrowRightLeft,
  Flame,
  Binary,
  CheckCircle2,
  Volume2,
  Smartphone,
  Eye,
  Sparkles,
  BellRing,
} from "lucide-react";

interface FreezeAssistModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const FreezeAssistModal: React.FC<FreezeAssistModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const { isFreezeModalOpen, setIsFreezeModalOpen, isDemoMode } = useAnalysis();

  const isOpen = propIsOpen !== undefined ? propIsOpen : isFreezeModalOpen;
  const handleClose = () => {
    if (propOnClose) propOnClose();
    setIsFreezeModalOpen(false);
  };

  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);
  const [notifyState, setNotifyState] = useState<
    "idle" | "busy" | "sent" | "already" | "failed"
  >("idle");

  // Explicit, user-initiated guardian notification (never sent automatically -
  // merely opening Freeze Assist must not raise an alert).
  const handleNotifyGuardian = async () => {
    if (notifyState === "busy" || notifyState === "sent" || notifyState === "already") return;
    setNotifyState("busy");
    const result = await reportFreezeAssist({
      notes: "Patient explicitly requested guardian notification from Freeze Assist.",
    });
    if (!result) {
      setNotifyState("failed");
      return;
    }
    setNotifyState(result.created ? "sent" : "already");
  };

  const {
    isPlaying,
    beatCount,
    beatInBar,
    start: startCue,
    stop: stopCue,
  } = useCueEngine();

  useEffect(() => {
    if (isOpen) {
      const cue = getActiveCue(isDemoMode);
      setActiveCueState(cue);
      const cueType: CueType = cue?.type || "audio";
      const cueBpm = cue?.bpm || 88;
      startCue(cueType, cueBpm);
    } else {
      stopCue();
      setNotifyState("idle");
    }
    return () => {
      stopCue();
    };
  }, [isOpen, isDemoMode]);

  if (!isOpen) return null;

  const currentType: CueType = activeCue?.type || "audio";
  const currentBpm = activeCue?.bpm || 88;

  const tricks = [
    {
      num: 1,
      title: "Step Over a Line",
      desc: "Visualize a bright line across the floor and take one decisive step directly over it.",
      icon: <Footprints className="w-5 h-5 text-[#60A5FA]" />,
    },
    {
      num: 2,
      title: "Shift Weight Side to Side",
      desc: "Gently rock your body weight left to right to unlock your motor rhythm.",
      icon: <ArrowRightLeft className="w-5 h-5 text-[#A78BFA]" />,
    },
    {
      num: 3,
      title: "March in Place",
      desc: "Lift knees high one at a time, landing firmly with the rhythmic beat.",
      icon: <Flame className="w-5 h-5 text-[#34D399]" />,
    },
    {
      num: 4,
      title: "Count 1 - 2 - 3 Out Loud",
      desc: "Speak the tempo loudly: 'One, Two, Three, STEP!' to cue your motor cortex.",
      icon: <Binary className="w-5 h-5 text-[#FBBF24]" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="freeze-assist-title"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0B0F19] text-white p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Top Bar with Emergency Status */}
      <div className="max-w-md mx-auto w-full pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#EF4444] text-white animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 id="freeze-assist-title" className="text-xl font-bold text-white tracking-tight">
                Freeze Assist Active
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <CueLabIcon size={16} isPlaying={isPlaying} />
                <span>Using your saved cue:</span>
                <span className="text-blue-300 font-medium capitalize">{currentType} ({currentBpm} BPM)</span>
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#EF4444]/20 border border-[#EF4444] text-[#FCA5A5] text-xs font-semibold">
            Emergency
          </span>
        </div>

        {/* Pulsing Cue Indicator Component */}
        <div className="my-6 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center space-y-2 shadow-2xl">
          <VisualPulse
            beatCount={beatCount}
            beatInBar={beatInBar}
            isPlaying={isPlaying}
            size="lg"
          />
          <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5 pt-1">
            {currentType === "audio" && <Volume2 className="w-4 h-4 text-blue-400" />}
            {currentType === "vibration" && <Smartphone className="w-4 h-4 text-purple-400" />}
            {currentType === "visual" && <Eye className="w-4 h-4 text-cyan-400" />}
            <span>Sync your steps to the {currentBpm} BPM rhythm</span>
          </div>
        </div>

        {/* Numbered Trick Cards */}
        <div className="space-y-3 mb-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">
            4 Unfreezing Strategies
          </h2>
          <div className="grid gap-2.5">
            {tricks.map((trick) => (
              <div
                key={trick.num}
                className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-blue-400 text-xs font-bold shrink-0 mt-0.5 border border-slate-700">
                  {trick.num}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white flex items-center justify-between">
                    <span>{trick.title}</span>
                    <span className="shrink-0 ml-2">{trick.icon}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-snug font-normal">
                    {trick.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Dismiss Button — Large White "I'm okay now" button */}
      <div className="max-w-md mx-auto w-full pb-4 pt-2 space-y-3">
        {/* Explicit, opt-in guardian notification (awareness only) */}
        <button
          type="button"
          onClick={() => void handleNotifyGuardian()}
          disabled={
            notifyState === "busy" || notifyState === "sent" || notifyState === "already"
          }
          className={`w-full min-h-[52px] py-3.5 px-5 rounded-2xl font-semibold text-sm border transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.99] disabled:cursor-not-allowed ${
            notifyState === "sent" || notifyState === "already"
              ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
              : notifyState === "failed"
                ? "bg-red-950/60 border-red-700 text-red-300"
                : "bg-transparent border-[#334155] text-slate-200 hover:bg-slate-900"
          }`}
        >
          <BellRing className="w-5 h-5 shrink-0" />
          <span>
            {notifyState === "busy"
              ? "Notifying your guardian…"
              : notifyState === "sent"
                ? "Guardian notified — stay with the cues"
                : notifyState === "already"
                  ? "A guardian alert is already open"
                  : notifyState === "failed"
                    ? "Could not notify — tap to retry"
                    : "Notify my guardian"}
          </span>
        </button>

        <button
          onClick={handleClose}
          className="w-full min-h-[56px] py-4 px-6 bg-white hover:bg-slate-100 text-[#172554] font-semibold text-lg rounded-2xl shadow-xl active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
          <span>I&apos;m okay now</span>
        </button>
      </div>
    </div>
  );
};
