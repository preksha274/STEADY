"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCueEngine, CueType } from "@/lib/cueEngine";
import { getActiveCue, CueResult } from "@/lib/cues";
import { VisualPulse } from "@/components/VisualPulse";
import { voiceGuide } from "@/lib/voiceGuide";
import {
  getTodaySessionPlan,
  TodaySessionPlan,
  PlannedExercise,
  EXERCISE_CATALOG,
} from "@/lib/routinePlanner";
import {
  Activity,
  Play,
  Pause,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  Eye,
  Smartphone,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Camera,
  Flame,
  Award,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  Mic,
  MicOff,
  AlertTriangle,
  Info,
  Video,
  VideoOff,
} from "lucide-react";

export default function MoveCoachPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Today's Generated Session Plan & Selected Exercise
  const [todayPlan, setTodayPlan] = useState<TodaySessionPlan | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<PlannedExercise>(
    EXERCISE_CATALOG["big_reach"]
  );
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  // Workout state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [syncScore, setSyncScore] = useState(88);
  const [movementStatus, setMovementStatus] = useState<"idle" | "moving" | "waiting">("idle");
  const [activeInputSource, setActiveInputSource] = useState<"Camera" | "Motion Sensor" | "Sensor Ready">("Sensor Ready");
  const [targetReps, setTargetReps] = useState(15);
  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);

  // Voice Assistant & Hands-free state
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(true);

  // Hard Stop & Fatigue states
  const [isHardStopped, setIsHardStopped] = useState(false);
  const [stopReason, setStopReason] = useState<"target_reached" | "fatigue_shrink" | null>(null);
  const [stopMessage, setStopMessage] = useState("");
  const [showBonusConfirm, setShowBonusConfirm] = useState(false);

  // Live coaching prompt rotation
  const [coachPrompt, setCoachPrompt] = useState("Bigger reach! Keep your arms high.");
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>([1.0, 1.0, 0.95]);

  // Dynamic Joint Animation Phase Timer (locked to pacing tempo)
  const [animTime, setAnimTime] = useState(0);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Genuine motion tracking & Rhythm entrainment refs
  const sessionStartTimeRef = useRef<number>(0);
  const lastPeakTimeRef = useRef<number>(0);
  const prevAccelMagRef = useRef<number>(1.0);
  const lastMovementTimeRef = useRef<number>(0);
  const beatScoresRef = useRef<number[]>([88, 92, 85]);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const prevFrameEnergyRef = useRef<number>(0);
  const lastCameraPeakTimeRef = useRef<number>(0);

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

    // Generate rule-based plan
    const plan = getTodaySessionPlan();
    setTodayPlan(plan);
    if (plan.selectedExercises.length > 0) {
      setSelectedExercise(plan.selectedExercises[0]);
      setTargetReps(plan.targetRepsPerExercise);
    }
  }, []);

  const currentType: CueType = todayPlan?.pacingCueType || activeCue?.type || "audio";
  const currentBpm = todayPlan?.pacingTempoBpm || activeCue?.bpm || 88;

  // Handler for genuine detected movement peak (from DeviceMotion or Camera Frame Energy)
  const registerMovementPeak = (peakMagnitude: number, timestamp: number) => {
    if (!isSessionActive || isPaused || isHardStopped) return;

    const beatIntervalMs = (60 / currentBpm) * 1000;
    lastMovementTimeRef.current = timestamp;
    setMovementStatus("moving");

    // Phase Offset to nearest beat calculation:
    const elapsedSinceStart = timestamp - sessionStartTimeRef.current;
    const beatOffset = elapsedSinceStart % beatIntervalMs;
    const distToNearestBeat = Math.min(beatOffset, beatIntervalMs - beatOffset);
    const maxHalfWindow = beatIntervalMs / 2;

    // Entrainment score: 100% for perfect on-beat synchronization, decaying as offset increases
    const timingAccuracy = Math.max(0, 1.0 - distToNearestBeat / maxHalfWindow);
    const instantaneousSync = Math.round(timingAccuracy * 100);

    beatScoresRef.current.push(instantaneousSync);
    if (beatScoresRef.current.length > 8) {
      beatScoresRef.current.shift();
    }

    // Update running average Rhythm Entrainment %
    const avgSync = Math.round(
      beatScoresRef.current.reduce((a, b) => a + b, 0) / beatScoresRef.current.length
    );
    setSyncScore(avgSync);

    // Increment rep count strictly on genuine peak
    setRepCount((prev) => {
      const nextRep = prev + 1;

      // Announce milestone reps via voice
      if (voiceAssistantEnabled && nextRep % 5 === 0 && nextRep < targetReps) {
        voiceGuide.speak(`${nextRep} reps. Keep it steady.`);
      }

      // HARD STOP 1: Target reached
      if (nextRep >= targetReps) {
        triggerHardStop("target_reached");
      }
      return nextRep;
    });

    // Amplitude tracking for real fatigue shrink check
    setAmplitudeHistory((prev) => {
      const normalizedAmp = Math.min(1.2, Math.max(0.4, peakMagnitude / 2.5));
      const updated = [...prev, normalizedAmp].slice(-4);

      // HARD STOP 2: Fatigue shrink > 25% drop over consecutive reps
      if (updated.length >= 3) {
        const drop = (updated[0] - updated[updated.length - 1]) / updated[0];
        if (drop > 0.25 && repCount >= 6) {
          triggerHardStop("fatigue_shrink");
        }
      }
      return updated;
    });
  };

  // Real-time animation loop for continuous joint articulation
  useEffect(() => {
    if (!isSessionActive || isPaused || isHardStopped) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
      return;
    }

    const animateLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setAnimTime((prev) => prev + dt);
      animRef.current = requestAnimationFrame(animateLoop);
    };

    animRef.current = requestAnimationFrame(animateLoop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
    };
  }, [isSessionActive, isPaused, isHardStopped]);

  // Start webcam if supported, fallback to motion sensors
  const enableCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
          setActiveInputSource("Camera");
        }
      }
    } catch (e) {
      console.log("Webcam not accessible, using motion sensor detection", e);
      setCameraActive(false);
      setActiveInputSource("Motion Sensor");
    }
  };

  // DeviceMotion Event Listener for Real Accel/Gyro Peak Detection
  useEffect(() => {
    if (!isSessionActive || isPaused || isHardStopped || typeof window === "undefined") return;

    const handleMotionEvent = (event: DeviceMotionEvent) => {
      const accel = event.acceleration || event.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      setActiveInputSource("Motion Sensor");
      const rawMag = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
      const netMag = Math.abs(rawMag - 9.8);
      const now = Date.now();

      // Minimum peak interval based on pacing tempo (prevents multi-triggers per single rep)
      const minIntervalMs = Math.max(400, (60 / currentBpm) * 650);
      const isPeak =
        now - lastPeakTimeRef.current >= minIntervalMs &&
        netMag > 1.25 &&
        prevAccelMagRef.current <= 1.25;

      prevAccelMagRef.current = netMag;

      if (isPeak) {
        lastPeakTimeRef.current = now;
        registerMovementPeak(netMag, now);
      }
    };

    if ("DeviceMotionEvent" in window) {
      window.addEventListener("devicemotion", handleMotionEvent);
    }

    return () => {
      if ("DeviceMotionEvent" in window) {
        window.removeEventListener("devicemotion", handleMotionEvent);
      }
    };
  }, [isSessionActive, isPaused, isHardStopped, currentBpm]);

  // Camera Optical Frame Difference Peak Detector (when webcam is active)
  useEffect(() => {
    if (!isSessionActive || !cameraActive || isPaused || isHardStopped) return;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const frameInterval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        ctx.drawImage(videoRef.current, 0, 0, 32, 32);
        const frame = ctx.getImageData(0, 0, 32, 32);
        const data = frame.data;

        if (prevFrameDataRef.current) {
          let diffSum = 0;
          const prev = prevFrameDataRef.current;
          for (let i = 0; i < data.length; i += 4) {
            const curLuma = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const prevLuma = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
            diffSum += Math.abs(curLuma - prevLuma);
          }

          const motionEnergy = diffSum / (32 * 32);
          const now = Date.now();
          const minIntervalMs = Math.max(450, (60 / currentBpm) * 700);

          if (
            motionEnergy > 8.0 &&
            prevFrameEnergyRef.current <= 8.0 &&
            now - lastCameraPeakTimeRef.current >= minIntervalMs
          ) {
            lastCameraPeakTimeRef.current = now;
            registerMovementPeak(motionEnergy / 6, now);
          }
          prevFrameEnergyRef.current = motionEnergy;
        }

        prevFrameDataRef.current = new Uint8ClampedArray(data);
      } catch (err) {
        // Fallback gracefully on video capture exception
      }
    }, 80);

    return () => clearInterval(frameInterval);
  }, [isSessionActive, cameraActive, isPaused, isHardStopped, currentBpm]);

  // Per-Beat Rhythm Entrainment Decay & Stationary Idle Monitor
  useEffect(() => {
    if (!isSessionActive || isPaused || isHardStopped) return;

    const now = Date.now();
    const timeSinceLastMove = now - lastMovementTimeRef.current;
    const beatIntervalMs = (60 / currentBpm) * 1000;

    // If patient is not moving across beat intervals, degrade entrainment score
    if (timeSinceLastMove > beatIntervalMs * 1.5) {
      setMovementStatus("waiting");
      beatScoresRef.current.push(10); // 10% penalty score for idle beat
      if (beatScoresRef.current.length > 8) {
        beatScoresRef.current.shift();
      }
      const decayedSync = Math.round(
        beatScoresRef.current.reduce((a, b) => a + b, 0) / beatScoresRef.current.length
      );
      setSyncScore(Math.max(12, decayedSync));
    }
  }, [beatCount, isSessionActive, isPaused, isHardStopped, currentBpm]);

  // Start Session
  const handleStartSession = async () => {
    const now = Date.now();
    sessionStartTimeRef.current = now;
    lastPeakTimeRef.current = 0;
    lastMovementTimeRef.current = now;
    beatScoresRef.current = [88, 90, 86];

    setIsSessionActive(true);
    setIsPaused(false);
    setIsHardStopped(false);
    setStopReason(null);
    setRepCount(0);
    setSessionSeconds(0);
    setAnimTime(0);
    setSyncScore(88);
    setMovementStatus("waiting");
    setAmplitudeHistory([1.0, 1.0, 0.98]);

    startCue(currentType, currentBpm);
    await enableCamera();

    const startSpeech = `Starting ${selectedExercise.name}. Pacing at ${currentBpm} BPM. Target is ${targetReps} reps.`;
    setCoachPrompt(selectedExercise.prompts[0] || "Match the rhythmic beat.");
    if (voiceAssistantEnabled) {
      voiceGuide.speak(startSpeech);
    }

    startVoiceListener();
  };

  // Hands-free voice listener during session
  const startVoiceListener = () => {
    if (!voiceAssistantEnabled) return;
    voiceGuide.startListening((res) => {
      if (res.intent === "STOP_EXERCISE" || res.transcript.toLowerCase().includes("pause")) {
        handleTogglePause();
      } else if (res.transcript.toLowerCase().includes("resume")) {
        if (isPaused) handleTogglePause();
      } else if (res.intent === "FREEZE_ASSIST") {
        handleEndSession();
        window.dispatchEvent(new CustomEvent("trigger-freeze-assist"));
      }
    });
  };

  // Hard Stop Trigger Enforcement
  const triggerHardStop = (reason: "target_reached" | "fatigue_shrink") => {
    stopCue(); // IMMEDIATELY stop beat/tempo
    setIsSessionActive(false);
    setIsHardStopped(true);
    setStopReason(reason);

    const message =
      reason === "target_reached"
        ? "You're done for today — please stop. Great work hitting your target!"
        : "Let's stop here for today. Movement amplitude declined slightly — safe resting time.";

    setStopMessage(message);
    if (voiceAssistantEnabled) {
      voiceGuide.speak(message);
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      startCue(currentType, currentBpm);
      if (voiceAssistantEnabled) voiceGuide.speak("Resuming exercise.");
    } else {
      setIsPaused(true);
      stopCue();
      if (voiceAssistantEnabled) voiceGuide.speak("Exercise paused.");
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
    voiceGuide.stopSpeaking();
  };

  // Live Timer & Prompt rotation loop
  useEffect(() => {
    if (!isSessionActive || isPaused || isHardStopped) return;

    const timer = setInterval(() => {
      setSessionSeconds((s) => s + 1);

      // Rotate prompts periodically
      if (Math.random() > 0.8 && selectedExercise.prompts.length > 0) {
        const prompts = selectedExercise.prompts;
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        setCoachPrompt(randomPrompt);
        if (voiceAssistantEnabled && Math.random() > 0.7) {
          voiceGuide.speak(randomPrompt);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionActive, isPaused, isHardStopped, selectedExercise, voiceAssistantEnabled]);

  // Dynamic Joint Coordinate Generator (Synchronized to exact pacing cadence)
  const jointCoords = useMemo(() => {
    // Exact cycle frequency from Live Cue Designer winning tempo (e.g. 88 BPM)
    const freq = (currentBpm / 60) * 2 * Math.PI;
    const p = isSessionActive ? Math.sin(animTime * freq) : 0; // -1 to +1
    const u = (p + 1) / 2; // 0 to 1 smooth progress

    // Base landmark coordinates (neutral upright human proportions)
    let head = { x: 50, y: 22 };
    let neck = { x: 50, y: 32 };
    let spineBottom = { x: 50, y: 80 };
    let leftShoulder = { x: 25, y: 42 };
    let rightShoulder = { x: 75, y: 42 };
    let leftElbow = { x: 15, y: 68 };
    let rightElbow = { x: 85, y: 68 };
    let leftWrist = { x: 14, y: 95 };
    let rightWrist = { x: 86, y: 95 };
    let leftHip = { x: 38, y: 80 };
    let rightHip = { x: 62, y: 80 };
    let leftKnee = { x: 35, y: 106 };
    let rightKnee = { x: 65, y: 106 };
    let leftAnkle = { x: 32, y: 132 };
    let rightAnkle = { x: 68, y: 132 };

    const exId = selectedExercise?.id || "big_reach";

    if (exId === "big_reach") {
      // Arms sweep from hips all the way overhead in a wide V-extension
      leftElbow = { x: 15 - 6 * u, y: 68 - 42 * u };
      rightElbow = { x: 85 + 6 * u, y: 68 - 42 * u };
      leftWrist = { x: 14 - 10 * u, y: 95 - 84 * u }; // reaches up to y=11
      rightWrist = { x: 86 + 10 * u, y: 95 - 84 * u };
      head.y = 22 - 3 * u;
      neck.y = 32 - 2 * u;
    } else if (exId === "high_knees") {
      // Alternating high knee marching on each rhythmic beat with contralateral arm swing
      const leftLift = Math.max(0, p);
      const rightLift = Math.max(0, -p);

      leftKnee = { x: 35 - 4 * leftLift, y: 106 - 24 * leftLift };
      leftAnkle = { x: 32, y: 132 - 28 * leftLift };
      rightKnee = { x: 65 + 4 * rightLift, y: 106 - 24 * rightLift };
      rightAnkle = { x: 68, y: 132 - 28 * rightLift };

      leftElbow.y = 68 - 22 * rightLift + 10 * leftLift;
      leftWrist.y = 95 - 32 * rightLift + 10 * leftLift;
      rightElbow.y = 68 - 22 * leftLift + 10 * rightLift;
      rightWrist.y = 95 - 32 * leftLift + 10 * rightLift;
    } else if (exId === "torso_twist") {
      // Axial spine rotation side to side
      const rot = p * 12;
      leftShoulder.x = 25 + rot;
      rightShoulder.x = 75 + rot;
      leftElbow.x = 15 + rot * 1.3;
      leftElbow.y = 58;
      rightElbow.x = 85 + rot * 1.3;
      rightElbow.y = 58;
      leftWrist.x = 14 + rot * 1.6;
      leftWrist.y = 54;
      rightWrist.x = 86 + rot * 1.6;
      rightWrist.y = 54;
      head.x = 50 + rot * 0.4;
    } else if (exId === "sit_to_stand") {
      // Squatting down and rising tall
      const squat = (1 - p) / 2;
      head.y = 22 + 22 * squat;
      neck.y = 32 + 22 * squat;
      spineBottom.y = 80 + 20 * squat;
      leftShoulder.y = 42 + 22 * squat;
      rightShoulder.y = 42 + 22 * squat;
      leftHip.y = 80 + 20 * squat;
      rightHip.y = 80 + 20 * squat;
      leftKnee = { x: 28 - 4 * squat, y: 106 + 8 * squat };
      rightKnee = { x: 72 + 4 * squat, y: 106 + 8 * squat };
      leftElbow.y = 68 + 14 * squat;
      rightElbow.y = 68 + 14 * squat;
      leftWrist.y = 95 + 10 * squat;
      rightWrist.y = 95 + 10 * squat;
    } else if (exId === "heel_toe_rock") {
      // Dynamic center of mass rock
      const rock = p * 4;
      head.x = 50 + rock;
      neck.x = 50 + rock;
      leftShoulder.x = 25 + rock;
      rightShoulder.x = 75 + rock;
      leftAnkle.y = 132 - (p > 0 ? p * 6 : 0);
      rightAnkle.y = 132 - (p > 0 ? p * 6 : 0);
    } else if (exId === "lateral_step") {
      // Wide side stepping
      const leftStep = Math.max(0, p);
      const rightStep = Math.max(0, -p);
      leftAnkle.x = 32 - 18 * leftStep;
      leftKnee.x = 35 - 10 * leftStep;
      rightAnkle.x = 68 + 18 * rightStep;
      rightKnee.x = 65 + 10 * rightStep;
    } else if (exId === "posture_reset") {
      // Scapular retraction and chest expansion
      const ret = u;
      leftShoulder.x = 25 + 4 * ret;
      rightShoulder.x = 75 - 4 * ret;
      leftElbow.x = 15 + 6 * ret;
      rightElbow.x = 85 - 6 * ret;
      leftWrist.x = 18 + 8 * ret;
      rightWrist.x = 82 - 8 * ret;
      head.y = 22 - 3 * ret;
    }

    return {
      head,
      neck,
      spineBottom,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    };
  }, [animTime, currentBpm, selectedExercise, isSessionActive]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  if (!mounted || !todayPlan) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading Move Coach Session Plan...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 flex flex-col justify-between max-w-lg mx-auto space-y-4 text-left">
      {/* Top Header */}
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
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Move Coach</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                {todayPlan.postureMode.toUpperCase()}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Synced to {currentBpm} BPM {currentType} cue
            </p>
          </div>
        </div>

        {/* Voice Assistant Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVoiceAssistantEnabled(!voiceAssistantEnabled)}
            className={`p-2 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
              voiceAssistantEnabled
                ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                : "bg-slate-800 text-slate-500"
            }`}
            title={voiceAssistantEnabled ? "Voice Assistant Active" : "Voice Assistant Muted"}
          >
            {voiceAssistantEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase">Time</span>
            <span className="text-lg font-black text-blue-400 font-mono">
              {formatTime(sessionSeconds)}
            </span>
          </div>
        </div>
      </header>

      {/* TODAY'S CUSTOMIZED SESSION PLAN CARD (With Clinician-Reviewable Rationale) */}
      {!isSessionActive && !isHardStopped && (
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-500/30 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Today&apos;s Session Plan
              </span>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full">
              Rule-Based
            </span>
          </div>

          <div>
            <h2 className="text-base font-extrabold text-white">{todayPlan.routineTitle}</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 italic">
              &ldquo;{todayPlan.rationale}&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Target Reps</span>
              <span className="text-sm font-black text-white">{todayPlan.targetRepsPerExercise}</span>
            </div>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Pacing</span>
              <span className="text-sm font-black text-blue-400">{todayPlan.pacingTempoBpm} BPM</span>
            </div>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Posture</span>
              <span className="text-sm font-black text-emerald-400 capitalize">{todayPlan.postureMode}</span>
            </div>
          </div>
        </div>
      )}

      {/* EXERCISE SELECTOR DRAWER (Manual Override Option) */}
      {!isSessionActive && !isHardStopped && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Routine Exercises ({todayPlan.selectedExercises.length})
            </span>
            <span className="text-[10px] text-blue-400">Tap to override</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {todayPlan.selectedExercises.map((ex, idx) => {
              const isSelected = selectedExercise.id === ex.id;
              return (
                <button
                  key={ex.id}
                  onClick={() => {
                    setSelectedExercise(ex);
                    setCurrentExerciseIndex(idx);
                  }}
                  className={`flex-shrink-0 w-40 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600/30 border-blue-400 shadow-md ring-2 ring-blue-500/40"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[9px] font-bold text-blue-400 block truncate">
                    {ex.category}
                  </span>
                  <div className="text-xs font-bold text-white mt-0.5 line-clamp-1">
                    {ex.name}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {ex.targetReps} reps • {ex.posture}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LIVE CAMERA & TEMPO-SYNCED POSE OVERLAY AREA */}
      <div className="relative rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden min-h-[260px] sm:min-h-[290px] flex items-center justify-center shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
            cameraActive ? "opacity-70" : "hidden"
          }`}
        />

        {/* Dynamic Pose Figure (Tempo-Synced Skeleton Animation) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-52 h-64 text-blue-500/90" viewBox="0 0 100 145" fill="none">
            {/* Head & Neck */}
            <circle
              cx={jointCoords.head.x}
              cy={jointCoords.head.y}
              r="10"
              stroke="#60A5FA"
              strokeWidth="2.5"
              fill="#2563EB"
              fillOpacity="0.3"
            />
            {/* Spine */}
            <line
              x1={jointCoords.neck.x}
              y1={jointCoords.neck.y}
              x2={jointCoords.spineBottom.x}
              y2={jointCoords.spineBottom.y}
              stroke="#60A5FA"
              strokeWidth="3"
            />
            {/* Shoulder Girdle */}
            <line
              x1={jointCoords.leftShoulder.x}
              y1={jointCoords.leftShoulder.y}
              x2={jointCoords.rightShoulder.x}
              y2={jointCoords.rightShoulder.y}
              stroke="#60A5FA"
              strokeWidth="3"
            />

            {/* Left Arm */}
            <line
              x1={jointCoords.leftShoulder.x}
              y1={jointCoords.leftShoulder.y}
              x2={jointCoords.leftElbow.x}
              y2={jointCoords.leftElbow.y}
              stroke="#38BDF8"
              strokeWidth="2.75"
            />
            <line
              x1={jointCoords.leftElbow.x}
              y1={jointCoords.leftElbow.y}
              x2={jointCoords.leftWrist.x}
              y2={jointCoords.leftWrist.y}
              stroke="#38BDF8"
              strokeWidth="2.5"
            />

            {/* Right Arm */}
            <line
              x1={jointCoords.rightShoulder.x}
              y1={jointCoords.rightShoulder.y}
              x2={jointCoords.rightElbow.x}
              y2={jointCoords.rightElbow.y}
              stroke="#38BDF8"
              strokeWidth="2.75"
            />
            <line
              x1={jointCoords.rightElbow.x}
              y1={jointCoords.rightElbow.y}
              x2={jointCoords.rightWrist.x}
              y2={jointCoords.rightWrist.y}
              stroke="#38BDF8"
              strokeWidth="2.5"
            />

            {/* Upper Body Joint Dots */}
            <circle cx={jointCoords.leftShoulder.x} cy={jointCoords.leftShoulder.y} r="3.5" fill="#38BDF8" />
            <circle cx={jointCoords.rightShoulder.x} cy={jointCoords.rightShoulder.y} r="3.5" fill="#38BDF8" />
            <circle cx={jointCoords.leftElbow.x} cy={jointCoords.leftElbow.y} r="3.5" fill="#38BDF8" />
            <circle cx={jointCoords.rightElbow.x} cy={jointCoords.rightElbow.y} r="3.5" fill="#38BDF8" />
            <circle cx={jointCoords.leftWrist.x} cy={jointCoords.leftWrist.y} r="4" fill="#60A5FA" />
            <circle cx={jointCoords.rightWrist.x} cy={jointCoords.rightWrist.y} r="4" fill="#60A5FA" />

            {/* Pelvis */}
            <line
              x1={jointCoords.leftHip.x}
              y1={jointCoords.leftHip.y}
              x2={jointCoords.rightHip.x}
              y2={jointCoords.rightHip.y}
              stroke="#34D399"
              strokeWidth="3"
            />

            {/* Left Leg */}
            <line
              x1={jointCoords.leftHip.x}
              y1={jointCoords.leftHip.y}
              x2={jointCoords.leftKnee.x}
              y2={jointCoords.leftKnee.y}
              stroke="#34D399"
              strokeWidth="3"
            />
            <line
              x1={jointCoords.leftKnee.x}
              y1={jointCoords.leftKnee.y}
              x2={jointCoords.leftAnkle.x}
              y2={jointCoords.leftAnkle.y}
              stroke="#34D399"
              strokeWidth="3"
            />

            {/* Right Leg */}
            <line
              x1={jointCoords.rightHip.x}
              y1={jointCoords.rightHip.y}
              x2={jointCoords.rightKnee.x}
              y2={jointCoords.rightKnee.y}
              stroke="#34D399"
              strokeWidth="3"
            />
            <line
              x1={jointCoords.rightKnee.x}
              y1={jointCoords.rightKnee.y}
              x2={jointCoords.rightAnkle.x}
              y2={jointCoords.rightAnkle.y}
              stroke="#34D399"
              strokeWidth="3"
            />

            {/* Lower Body Joint Dots */}
            <circle cx={jointCoords.leftHip.x} cy={jointCoords.leftHip.y} r="3" fill="#34D399" />
            <circle cx={jointCoords.rightHip.x} cy={jointCoords.rightHip.y} r="3" fill="#34D399" />
            <circle cx={jointCoords.leftKnee.x} cy={jointCoords.leftKnee.y} r="3.5" fill="#34D399" />
            <circle cx={jointCoords.rightKnee.x} cy={jointCoords.rightKnee.y} r="3.5" fill="#34D399" />
            <circle cx={jointCoords.leftAnkle.x} cy={jointCoords.leftAnkle.y} r="3.5" fill="#34D399" />
            <circle cx={jointCoords.rightAnkle.x} cy={jointCoords.rightAnkle.y} r="3.5" fill="#34D399" />
          </svg>
        </div>

        {/* Visual Pulse in corner */}
        {isSessionActive && !isPaused && (
          <div className="absolute top-3 right-3 p-2 bg-slate-900/80 rounded-2xl border border-slate-700 backdrop-blur-md">
            <VisualPulse beatCount={beatCount} beatInBar={beatInBar} isPlaying={true} size="sm" />
          </div>
        )}

        {/* Explicit Mode Badge: Camera Active vs Demo Guide Animation */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-slate-900/80 rounded-full border border-slate-700 text-xs text-blue-300 font-semibold backdrop-blur-md flex items-center gap-1.5">
          {cameraActive ? (
            <>
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>Camera Tracking • {currentBpm} BPM</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Visual Form Guide • {currentBpm} BPM</span>
            </>
          )}
        </div>
      </div>

      {/* LIVE COACHING PROMPT */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/40 text-center shadow-lg space-y-1">
        <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider block">
          Live Form Coach {voiceAssistantEnabled && "• Voice Active"}
        </span>
        <div className="text-base font-bold text-white">
          &quot;{isSessionActive ? coachPrompt : "Press Start to begin guided session."}&quot;
        </div>
      </div>

      {/* HARD STOP MESSAGE MODAL / BANNER (CALM STOP ENFORCEMENT) */}
      {isHardStopped && (
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-emerald-400/80 text-left space-y-4 shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {stopReason === "target_reached" ? "Target Achieved!" : "Safe Resting Point"}
              </h3>
              <p className="text-xs text-emerald-300 font-medium">{stopMessage}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Reps Completed</span>
              <span className="text-lg font-black text-white">{repCount} / {targetReps}</span>
            </div>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Beat Sync</span>
              <span className="text-lg font-black text-blue-400">{syncScore}%</span>
            </div>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Duration</span>
              <span className="text-lg font-black text-emerald-400">{formatTime(sessionSeconds)}</span>
            </div>
          </div>

          {/* End Session Button (Default Action) */}
          <button
            onClick={() => router.push("/today")}
            className="w-full min-h-[48px] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Save Session &amp; Return to Home
          </button>

          {/* Deliberate Secondary Bonus Round Confirmation (Protects Against Overdoing) */}
          {!showBonusConfirm ? (
            <button
              onClick={() => setShowBonusConfirm(true)}
              className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 py-1 underline cursor-pointer"
            >
              Request deliberate bonus round...
            </button>
          ) : (
            <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bonus round requires deliberate confirmation:</span>
              </div>
              <p className="text-[11px] text-slate-300">
                To prevent over-exertion, STEADY recommends resting after hitting your daily plan.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBonusConfirm(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancel &amp; Rest
                </button>
                <button
                  onClick={() => {
                    setShowBonusConfirm(false);
                    setIsHardStopped(false);
                    setTargetReps((r) => r + 5);
                    handleStartSession();
                  }}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
                >
                  Confirm +5 Reps
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATS: REPS + BEAT SYNC */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-0.5">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Reps</span>
            {isSessionActive && !isPaused && (
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  movementStatus === "moving"
                    ? "bg-emerald-400 animate-ping"
                    : "bg-amber-400 animate-pulse"
                }`}
              />
            )}
          </div>
          <div className="text-2xl font-black text-white">{repCount} / {targetReps}</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (repCount / targetReps) * 100)}%` }}
            />
          </div>
          {isSessionActive && (
            <span className="text-[9px] text-slate-400 block pt-0.5 truncate">
              {movementStatus === "moving" ? "Movement detected" : "Waiting for movement..."}
            </span>
          )}
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Rhythm Entrainment</span>
          <div className="text-2xl font-black text-blue-400">{syncScore}%</div>
          <span className="text-[10px] text-slate-400 block truncate">
            Target: {currentBpm} BPM • {activeInputSource}
          </span>
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      {!isHardStopped && (
        <div className="space-y-2 pt-1">
          {!isSessionActive ? (
            <button
              onClick={handleStartSession}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-brand-gradient text-white font-bold text-base shadow-lg hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Start Today&apos;s Plan ({currentBpm} BPM)</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleTogglePause}
                className="min-h-[52px] py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>

              <button
                onClick={handleEndSession}
                className="min-h-[52px] py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>End Session</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
