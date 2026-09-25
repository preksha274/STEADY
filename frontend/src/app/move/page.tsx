"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { getActiveCue, CueResult } from "@/lib/cues";
import { VisualPulse } from "@/components/VisualPulse";
import {
  Activity,
  Play,
  Pause,
  Square,
  Sparkles,
  Volume2,
  Eye,
  Smartphone,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Camera,
  Flame,
  Award,
} from "lucide-react";

export default function MoveCoachPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [repCount, setRepCount] = useState(12);
  const [syncScore, setSyncScore] = useState(94);
  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);

  // Live coaching prompt rotation
  const [coachPrompt, setCoachPrompt] = useState("Bigger reach! Keep your arms high.");
  const [feedbackHistory, setFeedbackHistory] = useState<string[]>([
    "Bigger reach! Keep your arms high.",
    "Great stride rhythm!",
    "Lift that knee slightly higher.",
  ]);

  const {
    isPlaying,
    beatCount,
    beatInBar,
    start: startCue,
    stop: stopCue,
  } = useCueEngine();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cue = getActiveCue();
    setActiveCueState(cue);
  }, []);

  const currentType: CueType = activeCue?.type || "audio";
  const currentBpm = activeCue?.bpm || 88;

  // Start webcam if supported, fallback to animated skeleton landmark overlay
  const enableCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      }
    } catch (e) {
      console.log("Webcam not accessible, using landmark skeleton preview", e);
    }
  };

  const handleStartSession = async () => {
    setIsSessionActive(true);
    setIsPaused(false);
    startCue(currentType, currentBpm);
    await enableCamera();
  };

  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      startCue(currentType, currentBpm);
    } else {
      setIsPaused(true);
      stopCue();
    }
  };

  const handleEndSession = () => {
    stopCue();
    setIsSessionActive(false);
    setIsPaused(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  // Session duration timer & live coaching prompt generator
  useEffect(() => {
    if (!isSessionActive || isPaused) return;

    const timer = setInterval(() => {
      setSessionSeconds((s) => s + 1);

      // Increment reps periodically
      if (Math.random() > 0.6) {
        setRepCount((r) => r + 1);
      }

      // Rotate coaching prompts
      const prompts = [
        "Bigger reach! Keep arms high.",
        "Smooth rhythm — excellent step height!",
        "Drive through your heels on each beat.",
        "Keep shoulders relaxed and posture tall.",
        "Great cadence match! Keep going.",
      ];
      if (Math.random() > 0.7) {
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        setCoachPrompt(randomPrompt);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionActive, isPaused]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading Move Coach...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 flex flex-col justify-between max-w-md mx-auto space-y-4 text-left">
      {/* Top Header Controls (Dark Theme) */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (isSessionActive) handleEndSession();
              router.push("/today");
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Back to Today"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Move Coach</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                Core 5
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Synced to {currentBpm} BPM {currentType} cue
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
            Time
          </span>
          <span className="text-lg font-black text-blue-400 font-mono">
            {formatTime(sessionSeconds)}
          </span>
        </div>
      </header>

      {/* LIVE CAMERA & POSE-LANDMARK OVERLAY AREA */}
      <div className="relative rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden min-h-[260px] sm:min-h-[300px] flex items-center justify-center shadow-2xl">
        {/* Real video if camera active */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
            cameraActive ? "opacity-70" : "hidden"
          }`}
        />

        {/* Pose Landmark Skeleton Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-48 h-64 text-[#2563EB]/80 animate-pulse" viewBox="0 0 100 140" fill="none">
            {/* Head */}
            <circle cx="50" cy="20" r="10" stroke="#60A5FA" strokeWidth="2.5" fill="#2563EB" fillOpacity="0.3" />
            {/* Spine */}
            <line x1="50" y1="30" x2="50" y2="80" stroke="#60A5FA" strokeWidth="3" />
            {/* Shoulders */}
            <line x1="25" y1="42" x2="75" y2="42" stroke="#60A5FA" strokeWidth="3" />
            {/* Arms */}
            <line x1="25" y1="42" x2="15" y2="70" stroke="#38BDF8" strokeWidth="2.5" />
            <line x1="75" y1="42" x2="85" y2="70" stroke="#38BDF8" strokeWidth="2.5" />
            {/* Joint dots */}
            <circle cx="25" cy="42" r="3.5" fill="#38BDF8" />
            <circle cx="75" cy="42" r="3.5" fill="#38BDF8" />
            <circle cx="15" cy="70" r="3.5" fill="#38BDF8" />
            <circle cx="85" cy="70" r="3.5" fill="#38BDF8" />
            {/* Pelvis & Legs */}
            <line x1="50" y1="80" x2="32" y2="125" stroke="#34D399" strokeWidth="3" />
            <line x1="50" y1="80" x2="68" y2="125" stroke="#34D399" strokeWidth="3" />
            <circle cx="32" cy="125" r="3.5" fill="#34D399" />
            <circle cx="68" cy="125" r="3.5" fill="#34D399" />
          </svg>
        </div>

        {/* Visual Pulse in corner */}
        {isSessionActive && !isPaused && (
          <div className="absolute top-3 right-3 p-2 bg-slate-900/80 rounded-2xl border border-slate-700 backdrop-blur-md">
            <VisualPulse beatCount={beatCount} beatInBar={beatInBar} isPlaying={true} size="sm" />
          </div>
        )}

        {/* Live Cue badge */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-slate-900/80 rounded-full border border-slate-700 text-xs text-blue-300 font-semibold backdrop-blur-md flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{currentBpm} BPM Pacing</span>
        </div>

        {!isSessionActive && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Position Your Camera</h2>
              <p className="text-xs text-slate-300 max-w-xs mt-1">
                Stand so your full upper body or walking space is visible in the frame.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* LIVE COACHING PROMPT TEXT ("Bigger reach!") */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/40 text-center shadow-lg space-y-1">
        <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider block">
          Live Coaching Prompt
        </span>
        <div className="text-lg font-bold text-white">
          &quot;{isSessionActive ? coachPrompt : "Press Start to begin guided reach & stride exercise."}&quot;
        </div>
      </div>

      {/* REP COUNTER + BEAT STAT CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Rep Counter Card */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-1 shadow-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Reps Completed
          </span>
          <div className="text-3xl font-black text-white">
            {repCount}
          </div>
          <span className="text-[10px] text-emerald-400 font-medium block">
            Target: 20 reps
          </span>
        </div>

        {/* Beat Sync Stat Card */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-1 shadow-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Beat Synchronization
          </span>
          <div className="text-3xl font-black text-blue-400">
            {syncScore}%
          </div>
          <span className="text-[10px] text-blue-300 font-medium block">
            Optimal entrainment
          </span>
        </div>
      </div>

      {/* PAUSE / END / START CONTROLS (≥ 48PX TARGETS) */}
      <div className="space-y-2 pt-2">
        {!isSessionActive ? (
          <button
            onClick={handleStartSession}
            className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-brand-gradient text-white font-medium text-base shadow-lg hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>Start Micro-Session ({currentBpm} BPM)</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleTogglePause}
              className="min-h-[52px] py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
              <span>{isPaused ? "Resume Drill" : "Pause"}</span>
            </button>

            <button
              onClick={handleEndSession}
              className="min-h-[52px] py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>End Session</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
