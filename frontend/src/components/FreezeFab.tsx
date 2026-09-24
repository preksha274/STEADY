"use client";

import React, { useState, useEffect } from "react";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { getActiveCue, CueResult } from "@/lib/cues";
import { VisualPulse } from "@/components/VisualPulse";
import { Button } from "./Button";
import {
  ShieldAlert,
  X,
  Volume2,
  Smartphone,
  Eye,
  Footprints,
  ArrowRightLeft,
  Flame,
  Binary,
  CheckCircle2,
} from "lucide-react";

export const FreezeFab: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);

  const {
    isPlaying,
    beatCount,
    beatInBar,
    start: startCue,
    stop: stopCue,
  } = useCueEngine();

  // Load active cue when modal opens
  useEffect(() => {
    if (isOpen) {
      const cue = getActiveCue();
      setActiveCueState(cue);
      // Auto start active cue (or default audio 88 BPM if none)
      const cueType: CueType = cue?.type || "audio";
      const cueBpm = cue?.bpm || 88;
      startCue(cueType, cueBpm);
    } else {
      stopCue();
    }
  }, [isOpen]);

  const handleStopAndClose = () => {
    stopCue();
    setIsOpen(false);
  };

  const currentType: CueType = activeCue?.type || "audio";
  const currentBpm = activeCue?.bpm || 88;

  const tricks = [
    {
      title: "Step Over Imaginary Line",
      desc: "Visualize a line on the ground and take a big step directly over it.",
      icon: <Footprints className="w-5 h-5 text-blue-600" />,
    },
    {
      title: "Shift Weight Side to Side",
      desc: "Gently rock your weight left to right to restart your motor rhythm.",
      icon: <ArrowRightLeft className="w-5 h-5 text-indigo-600" />,
    },
    {
      title: "March in Place",
      desc: "Lift knees high one at a time in sync with the beat.",
      icon: <Flame className="w-5 h-5 text-emerald-600" />,
    },
    {
      title: "Count 1 - 2 - 3 Out Loud",
      desc: "Speak the rhythm out loud: One, Two, Three, STEP!",
      icon: <Binary className="w-5 h-5 text-amber-600" />,
    },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 sm:right-6 z-40 flex items-center gap-2 px-4 py-3 bg-[#EF4444] hover:bg-red-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 border-2 border-white ring-4 ring-red-100"
        aria-label="I'm Frozen emergency assistance"
      >
        <ShieldAlert className="w-5 h-5 animate-pulse" />
        <span className="text-sm tracking-wide">I&apos;m Frozen</span>
      </button>

      {/* Emergency Freeze Assist Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={handleStopAndClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-3 mb-4 text-[#EF4444]">
              <div className="p-3 bg-red-50 rounded-2xl">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#172554]">Freeze Assist</h3>
                <p className="text-xs text-[#64748B]">Active Cue: <span className="font-bold text-slate-800 capitalize">{currentType} ({currentBpm} BPM)</span></p>
              </div>
            </div>

            {/* Visual Pulse Component */}
            <div className="mb-6 flex justify-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <VisualPulse
                beatCount={beatCount}
                beatInBar={beatInBar}
                isPlaying={isPlaying}
                size="md"
              />
            </div>

            {/* 4 Unfreezing Trick Cards */}
            <div className="mb-6 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Unfreezing Strategies
              </h4>
              {tricks.map((trick, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 transition-colors"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                    {trick.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{trick.title}</div>
                    <div className="text-[11px] text-slate-600 leading-snug">{trick.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* I'm Moving Again Primary Action Button */}
            <div className="space-y-2">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleStopAndClose}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 font-bold"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                I&apos;m Moving Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
