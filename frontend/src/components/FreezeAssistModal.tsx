"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { getActiveCue, CueResult, getCuePolicyState } from "@/lib/cues";
import { reportFreezeAssist } from "@/lib/guardian";
import { logFreezeEpisode } from "@/lib/freezeEpisodes";
import { FOG_PROTOTYPE_DISCLAIMER } from "@/lib/freezeDetection";
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
  VolumeX,
  Smartphone,
  Eye,
  Sparkles,
  BellRing,
  XCircle,
  Zap,
  Pause,
} from "lucide-react";

interface FreezeAssistModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const FreezeAssistModal: React.FC<FreezeAssistModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const {
    isFreezeModalOpen,
    setIsFreezeModalOpen,
    freezeTriggerSource,
    freezeTriggerIndex,
    openFreezeModal,
    closeFreezeModal,
    isDemoMode,
  } = useAnalysis();

  const isOpen = propIsOpen !== undefined ? propIsOpen : isFreezeModalOpen;

  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);
  const [isAbstaining, setIsAbstaining] = useState<boolean>(false);
  const [isCueMuted, setIsCueMuted] = useState<boolean>(false);
  const [notifyState, setNotifyState] = useState<
    "idle" | "busy" | "sent" | "already" | "failed"
  >("idle");

  const loggedEpisodeRef = useRef<boolean>(false);

  const {
    isPlaying,
    beatCount,
    beatInBar,
    start: startCue,
    stop: stopCue,
  } = useCueEngine();

  useEffect(() => {
    if (isOpen) {
      const policy = getCuePolicyState(isDemoMode);
      const cue = activeCue || getActiveCue(isDemoMode);
      setActiveCueState(cue);
      const cueType: CueType = cue?.type || "audio";
      const cueBpm = cue?.bpm || 88;

      // Policy decision: If policy action is "abstain", default to abstaining state
      if (policy.action === "abstain") {
        setIsAbstaining(true);
        stopCue();
      } else {
        setIsAbstaining(false);
        setIsCueMuted(false);
        startCue(cueType, cueBpm);
      }

      // Log the episode with source distinction ('auto-detected' | 'manual')
      if (!loggedEpisodeRef.current) {
        loggedEpisodeRef.current = true;
        logFreezeEpisode({
          source: freezeTriggerSource || "manual",
          freezeIndex: freezeTriggerIndex || 2.8,
          cueType,
          cueBpm,
          isFalseAlarm: false,
        });
      }
    } else {
      stopCue();
      setNotifyState("idle");
      setIsCueMuted(false);
      loggedEpisodeRef.current = false;
    }
    return () => {
      stopCue();
    };
  }, [isOpen, isDemoMode, freezeTriggerSource, freezeTriggerIndex, startCue, stopCue]);

  const handleClose = (isFalseAlarm: boolean = false) => {
    stopCue();
    if (isFalseAlarm) {
      logFreezeEpisode({
        source: "auto-detected",
        freezeIndex: freezeTriggerIndex || 2.8,
        cueType: activeCue?.type || "audio",
        cueBpm: activeCue?.bpm || 88,
        isFalseAlarm: true,
      });
    }
    if (propOnClose) propOnClose();
    closeFreezeModal();
  };

  const handleNotifyGuardian = async () => {
    if (notifyState === "busy" || notifyState === "sent" || notifyState === "already") return;
    setNotifyState("busy");
    const result = await reportFreezeAssist({
      notes:
        freezeTriggerSource === "auto-detected"
          ? "Sensor auto-detected possible Freezing of Gait episode."
          : "Patient explicitly requested guardian notification from Freeze Assist.",
    });
    if (!result) {
      setNotifyState("failed");
      return;
    }
    setNotifyState(result.created ? "sent" : "already");
  };

  if (!isOpen) return null;

  const currentType: CueType = activeCue?.type || "audio";
  const currentBpm = activeCue?.bpm || 88;
  const isAutoDetected = freezeTriggerSource === "auto-detected";

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
      {/* Top Bar with Status & Auto-Detection Distinction Header */}
      <div className="max-w-md mx-auto w-full pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl text-white animate-pulse ${
              isAutoDetected ? "bg-amber-500" : "bg-[#EF4444]"
            }`}>
              {isAutoDetected ? <Zap className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <h1 id="freeze-assist-title" className="text-xl font-bold text-white tracking-tight">
                {isAutoDetected ? "Possible Freeze (Experimental)" : "Freeze Assist Active"}
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <CueLabIcon size={16} isPlaying={isPlaying} />
                <span>Playing active cue:</span>
                <span className="text-blue-300 font-medium capitalize">{currentType} ({currentBpm} BPM)</span>
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isAutoDetected
              ? "bg-amber-500/20 border border-amber-500 text-amber-300"
              : "bg-[#EF4444]/20 border border-[#EF4444] text-[#FCA5A5]"
          }`}>
            {isAutoDetected ? "Wrist (Experimental)" : "Self-Reported"}
          </span>
        </div>

        {/* Auto-Detection Bachlin Freeze Index Sub-banner */}
        {isAutoDetected && (
          <div className="mt-3 p-3 bg-amber-950/70 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Sustained Bachlin Freeze Index: <strong>{freezeTriggerIndex?.toFixed(2) || "3.12"}</strong> (≥ 2.5)</span>
            </div>
            <span className="text-[10px] bg-amber-900 px-2 py-0.5 rounded-full text-amber-300 font-bold">
              Auto-Triggered
            </span>
          </div>
        )}

        {/* ABSTAINING POLICY STATE CARD */}
        {isAbstaining ? (
          <div className="my-4 p-4 rounded-3xl bg-slate-900 border border-slate-700 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Pause className="w-4 h-4" />
                <span>Policy Option: Don&apos;t Cue Right Now</span>
              </div>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full font-bold">
                Abstain Mode
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Recent data suggests rhythm cueing hasn&apos;t been effective or was recently dismissed. Policy recommends logging this episode quietly without blasting metronome audio.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAbstaining(false);
                  startCue("vibration", currentBpm);
                }}
                className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 text-xs font-bold border border-purple-700 transition"
              >
                Try Vibration Modality
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAbstaining(false);
                  startCue("audio", currentBpm);
                }}
                className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 transition"
              >
                Start Audio Cue Anyway
              </button>
            </div>
          </div>
        ) : (
          /* Pulsing Cue Indicator Component (Reused Cue Engine) */
          <div className="my-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center space-y-2.5 shadow-2xl">
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

            {/* FAST 1-TAP PATIENT OVERRIDE BUTTON */}
            {isPlaying && (
              <button
                type="button"
                onClick={() => {
                  stopCue();
                  setIsCueMuted(true);
                }}
                className="mt-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-lg cursor-pointer min-h-[44px] active:scale-95"
                aria-label="Cancel cueing immediately"
              >
                <VolumeX className="w-4 h-4 text-white" />
                <span>Mute / Cancel Cue (1-Tap Override)</span>
              </button>
            )}

            {isCueMuted && !isPlaying && (
              <div className="text-xs text-amber-300 font-semibold bg-amber-950/80 px-3 py-1 rounded-full border border-amber-800">
                Cue muted by patient override
              </div>
            )}
          </div>
        )}

        {/* Numbered Trick Cards */}
        <div className="space-y-3 mb-4">
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

      {/* Bottom Dismiss & Actions Block */}
      <div className="max-w-md mx-auto w-full pb-4 pt-2 space-y-2.5">
        {/* REQUIREMENT 4: "False alarm — I wasn't frozen" option on auto-triggered modal */}
        {isAutoDetected && (
          <button
            type="button"
            onClick={() => handleClose(true)}
            className="w-full min-h-[48px] py-3 px-4 rounded-2xl font-semibold text-xs bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>False alarm — I wasn&apos;t frozen</span>
          </button>
        )}

        {/* Guardian Notification Option */}
        <button
          type="button"
          onClick={() => void handleNotifyGuardian()}
          disabled={
            notifyState === "busy" || notifyState === "sent" || notifyState === "already"
          }
          className={`w-full min-h-[48px] py-3 px-4 rounded-2xl font-semibold text-xs border transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.99] disabled:cursor-not-allowed ${
            notifyState === "sent" || notifyState === "already"
              ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
              : notifyState === "failed"
                ? "bg-red-950/60 border-red-700 text-red-300"
                : "bg-transparent border-[#334155] text-slate-300 hover:bg-slate-900"
          }`}
        >
          <BellRing className="w-4 h-4 shrink-0" />
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

        {/* Main Dismiss Button: "I'm okay now" */}
        <button
          onClick={() => handleClose(false)}
          className="w-full min-h-[54px] py-3.5 px-6 bg-white hover:bg-slate-100 text-[#172554] font-semibold text-base rounded-2xl shadow-xl active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          <span>I&apos;m okay now</span>
        </button>

        {/* REQUIREMENT 5: "Simulate freeze detection" Dev-Only Button */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              openFreezeModal("auto-detected", { freezeIndex: 3.25 });
            }}
            className="text-[11px] text-amber-400/90 hover:text-amber-300 font-mono underline cursor-pointer inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Simulate freeze detection (Dev)</span>
          </button>
        </div>

        {/* Prototype Disclaimer Label */}
        <p className="text-[10px] text-slate-400 text-center leading-tight pt-1">
          {FOG_PROTOTYPE_DISCLAIMER}
        </p>
      </div>
    </div>
  );
};
