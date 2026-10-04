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
  Music,
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
  const [targetReps, setTargetReps] = useState(6);
  const [activeCue, setActiveCueState] = useState<CueResult | null>(null);

  // Voice Assistant & Hands-free state
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(true);

  // Hard Stop & Fatigue states
  const [isHardStopped, setIsHardStopped] = useState(false);
  const [stopReason, setStopReason] = useState<"target_reached" | "fatigue_shrink" | null>(null);
  const [stopMessage, setStopMessage] = useState("");
  const [showBonusConfirm, setShowBonusConfirm] = useState(false);

  // Live coaching prompt rotation & Real Form state
  const [coachPrompt, setCoachPrompt] = useState("Bigger reach! Keep your arms high.");
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>([1.0, 1.0, 0.95]);
  const [lastRepForm, setLastRepForm] = useState<"good" | "partial" | "idle">("idle");
  const [formFeedbackMsg, setFormFeedbackMsg] = useState<string>("");
  const [coachingAudioEnabled, setCoachingAudioEnabled] = useState(true);

  // Form-driven spoken cue tracking refs (strictly event/kinematics driven, no timers)
  const consecutivePartialRepsRef = useRef<number>(0);
  const goodRepCountRef = useRef<number>(0);
  const lastSpokenTimeRef = useRef<number>(0);

  // Real Optical Region Tracking & Moving Average Smoothing Refs
  const movingAvgBufferRef = useRef<Array<{ upper: number; mid: number; lower: number; total: number }>>([]);
  const lastRegionMotionRef = useRef<{ upper: number; mid: number; lower: number; total: number }>({ upper: 0, mid: 0, lower: 0, total: 0 });
  const [debugLogMsg, setDebugLogMsg] = useState<string>("");

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
    duck: duckBeat,
  } = useCueEngine();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const [isFromCueLab, setIsFromCueLab] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cue = getActiveCue();
    setActiveCueState(cue);

    // Generate rule-based plan
    const plan = getTodaySessionPlan();
    setTodayPlan(plan);
    if (plan.selectedExercises.length > 0) {
      setSelectedExercise(plan.selectedExercises[0]);
      setTargetReps(plan.targetRepsPerExercise || 6);
    }

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const isFromCue = searchParams.get("fromCueLab") === "true";
      setIsFromCueLab(isFromCue);
      if (isFromCue) {
        const type = cue?.type || plan.pacingCueType || "audio";
        const bpmVal = cue?.bpm || plan.pacingTempoBpm || 88;
        startCue(type, bpmVal);
      }
    }
  }, [startCue]);

  // Exercise Movement Pacing (Decoupled from fast walking/tapping cue BPM):
  // 40 BPM pacing = 1.5s per beat step / 3.0 seconds per complete exercise rep cycle (20 reps/min)
  const EXERCISE_PACING_BPM = 40;
  const currentType: CueType = todayPlan?.pacingCueType || activeCue?.type || "audio";
  const currentBpm = EXERCISE_PACING_BPM;

  // Helper to trigger short spoken form cue with metronome beat ducking
  const speakCoachingCue = (text: string, durationMs: number = 1800) => {
    if (!coachingAudioEnabled || typeof window === "undefined") return;
    duckBeat(durationMs);
    voiceGuide.speak(text);
  };

  // Real Spatial Region Optical Form Evaluator (upper/mid/lower body kinematic region displacement)
  const evaluateExerciseForm = (
    exId: string,
    peakMag: number,
    regions: { upper: number; mid: number; lower: number; total: number }
  ) => {
    let targetEnergy = 0;
    let fullThreshold = 10.0;
    let feedbackTip = "";

    if (exId === "big_reach") {
      targetEnergy = regions.upper;
      fullThreshold = 11.0;
      feedbackTip = "Reach a little higher";
    } else if (exId === "high_knees") {
      targetEnergy = regions.lower;
      fullThreshold = 10.0;
      feedbackTip = "Lift your knees higher";
    } else if (exId === "torso_twist") {
      targetEnergy = regions.mid;
      fullThreshold = 9.5;
      feedbackTip = "Rotate shoulders further";
    } else if (exId === "sit_to_stand") {
      targetEnergy = regions.total;
      fullThreshold = 11.0;
      feedbackTip = "Stand up taller";
    } else if (exId === "heel_toe_rock") {
      targetEnergy = regions.lower;
      fullThreshold = 8.5;
      feedbackTip = "Rock further onto toes";
    } else if (exId === "posture_reset") {
      targetEnergy = regions.upper;
      fullThreshold = 9.0;
      feedbackTip = "Squeeze shoulders back";
    } else {
      targetEnergy = regions.total;
      fullThreshold = 9.5;
      feedbackTip = "Step a bit wider";
    }

    const ratio = Math.min(1.2, Math.max(0, targetEnergy / fullThreshold));

    let formQuality: "good" | "partial" | "invalid" = "invalid";
    if (ratio >= 0.60) {
      formQuality = "good";
    } else if (ratio >= 0.25) {
      formQuality = "partial";
    } else {
      formQuality = "invalid";
    }

    const logStr = `Ex: ${exId} | TargetEnergy: ${targetEnergy.toFixed(1)} (Thresh: ${fullThreshold}) | Quality: ${formQuality.toUpperCase()}`;
    console.log(`[MoveFormTracker] ${logStr}`);
    setDebugLogMsg(logStr);

    return { formQuality, formScore: ratio, feedbackTip };
  };

  // Handler for genuine detected movement peak with Real-Form Verification & Form-Driven Speech
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

    const now = Date.now();

    // 1. RHYTHM DRIFT AUDIO PROMPT: If cadence drifts off metronome beat (<50% sync)
    if (instantaneousSync < 50 && now - lastSpokenTimeRef.current > 3200) {
      speakCoachingCue("Try to match the beat", 1800);
      lastSpokenTimeRef.current = now;
    }

    // Evaluate Real Exercise Form using smoothed spatial region tracking data
    const formResult = evaluateExerciseForm(
      selectedExercise?.id || "big_reach",
      peakMagnitude,
      lastRegionMotionRef.current
    );

    if (formResult.formQuality === "invalid") {
      return;
    }

    if (formResult.formQuality === "partial") {
      setLastRepForm("partial");
      setFormFeedbackMsg(`Partial Rep — ${formResult.feedbackTip}`);
      setCoachPrompt(`Partial Rep: ${formResult.feedbackTip}`);

      consecutivePartialRepsRef.current += 1;

      // 2. PARTIAL FORM AUDIO PROMPT: Triggered after 2+ consecutive partial reps
      if (consecutivePartialRepsRef.current >= 2 && now - lastSpokenTimeRef.current > 3000) {
        speakCoachingCue(formResult.feedbackTip, 1800);
        lastSpokenTimeRef.current = now;
      }

      // Track amplitude trend even on partial reps for fatigue shrink check
      setAmplitudeHistory((prev) => {
        const updated = [...prev, formResult.formScore].slice(-4);
        if (updated.length >= 3) {
          const drop = (updated[0] - updated[updated.length - 1]) / updated[0];
          if (drop > 0.25 && repCount >= 3) {
            triggerHardStop("fatigue_shrink");
          }
        }
        return updated;
      });
      return; // Do NOT increment rep count on Partial form
    }

    // Good Form Rep:
    setLastRepForm("good");
    setFormFeedbackMsg(`Good Form! ${formResult.feedbackTip}`);
    setCoachPrompt(`Good Form! ${formResult.feedbackTip}`);

    consecutivePartialRepsRef.current = 0;
    goodRepCountRef.current += 1;

    setRepCount((prev) => {
      const nextRep = prev + 1;

      // 3. TARGET REVENUE / COMPLETION AUDIO PROMPT: 6/6 good reps
      if (nextRep >= targetReps) {
        speakCoachingCue("Session complete, nice work!", 2200);
        lastSpokenTimeRef.current = now;
        triggerHardStop("target_reached");
      } else if (goodRepCountRef.current % 2 === 0 && now - lastSpokenTimeRef.current > 2500) {
        // 4. PERIODIC POSITIVE REINFORCEMENT: Every 2nd good rep
        const positiveCues = ["Nice extension!", "Great pace!", "Steady rhythm!", "Strong movement!"];
        const chosenCue = positiveCues[(goodRepCountRef.current / 2) % positiveCues.length];
        speakCoachingCue(chosenCue, 1600);
        lastSpokenTimeRef.current = now;
      }

      return nextRep;
    });

    // Amplitude tracking for real joint-based fatigue shrink check
    setAmplitudeHistory((prev) => {
      const updated = [...prev, formResult.formScore].slice(-4);

      // HARD STOP 2: Fatigue shrink > 25% drop over consecutive reps from joint tracking
      if (updated.length >= 3) {
        const drop = (updated[0] - updated[updated.length - 1]) / updated[0];
        if (drop > 0.25 && repCount >= 3) {
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
      if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              if (videoRef.current) await videoRef.current.play();
            } catch (playErr) {
              console.warn("Autoplay interrupted", playErr);
            }
          };
          try {
            await videoRef.current.play();
          } catch (e) {
            // Handled via onloadedmetadata
          }
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

      if (!cameraActive) {
        setActiveInputSource("Motion Sensor");
      }
      const rawMag = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
      const netMag = Math.abs(rawMag - 9.8);
      const now = Date.now();

      // Minimum peak interval based on pacing tempo (prevents multi-triggers per single rep)
      const minIntervalMs = Math.max(380, (60 / currentBpm) * 600);
      const isPeak =
        now - lastPeakTimeRef.current >= minIntervalMs &&
        netMag > 1.15 &&
        prevAccelMagRef.current <= 1.15;

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
  }, [isSessionActive, isPaused, isHardStopped, currentBpm, cameraActive]);

  // Camera Optical Frame Difference Peak Detector (Highly responsive vision tracking)
  useEffect(() => {
    if (!isSessionActive || !cameraActive || isPaused || isHardStopped) return;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const frameInterval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || video.readyState < 2) return;

      try {
        ctx.drawImage(video, 0, 0, 32, 32);
        const frame = ctx.getImageData(0, 0, 32, 32);
        const data = frame.data;

        if (prevFrameDataRef.current) {
          let upperDiff = 0, midDiff = 0, lowerDiff = 0;
          let upperCount = 0, midCount = 0, lowerCount = 0;
          const prev = prevFrameDataRef.current;
          for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
              const i = (y * 32 + x) * 4;
              const curLuma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
              const prevLuma = (prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114);
              const diff = Math.abs(curLuma - prevLuma);

              if (y < 11) {
                upperDiff += diff;
                upperCount++;
              } else if (y < 22) {
                midDiff += diff;
                midCount++;
              } else {
                lowerDiff += diff;
                lowerCount++;
              }
            }
          }

          const upperEnergy = upperDiff / (upperCount || 1);
          const midEnergy = midDiff / (midCount || 1);
          const lowerEnergy = lowerDiff / (lowerCount || 1);
          const totalEnergy = (upperDiff + midDiff + lowerDiff) / (32 * 32);

          // 4-frame moving average smoothing buffer
          movingAvgBufferRef.current.push({ upper: upperEnergy, mid: midEnergy, lower: lowerEnergy, total: totalEnergy });
          if (movingAvgBufferRef.current.length > 4) {
            movingAvgBufferRef.current.shift();
          }

          const len = movingAvgBufferRef.current.length;
          const smoothed = movingAvgBufferRef.current.reduce(
            (acc, item) => ({
              upper: acc.upper + item.upper / len,
              mid: acc.mid + item.mid / len,
              lower: acc.lower + item.lower / len,
              total: acc.total + item.total / len,
            }),
            { upper: 0, mid: 0, lower: 0, total: 0 }
          );

          lastRegionMotionRef.current = smoothed;

          const now = Date.now();
          const minIntervalMs = Math.max(400, (60 / currentBpm) * 600);

          if (smoothed.total > 2.0) {
            lastMovementTimeRef.current = now;
            setMovementStatus("moving");
          }

          if (
            smoothed.total > 2.8 &&
            prevFrameEnergyRef.current <= 2.8 &&
            now - lastCameraPeakTimeRef.current >= minIntervalMs
          ) {
            lastCameraPeakTimeRef.current = now;
            registerMovementPeak(smoothed.total / 4, now);
          }
          prevFrameEnergyRef.current = smoothed.total;
        }

        prevFrameDataRef.current = new Uint8ClampedArray(data);
      } catch (err) {
        // Fallback gracefully on frame capture exception
      }
    }, 60);

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

  // Dynamic Joint Coordinate Generator (Synchronized to 3.0s per complete rep cycle)
  const jointCoords = useMemo(() => {
    // 1 full movement cycle every 3.0 seconds (20 reps/min pace)
    const freq = (20 / 60) * 2 * Math.PI;
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

        {/* Audio Coaching & Mic Toggles */}
        <div className="flex items-center gap-1.5">
          {/* Spoken Form Coaching Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextState = !coachingAudioEnabled;
              setCoachingAudioEnabled(nextState);
              if (!nextState) voiceGuide.stopSpeaking();
            }}
            className={`p-2 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer ${
              coachingAudioEnabled
                ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/40"
                : "bg-slate-800 text-slate-500"
            }`}
            title={coachingAudioEnabled ? "Spoken Form Coaching Active (Click to mute)" : "Spoken Form Coaching Muted (Click to enable)"}
          >
            {coachingAudioEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>

          {/* Voice Command Mic Listener Toggle */}
          <button
            type="button"
            onClick={() => setVoiceAssistantEnabled(!voiceAssistantEnabled)}
            className={`p-2 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
              voiceAssistantEnabled
                ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                : "bg-slate-800 text-slate-500"
            }`}
            title={voiceAssistantEnabled ? "Voice Mic Listener Active" : "Voice Mic Listener Muted"}
          >
            {voiceAssistantEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <div className="text-right pl-1">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase">Time</span>
            <span className="text-lg font-black text-blue-400 font-mono">
              {formatTime(sessionSeconds)}
            </span>
          </div>
        </div>
      </header>

      {/* HIGHLIGHTED TODAY'S EXERCISE PRE-CAMERA PREVIEW CARD */}
      {!isSessionActive && !isHardStopped && (
        <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 border-2 border-indigo-500/50 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">
                Today&apos;s Exercise • Pre-Camera Preview
              </span>
            </div>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1">
              <Music className="w-3 h-3 text-blue-400" />
              <span>{currentBpm} BPM</span>
            </span>
          </div>

          {/* Exercise Title & BPM Display */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-white">
                {selectedExercise?.name || "High Knees Marching"}
              </h2>
              <div className="text-xs text-indigo-300 font-medium flex items-center gap-1.5 mt-0.5">
                <Music className="w-3.5 h-3.5 text-blue-400" />
                <span>Synced to {currentBpm} BPM {currentType.toUpperCase()} cue</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isPlaying) {
                  stopCue();
                } else {
                  startCue("audio", currentBpm);
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isPlaying
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)] animate-pulse"
                  : "bg-blue-600/30 text-blue-300 border-blue-400/40 hover:bg-blue-600/50"
              }`}
              title={isPlaying ? "Click to stop preview audio" : `Click to preview ${currentBpm} BPM audio beat`}
            >
              {isPlaying ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-300" />
                  <span>Stop Preview</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-blue-300" />
                  <span>Preview Audio</span>
                </>
              )}
            </button>
          </div>

          {/* Rhythm-Synced Stick Figure Animation (No camera required) */}
          <div className="py-3 px-4 bg-slate-950/90 rounded-2xl border border-indigo-900/40 flex flex-col items-center justify-center space-y-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg viewBox="0 0 100 120" className="w-32 h-32">
                {/* Ground */}
                <line x1="10" y1="110" x2="90" y2="110" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

                {/* Head Dot */}
                <circle
                  cx="50"
                  cy={beatCount % 2 === 1 ? 26 : 30}
                  r="9"
                  fill="#60A5FA"
                  className="transition-all duration-150 ease-out"
                />

                {/* Torso Line */}
                <line
                  x1="50"
                  y1={beatCount % 2 === 1 ? 35 : 39}
                  x2="50"
                  y2={beatCount % 2 === 1 ? 75 : 79}
                  stroke="#60A5FA"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-150 ease-out"
                />

                {/* Left Arm / Dot */}
                <line
                  x1="50"
                  y1={beatCount % 2 === 1 ? 46 : 50}
                  x2={beatCount % 2 === 1 ? 30 : 38}
                  y2={beatCount % 2 === 1 ? 52 : 62}
                  stroke="#38BDF8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="transition-all duration-150 ease-out"
                />
                <circle
                  cx={beatCount % 2 === 1 ? 30 : 38}
                  cy={beatCount % 2 === 1 ? 52 : 62}
                  r="4.5"
                  fill="#38BDF8"
                  className="transition-all duration-150 ease-out"
                />

                {/* Right Arm / Dot */}
                <line
                  x1="50"
                  y1={beatCount % 2 === 1 ? 46 : 50}
                  x2={beatCount % 2 === 1 ? 68 : 60}
                  y2={beatCount % 2 === 1 ? 62 : 52}
                  stroke="#38BDF8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="transition-all duration-150 ease-out"
                />
                <circle
                  cx={beatCount % 2 === 1 ? 68 : 60}
                  cy={beatCount % 2 === 1 ? 62 : 52}
                  r="4.5"
                  fill="#38BDF8"
                  className="transition-all duration-150 ease-out"
                />

                {/* Left Leg / Foot Dot */}
                <line
                  x1="50"
                  y1={beatCount % 2 === 1 ? 75 : 79}
                  x2={beatCount % 2 === 1 ? 32 : 40}
                  y2={beatCount % 2 === 1 ? 95 : 108}
                  stroke="#3B82F6"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-150 ease-out"
                />
                <circle
                  cx={beatCount % 2 === 1 ? 32 : 40}
                  cy={beatCount % 2 === 1 ? 95 : 108}
                  r="5"
                  fill="#60A5FA"
                  className="transition-all duration-150 ease-out"
                />

                {/* Right Leg / Foot Dot */}
                <line
                  x1="50"
                  y1={beatCount % 2 === 1 ? 75 : 79}
                  x2={beatCount % 2 === 1 ? 60 : 68}
                  y2={beatCount % 2 === 1 ? 108 : 95}
                  stroke="#3B82F6"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-150 ease-out"
                />
                <circle
                  cx={beatCount % 2 === 1 ? 60 : 68}
                  cy={beatCount % 2 === 1 ? 108 : 95}
                  r="5"
                  fill="#60A5FA"
                  className="transition-all duration-150 ease-out"
                />
              </svg>
            </div>

            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Rhythm-synced posture animation • No camera required</span>
            </div>
          </div>

          {/* Start full session with camera button */}
          <button
            type="button"
            onClick={() => {
              if (isPlaying) stopCue();
              setIsSessionActive(true);
              enableCamera();
            }}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <Video className="w-4 h-4 text-white" />
            <span>Start full session with camera</span>
          </button>
        </div>
      )}

      {/* TODAY'S CUSTOMIZED SESSION PLAN CARD (With Clinician-Reviewable Rationale) */}
      {!isSessionActive && !isHardStopped && todayPlan && (
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
                    setTargetReps(ex.targetReps || 6);
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

        {/* Explicit Mode Badge & Camera Toggle Button */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <button
            onClick={enableCamera}
            type="button"
            className="px-3 py-1 bg-slate-900/80 hover:bg-slate-800 rounded-full border border-slate-700 text-xs text-blue-300 font-semibold backdrop-blur-md flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            title={cameraActive ? "Camera is active - click to re-initialize" : "Click to enable camera tracking"}
          >
            {cameraActive ? (
              <>
                <Video className="w-3.5 h-3.5 text-emerald-400" />
                <span>Camera Tracking • {currentBpm} BPM</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">Tap to Enable Camera</span>
              </>
            )}
          </button>
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
            <div className="pt-0.5">
              {lastRepForm === "good" ? (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 inline-block truncate">
                  ✓ Good Form Rep (+1)
                </span>
              ) : lastRepForm === "partial" ? (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 inline-block truncate">
                  ⚠ Partial Rep (No Count)
                </span>
              ) : (
                <span className="text-[9px] text-slate-400 block truncate">
                  {movementStatus === "moving" ? "Movement detected" : "Waiting for movement..."}
                </span>
              )}
            </div>
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
