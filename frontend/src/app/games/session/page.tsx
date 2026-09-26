"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveGameSession,
  recordDailyCompletion,
  StreakState,
} from "@/lib/games";
import { useCueEngine } from "@/lib/cueEngine";
import {
  Target,
  Music,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  ArrowRight,
  Flame,
  Snowflake,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
  Clock,
  CalendarCheck,
  Piano,
} from "lucide-react";

type ColorType = "green" | "red" | "blue" | "yellow" | "purple" | "orange";
type ShapeType = "circle" | "square" | "diamond";

interface GameObject {
  id: string;
  color: ColorType;
  colorName: string;
  colorBg: string;
  colorBorder: string;
  shape: ShapeType;
  topPct: number;
  leftPct: number;
}

const COLOR_MAP: Record<ColorType, { name: string; bg: string; border: string; hex: string }> = {
  green: { name: "GREEN", bg: "bg-emerald-500", border: "border-emerald-300", hex: "#22c55e" },
  red: { name: "RED", bg: "bg-red-500", border: "border-red-300", hex: "#ef4444" },
  blue: { name: "BLUE", bg: "bg-blue-500", border: "border-blue-300", hex: "#3b82f6" },
  yellow: { name: "YELLOW", bg: "bg-yellow-400", border: "border-yellow-200", hex: "#eab308" },
  purple: { name: "PURPLE", bg: "bg-purple-500", border: "border-purple-300", hex: "#a855f7" },
  orange: { name: "ORANGE", bg: "bg-orange-500", border: "border-orange-300", hex: "#f97316" },
};

function GameSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameModeParam = searchParams.get("game") || "all";

  const [mounted, setMounted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Overall session flow state: 'intro' | 'focus-game' | 'focus-complete' | 'rhythm-game' | 'rhythm-complete' | 'piano-game' | 'completed'
  const [step, setStep] = useState<
    "intro" | "focus-game" | "focus-complete" | "rhythm-game" | "rhythm-complete" | "piano-game" | "completed"
  >("intro");

  // FOCUS TARGET GAME STATE
  const [focusRound, setFocusRound] = useState(1);
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [targetPrompt, setTargetPrompt] = useState<string>("");
  const [targetCriteria, setTargetCriteria] = useState<{
    color?: ColorType;
    shape?: ShapeType;
    sequence?: ColorType[];
    sequenceIndex?: number;
  }>({});
  const [focusFeedback, setFocusFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const roundStartTimeRef = useRef<number>(0);

  // RHYTHM TAP GAME STATE
  const { start: startCue, stop: stopCue, setBpm: setEngineBpm, beatCount, beatInBar } = useCueEngine();
  const [rhythmLevel, setRhythmLevel] = useState(1);
  const [currentBpm, setCurrentBpm] = useState(60);
  const [rhythmFeedback, setRhythmFeedback] = useState<{ text: string; sub: string; color: string } | null>(null);
  const [timingDeviations, setTimingDeviations] = useState<number[]>([]);
  const [missedBeats, setMissedBeats] = useState(0);
  const [extraTaps, setExtraTaps] = useState(0);
  const lastBeatTimeRef = useRef<number>(0);
  const hasTappedCurrentBeatRef = useRef<boolean>(false);
  const currentBpmRef = useRef<number>(60);
  const isSilentBeatRef = useRef<boolean>(false);

  // FINGER PIANO GAME STATE
  const [pianoSequence, setPianoSequence] = useState<number[]>([]);
  const [highlightedKey, setHighlightedKey] = useState<number | null>(null);
  const [pianoPhase, setPianoPhase] = useState<"preview" | "input" | "feedback">("preview");
  const [userPianoTaps, setUserPianoTaps] = useState<number[]>([]);
  const [pianoFeedbackText, setPianoFeedbackText] = useState<string>("");
  const [pianoProgressPct, setPianoProgressPct] = useState<number>(0);
  const pianoStartTimeRef = useRef<number>(0);
  const pianoFirstTapTimeRef = useRef<number>(0);

  // SUMMARY RESULTS STATE
  const [focusResultSession, setFocusResultSession] = useState<any>(null);
  const [rhythmResultSession, setRhythmResultSession] = useState<any>(null);
  const [pianoResultSession, setPianoResultSession] = useState<any>(null);
  const [completionResult, setCompletionResult] = useState<{
    streakState: StreakState;
    freezeUsed: boolean;
    resetOccurred: boolean;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    if (gameModeParam === "focus-target") {
      startFocusGame();
    } else if (gameModeParam === "rhythm-tap") {
      startRhythmGame();
    } else if (gameModeParam === "finger-piano") {
      startFingerPianoGame();
    }
  }, [gameModeParam]);

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis error", e);
    }
  };

  // -------------------------------------------------------------
  // FOCUS TARGET GAME LOGIC
  // -------------------------------------------------------------
  const generateFocusRound = (roundNum: number) => {
    setFocusFeedback(null);
    roundStartTimeRef.current = Date.now();
    const level = roundNum <= 3 ? 1 : roundNum <= 6 ? 2 : roundNum <= 9 ? 3 : 4;

    const gridPositions = [
      { topPct: 20, leftPct: 25 },
      { topPct: 20, leftPct: 75 },
      { topPct: 50, leftPct: 25 },
      { topPct: 50, leftPct: 75 },
      { topPct: 80, leftPct: 25 },
      { topPct: 80, leftPct: 75 },
      { topPct: 35, leftPct: 50 },
      { topPct: 65, leftPct: 50 },
    ];
    const shuffledPositions = [...gridPositions].sort(() => Math.random() - 0.5);

    if (level === 1) {
      const colors: ColorType[] = ["green", "red", "blue", "yellow"];
      const targetColor = colors[Math.floor(Math.random() * colors.length)];
      const newObjs: GameObject[] = colors.map((c, idx) => ({
        id: `obj-${idx}`,
        color: c,
        colorName: COLOR_MAP[c].name,
        colorBg: COLOR_MAP[c].bg,
        colorBorder: COLOR_MAP[c].border,
        shape: "circle",
        topPct: shuffledPositions[idx].topPct,
        leftPct: shuffledPositions[idx].leftPct,
      }));
      const prompt = `Tap the ${COLOR_MAP[targetColor].name} circle`;
      setObjects(newObjs);
      setTargetPrompt(prompt);
      setTargetCriteria({ color: targetColor, shape: "circle" });
      speakText(prompt);
    } else if (level === 2) {
      const colors: ColorType[] = ["green", "red", "blue", "yellow", "purple", "orange"];
      const targetColor = colors[Math.floor(Math.random() * colors.length)];
      const newObjs: GameObject[] = colors.map((c, idx) => ({
        id: `obj-${idx}`,
        color: c,
        colorName: COLOR_MAP[c].name,
        colorBg: COLOR_MAP[c].bg,
        colorBorder: COLOR_MAP[c].border,
        shape: "circle",
        topPct: shuffledPositions[idx].topPct,
        leftPct: shuffledPositions[idx].leftPct,
      }));
      const prompt = `Tap the ${COLOR_MAP[targetColor].name} circle`;
      setObjects(newObjs);
      setTargetPrompt(prompt);
      setTargetCriteria({ color: targetColor, shape: "circle" });
      speakText(prompt);
    } else if (level === 3) {
      const baseColors: ColorType[] = ["green", "red", "blue", "yellow", "purple", "orange"];
      const shapes: ShapeType[] = ["circle", "square", "diamond"];
      const targetColor = baseColors[Math.floor(Math.random() * baseColors.length)];
      const targetShape = shapes[Math.floor(Math.random() * shapes.length)];
      const newObjs: GameObject[] = [
        {
          id: "obj-0",
          color: targetColor,
          colorName: COLOR_MAP[targetColor].name,
          colorBg: COLOR_MAP[targetColor].bg,
          colorBorder: COLOR_MAP[targetColor].border,
          shape: targetShape,
          topPct: shuffledPositions[0].topPct,
          leftPct: shuffledPositions[0].leftPct,
        },
      ];
      for (let i = 1; i < 6; i++) {
        const distColor = baseColors[i % baseColors.length];
        const distShape = shapes[(i + 1) % shapes.length];
        newObjs.push({
          id: `obj-${i}`,
          color: distColor,
          colorName: COLOR_MAP[distColor].name,
          colorBg: COLOR_MAP[distColor].bg,
          colorBorder: COLOR_MAP[distColor].border,
          shape: distShape,
          topPct: shuffledPositions[i].topPct,
          leftPct: shuffledPositions[i].leftPct,
        });
      }
      const finalObjs = newObjs.sort(() => Math.random() - 0.5);
      const prompt = `Tap the ${COLOR_MAP[targetColor].name} ${targetShape.toUpperCase()}`;
      setObjects(finalObjs);
      setTargetPrompt(prompt);
      setTargetCriteria({ color: targetColor, shape: targetShape });
      speakText(prompt);
    } else {
      const baseColors: ColorType[] = ["green", "red", "blue", "yellow"];
      const seqLength = roundNum === 12 ? 3 : 2;
      const sequence: ColorType[] = [];
      for (let i = 0; i < seqLength; i++) {
        sequence.push(baseColors[Math.floor(Math.random() * baseColors.length)]);
      }
      const newObjs: GameObject[] = baseColors.map((c, idx) => ({
        id: `obj-${idx}`,
        color: c,
        colorName: COLOR_MAP[c].name,
        colorBg: COLOR_MAP[c].bg,
        colorBorder: COLOR_MAP[c].border,
        shape: "circle",
        topPct: shuffledPositions[idx].topPct,
        leftPct: shuffledPositions[idx].leftPct,
      }));
      const seqNames = sequence.map((c) => COLOR_MAP[c].name).join(" → ");
      const prompt = `Sequence: ${seqNames}`;
      setObjects(newObjs);
      setTargetPrompt(prompt);
      setTargetCriteria({ sequence, sequenceIndex: 0 });
      speakText(`Tap sequence: ${sequence.map((c) => COLOR_MAP[c].name).join(", then ")}`);
    }
  };

  const startFocusGame = () => {
    setStep("focus-game");
    setFocusRound(1);
    setTotalAttempts(0);
    setCorrectHits(0);
    setReactionTimes([]);
    generateFocusRound(1);
  };

  const handleObjectTap = (obj: GameObject) => {
    setTotalAttempts((prev) => prev + 1);

    if (targetCriteria.sequence) {
      const currentSeq = targetCriteria.sequence;
      const currentIndex = targetCriteria.sequenceIndex || 0;
      const expectedColor = currentSeq[currentIndex];

      if (obj.color === expectedColor) {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= currentSeq.length) {
          const reactionMs = Math.max(150, Date.now() - roundStartTimeRef.current);
          setReactionTimes((prev) => [...prev, reactionMs]);
          setCorrectHits((prev) => prev + 1);
          setFocusFeedback({ text: "Correct Sequence! 🎉", type: "success" });
          setTimeout(() => advanceFocusRound(), 600);
        } else {
          setTargetCriteria((prev) => ({ ...prev, sequenceIndex: nextIndex }));
          setFocusFeedback({ text: `Step ${nextIndex}/${currentSeq.length} Good!`, type: "success" });
        }
      } else {
        setFocusFeedback({ text: "Try again! Sequence reset", type: "error" });
        setTargetCriteria((prev) => ({ ...prev, sequenceIndex: 0 }));
      }
      return;
    }

    const isColorMatch = !targetCriteria.color || obj.color === targetCriteria.color;
    const isShapeMatch = !targetCriteria.shape || obj.shape === targetCriteria.shape;

    if (isColorMatch && isShapeMatch) {
      const reactionMs = Math.max(140, Date.now() - roundStartTimeRef.current);
      setReactionTimes((prev) => [...prev, reactionMs]);
      setCorrectHits((prev) => prev + 1);
      setFocusFeedback({ text: "Correct! 🎉", type: "success" });
      setTimeout(() => advanceFocusRound(), 500);
    } else {
      setFocusFeedback({ text: "Try again!", type: "error" });
    }
  };

  const advanceFocusRound = () => {
    if (focusRound >= 12) {
      finishFocusGame();
    } else {
      const nextR = focusRound + 1;
      setFocusRound(nextR);
      generateFocusRound(nextR);
    }
  };

  const finishFocusGame = () => {
    const avgReactMs =
      reactionTimes.length > 0
        ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
        : 380;
    const accuracyPct = Math.min(
      100,
      Math.max(10, Math.round((correctHits / Math.max(1, totalAttempts)) * 100))
    );

    const session = saveGameSession({
      gameId: "focus-target",
      accuracy: accuracyPct,
      reactionTimeMs: avgReactMs,
      completionRate: 100,
      difficultyLevel: "adaptive",
      durationSec: 120,
    });
    setFocusResultSession(session);

    if (gameModeParam === "focus-target") {
      const streakRes = recordDailyCompletion();
      setCompletionResult(streakRes);
      setStep("completed");
    } else {
      setStep("focus-complete");
    }
  };

  // -------------------------------------------------------------
  // RHYTHM TAP GAME LOGIC
  // -------------------------------------------------------------
  const startRhythmGame = () => {
    setStep("rhythm-game");
    setRhythmLevel(1);
    setCurrentBpm(60);
    currentBpmRef.current = 60;
    setTimingDeviations([]);
    setMissedBeats(0);
    setExtraTaps(0);
    setRhythmFeedback(null);
    lastBeatTimeRef.current = Date.now();
    hasTappedCurrentBeatRef.current = false;
    isSilentBeatRef.current = false;

    startCue("audio", 60);
    speakText("Rhythm Tap starting at 60 BPM. Tap in sync with the beat.");
  };

  useEffect(() => {
    if (step !== "rhythm-game" || beatCount === 0) return;

    if (beatCount > 1 && !hasTappedCurrentBeatRef.current && !isSilentBeatRef.current) {
      setMissedBeats((prev) => prev + 1);
    }

    lastBeatTimeRef.current = Date.now();
    hasTappedCurrentBeatRef.current = false;

    if (beatCount <= 12) {
      if (rhythmLevel !== 1) {
        setRhythmLevel(1);
        setCurrentBpm(60);
        currentBpmRef.current = 60;
        setEngineBpm(60);
      }
    } else if (beatCount <= 24) {
      if (rhythmLevel !== 2) {
        setRhythmLevel(2);
        setCurrentBpm(75);
        currentBpmRef.current = 75;
        setEngineBpm(75);
        speakText("Level 2: 75 BPM tempo shift");
      }
    } else if (beatCount <= 36) {
      if (rhythmLevel !== 3) {
        setRhythmLevel(3);
        speakText("Level 3: Dynamic tempo variation");
      }
      const dynamicBpm = beatCount % 2 === 0 ? 85 : 70;
      setCurrentBpm(dynamicBpm);
      currentBpmRef.current = dynamicBpm;
      setEngineBpm(dynamicBpm);
    } else if (beatCount <= 48) {
      if (rhythmLevel !== 4) {
        setRhythmLevel(4);
        speakText("Level 4: Keep internal rhythm during silent beats");
      }
      isSilentBeatRef.current = beatInBar === 3 || beatInBar === 4;
    } else {
      finishRhythmGame();
    }
  }, [beatCount, beatInBar, step, rhythmLevel, setEngineBpm]);

  const handleRhythmTap = () => {
    if (step !== "rhythm-game") return;

    const now = Date.now();
    const bpmVal = currentBpmRef.current;
    const intervalMs = (60 / bpmVal) * 1000;
    const elapsedSinceBeat = now - lastBeatTimeRef.current;

    let deviationSignedMs = 0;
    if (elapsedSinceBeat <= intervalMs / 2) {
      deviationSignedMs = elapsedSinceBeat;
    } else {
      deviationSignedMs = -(intervalMs - elapsedSinceBeat);
    }

    const absDevMs = Math.round(Math.abs(deviationSignedMs));

    if (hasTappedCurrentBeatRef.current) {
      setExtraTaps((prev) => prev + 1);
      setRhythmFeedback({
        text: "Extra Tap",
        sub: "Wait for next beat pulse",
        color: "bg-slate-800 border-slate-700 text-slate-300",
      });
      return;
    }

    hasTappedCurrentBeatRef.current = true;
    setTimingDeviations((prev) => [...prev, absDevMs]);

    if (absDevMs <= 35) {
      setRhythmFeedback({
        text: "On time! 🎯",
        sub: `${absDevMs}ms deviation`,
        color: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
      });
    } else if (deviationSignedMs < -35) {
      setRhythmFeedback({
        text: "A bit early ⚡",
        sub: `${absDevMs}ms ahead of beat`,
        color: "bg-blue-500/20 border-blue-500/50 text-blue-300",
      });
    } else {
      setRhythmFeedback({
        text: "A bit late ⏱️",
        sub: `${absDevMs}ms after beat`,
        color: "bg-amber-500/20 border-amber-500/50 text-amber-300",
      });
    }
  };

  const finishRhythmGame = () => {
    stopCue();

    const avgDevMs =
      timingDeviations.length > 0
        ? Math.round(timingDeviations.reduce((a, b) => a + b, 0) / timingDeviations.length)
        : 35;

    const rhythmAccuracy = Math.max(20, Math.min(100, Math.round(100 - avgDevMs * 0.95)));

    const rSession = saveGameSession({
      gameId: "rhythm-tap",
      accuracy: rhythmAccuracy,
      timingDeviationMs: avgDevMs,
      completionRate: 100,
      difficultyLevel: "adaptive",
      durationSec: 120,
    });
    setRhythmResultSession(rSession);

    if (gameModeParam === "rhythm-tap") {
      const streakResult = recordDailyCompletion();
      setCompletionResult(streakResult);
      setStep("completed");
    } else {
      // In full daily set -> move to Finger Piano intermediate completion screen!
      setStep("rhythm-complete");
    }
  };

  // -------------------------------------------------------------
  // FINGER PIANO — QUICK TAP GAME LOGIC (~6 sec total)
  // -------------------------------------------------------------
  const startFingerPianoGame = () => {
    setStep("piano-game");
    setUserPianoTaps([]);
    setPianoFeedbackText("");
    setPianoPhase("preview");
    setPianoProgressPct(0);
    setHighlightedKey(null);

    // Generate random 3-key sequence from keys 1..5
    const keys = [1, 2, 3, 4, 5];
    const seq = [
      keys[Math.floor(Math.random() * 5)],
      keys[Math.floor(Math.random() * 5)],
      keys[Math.floor(Math.random() * 5)],
    ];
    setPianoSequence(seq);

    speakText(`Memorize piano sequence: ${seq.join(", ")}, then tap the keys.`);

    // Animate key preview (~500ms per key)
    setTimeout(() => setHighlightedKey(seq[0]), 300);
    setTimeout(() => setHighlightedKey(seq[1]), 800);
    setTimeout(() => setHighlightedKey(seq[2]), 1300);
    setTimeout(() => {
      setHighlightedKey(null);
      setPianoPhase("input");
      pianoStartTimeRef.current = Date.now();
      pianoFirstTapTimeRef.current = 0;

      // Start quiet progress ring animation (~4 seconds input window)
      let elapsedMs = 0;
      const interval = setInterval(() => {
        elapsedMs += 100;
        const pct = Math.min(100, Math.round((elapsedMs / 4000) * 100));
        setPianoProgressPct(pct);
        if (elapsedMs >= 4000) {
          clearInterval(interval);
        }
      }, 100);
    }, 1800);
  };

  const handlePianoKeyTap = (keyNum: number) => {
    if (pianoPhase !== "input") return;

    if (pianoFirstTapTimeRef.current === 0) {
      pianoFirstTapTimeRef.current = Date.now();
    }

    const nextTaps = [...userPianoTaps, keyNum];
    setUserPianoTaps(nextTaps);

    if (nextTaps.length >= 3) {
      evaluatePianoGame(nextTaps);
    }
  };

  const evaluatePianoGame = (taps: number[]) => {
    setPianoPhase("feedback");

    const reactMs =
      pianoFirstTapTimeRef.current > 0
        ? Math.max(120, pianoFirstTapTimeRef.current - pianoStartTimeRef.current)
        : 380;

    let correctCount = 0;
    for (let i = 0; i < 3; i++) {
      if (taps[i] === pianoSequence[i]) {
        correctCount += 1;
      }
    }

    const accuracyPct = Math.round((correctCount / 3) * 100);

    const session = saveGameSession({
      gameId: "finger-piano",
      accuracy: accuracyPct,
      reactionTimeMs: reactMs,
      completionRate: 100,
      difficultyLevel: "adaptive",
      durationSec: 6,
    });
    setPianoResultSession(session);

    if (accuracyPct === 100) {
      setPianoFeedbackText("Correct! 🎹 Perfect 3-key sequence.");
    } else {
      setPianoFeedbackText(
        `Not quite — sequence was ${pianoSequence.join(" → ")} (${correctCount}/3 correct)`
      );
    }

    // Call recordDailyCompletion() NOW as all 3 games in the daily set are complete!
    setTimeout(() => {
      const streakResult = recordDailyCompletion();
      setCompletionResult(streakResult);
      setStep("completed");
    }, 1400);
  };

  const handleExit = () => {
    stopCue();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    router.push("/games");
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Preparing Game Arena...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 flex flex-col justify-between max-w-lg mx-auto text-left relative overflow-hidden">
      {/* TOP HEADER & EXIT BAR */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 z-20">
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          aria-label="Exit Game"
        >
          <X className="w-4 h-4 text-slate-400" />
          <span>Exit</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              voiceEnabled
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
            title={voiceEnabled ? "Voice prompts ON" : "Voice prompts OFF"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* STEP: INTRO */}
      {step === "intro" && (
        <div className="space-y-6 my-auto text-center z-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mx-auto shadow-xl">
            <Target className="w-8 h-8 text-white" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Daily Brain &amp; Movement Session
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-sm mx-auto">
              3 quick micro-challenges testing visual reaction speed, metronome entrainment, and finger sequence recall (~4 mins total).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">1. Focus Target</h3>
                <p className="text-xs text-slate-400">Visual search &amp; sequence memory</p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-800/80 pt-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">2. Rhythm Tap</h3>
                <p className="text-xs text-slate-400">Auditory beat pacing entrainment</p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-800/80 pt-3">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <Piano className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">3. Finger Piano</h3>
                <p className="text-xs text-slate-400">Quick 6-sec 3-key sequence recall</p>
              </div>
            </div>
          </div>

          <button
            onClick={startFocusGame}
            className="w-full min-h-[56px] py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Begin Daily Session</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* STEP: FOCUS TARGET GAMEPLAY */}
      {step === "focus-game" && (
        <div className="space-y-4 my-auto flex flex-col justify-between z-10 flex-1">
          <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-400 block">
                Level {focusRound <= 3 ? 1 : focusRound <= 6 ? 2 : focusRound <= 9 ? 3 : 4}
              </span>
              <h2 className="text-base font-black text-white">{targetPrompt}</h2>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Round</span>
              <span className="text-lg font-black text-indigo-300">{focusRound} / 12</span>
            </div>
          </div>

          {focusFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                focusFeedback.type === "success"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-300"
              }`}
            >
              {focusFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{focusFeedback.text}</span>
            </div>
          )}

          <div className="relative w-full h-[360px] bg-slate-950 rounded-3xl border-2 border-indigo-500/30 overflow-hidden shadow-2xl">
            {objects.map((obj) => {
              const shapeClass =
                obj.shape === "circle"
                  ? "rounded-full"
                  : obj.shape === "square"
                  ? "rounded-2xl"
                  : "rotate-45 rounded-xl";

              return (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => handleObjectTap(obj)}
                  style={{ top: `${obj.topPct}%`, left: `${obj.leftPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[72px] min-h-[72px] w-20 h-20 ${obj.colorBg} border-4 ${obj.colorBorder} ${shapeClass} shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer transition-transform z-10`}
                  aria-label={`${obj.colorName} ${obj.shape}`}
                >
                  <span
                    className={`text-xs font-black text-white drop-shadow-md ${
                      obj.shape === "diamond" ? "-rotate-45" : ""
                    }`}
                  >
                    {obj.colorName}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-400 pt-1">
            Tap objects matching the instruction above
          </p>
        </div>
      )}

      {/* STEP: FOCUS COMPLETE */}
      {step === "focus-complete" && focusResultSession && (
        <div className="space-y-6 my-auto text-center z-10">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white">Focus Target Complete!</h2>
            <p className="text-xs text-slate-300 mt-1">12 rounds evaluated successfully</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Accuracy</span>
              <span className="text-2xl font-black text-emerald-400">{focusResultSession.accuracy}%</span>
            </div>
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Avg Reaction</span>
              <span className="text-2xl font-black text-indigo-400">{focusResultSession.reactionTimeMs} ms</span>
            </div>
          </div>

          <button
            onClick={startRhythmGame}
            className="w-full min-h-[52px] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Continue to Phase 2: Rhythm Tap</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* STEP: RHYTHM TAP GAME */}
      {step === "rhythm-game" && (
        <div className="space-y-4 my-auto flex flex-col justify-between z-10 flex-1">
          <div className="flex items-center justify-between bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] uppercase font-bold text-blue-400">
                  Level {rhythmLevel} • {currentBpm} BPM
                </span>
              </div>
              <h2 className="text-sm font-bold text-white mt-0.5">
                {rhythmLevel === 1 && "Steady 60 BPM Pacing"}
                {rhythmLevel === 2 && "Accelerated 75 BPM Pacing"}
                {rhythmLevel === 3 && "Dynamic Tempo Variation"}
                {rhythmLevel === 4 && "Internal Rhythm Retention"}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block">Beat</span>
              <span className="text-lg font-black text-blue-300">{beatCount} / 48</span>
            </div>
          </div>

          {rhythmFeedback ? (
            <div
              className={`p-3 rounded-2xl border text-center transition-all animate-fadeIn ${rhythmFeedback.color}`}
            >
              <span className="text-sm font-black block">{rhythmFeedback.text}</span>
              <span className="text-[10px] font-medium opacity-90">{rhythmFeedback.sub}</span>
            </div>
          ) : (
            <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/60 text-center text-slate-400 text-xs font-medium">
              Listen to the cue beat and tap in sync...
            </div>
          )}

          <button
            type="button"
            onClick={handleRhythmTap}
            className="w-full h-80 rounded-3xl bg-slate-950 border-2 border-blue-500/40 p-6 flex flex-col items-center justify-between shadow-2xl active:bg-blue-950/40 cursor-pointer transition-all relative overflow-hidden group"
          >
            <div className="w-full flex items-center justify-center gap-3 mt-4">
              {[1, 2, 3, 4].map((barNum) => (
                <div
                  key={barNum}
                  className={`h-3 rounded-full transition-all duration-150 ${
                    beatInBar === barNum
                      ? "w-10 bg-blue-400 shadow-lg shadow-blue-500/50 scale-110"
                      : "w-4 bg-slate-800"
                  }`}
                />
              ))}
            </div>

            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 group-active:scale-95 shadow-2xl border-4 border-blue-400/60 flex flex-col items-center justify-center transition-transform">
              <Zap className="w-10 h-10 text-white animate-pulse" />
              <span className="text-xs font-black text-white mt-1 uppercase tracking-wider">
                TAP HERE
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-[11px] mb-2 font-medium">
              <span>Missed: {missedBeats}</span>
              <span>•</span>
              <span>Extra: {extraTaps}</span>
            </div>
          </button>
        </div>
      )}

      {/* STEP: RHYTHM COMPLETE */}
      {step === "rhythm-complete" && rhythmResultSession && (
        <div className="space-y-6 my-auto text-center z-10">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-xl">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white">Rhythm Tap Complete!</h2>
            <p className="text-xs text-slate-300 mt-1">48-beat entrainment evaluated</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consistency</span>
              <span className="text-2xl font-black text-blue-400">{rhythmResultSession.accuracy}%</span>
            </div>
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Avg Deviation</span>
              <span className="text-2xl font-black text-indigo-400">{rhythmResultSession.timingDeviationMs} ms</span>
            </div>
          </div>

          <button
            onClick={startFingerPianoGame}
            className="w-full min-h-[52px] py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Continue to Phase 3: Finger Piano (Quick, 6 sec)</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* STEP: FINGER PIANO — QUICK TAP GAME (~6 SEC TOTAL) */}
      {step === "piano-game" && (
        <div className="space-y-5 my-auto flex flex-col justify-between z-10 flex-1">
          <div className="flex items-center justify-between bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Piano className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] uppercase font-bold text-purple-400">
                  Finger Piano • Quick 6 sec
                </span>
              </div>
              <h2 className="text-sm font-bold text-white mt-0.5">
                {pianoPhase === "preview" && "Memorize the 3-key sequence"}
                {pianoPhase === "input" && "Tap the 3 keys in order"}
                {pianoPhase === "feedback" && "Evaluating sequence..."}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-purple-300">
              {userPianoTaps.length} / 3 Taps
            </span>
          </div>

          {/* Quiet Non-Stressful Progress Bar */}
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-100"
              style={{ width: `${pianoProgressPct}%` }}
            />
          </div>

          {/* Sequence Preview Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            {pianoPhase === "preview" ? (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Sequence Display
                </span>
                <div className="text-2xl font-black text-purple-400 tracking-widest font-mono">
                  {pianoSequence.join(" → ")}
                </div>
              </div>
            ) : pianoPhase === "input" ? (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Your Entered Taps
                </span>
                <div className="text-2xl font-black text-white tracking-widest font-mono">
                  {userPianoTaps.length > 0 ? userPianoTaps.join(" → ") : "— — —"}
                </div>
              </div>
            ) : (
              <div className="text-sm font-bold text-emerald-300">{pianoFeedbackText}</div>
            )}
          </div>

          {/* 5 LARGE NUMBERED PIANO KEYS */}
          <div className="grid grid-cols-5 gap-2.5 pt-2">
            {[1, 2, 3, 4, 5].map((keyNum) => {
              const isHighlighted = highlightedKey === keyNum;

              return (
                <button
                  key={keyNum}
                  type="button"
                  onClick={() => handlePianoKeyTap(keyNum)}
                  disabled={pianoPhase !== "input"}
                  className={`min-h-[110px] h-36 rounded-2xl border-2 flex flex-col items-center justify-between p-3 font-mono text-xl font-black shadow-xl transition-all cursor-pointer ${
                    isHighlighted
                      ? "bg-purple-500 border-purple-300 text-white scale-105 shadow-purple-500/50"
                      : pianoPhase === "input"
                      ? "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-purple-400 active:scale-95"
                      : "bg-slate-900/50 border-slate-800 text-slate-500 opacity-80"
                  }`}
                >
                  <span className="text-2xl mt-2">{keyNum}</span>
                  <div className={`w-3 h-3 rounded-full ${isHighlighted ? "bg-white animate-ping" : "bg-slate-800"}`} />
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-400 pt-1">
            Tap keys 1 through 5 matching the memorized sequence
          </p>
        </div>
      )}

      {/* STEP: COMPLETED END-OF-SESSION SUMMARY */}
      {step === "completed" && (
        <div className="space-y-5 my-auto text-left z-10">
          <div className="p-6 rounded-3xl bg-slate-900 border-2 border-emerald-400/80 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">🎉 Session Complete!</h2>
                <p className="text-xs text-emerald-300">Daily cognitive &amp; rhythmic set completed</p>
              </div>
            </div>

            {/* STREAK FREEZE / ADVANCE BANNER */}
            {completionResult && (
              <>
                {completionResult.freezeUsed && (
                  <div className="p-3 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center gap-2.5 text-blue-300 text-xs font-semibold">
                    <Snowflake className="w-4 h-4 shrink-0 text-blue-400 animate-spin" />
                    <span>Streak Freeze Used! Your {completionResult.streakState.currentStreak}-day streak was saved.</span>
                  </div>
                )}

                {completionResult.resetOccurred && (
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
                    Welcome back! Streak reset to 1 day. Keep going!
                  </div>
                )}

                {!completionResult.freezeUsed && !completionResult.resetOccurred && (
                  <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>🔥 {completionResult.streakState.currentStreak} Day Streak Achieved!</span>
                  </div>
                )}
              </>
            )}

            {/* Metrics Breakdown Grid (3 Micro-Games) */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {focusResultSession && (
                <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Focus</span>
                  <span className="text-lg font-black text-emerald-400">{focusResultSession.accuracy}%</span>
                  <span className="text-[9px] text-slate-400 block pt-0.5">{focusResultSession.reactionTimeMs}ms</span>
                </div>
              )}

              {rhythmResultSession && (
                <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Rhythm</span>
                  <span className="text-lg font-black text-blue-400">{rhythmResultSession.accuracy}%</span>
                  <span className="text-[9px] text-slate-400 block pt-0.5">{rhythmResultSession.timingDeviationMs}ms</span>
                </div>
              )}

              {pianoResultSession && (
                <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Piano</span>
                  <span className="text-lg font-black text-purple-400">{pianoResultSession.accuracy}%</span>
                  <span className="text-[9px] text-slate-400 block pt-0.5">{pianoResultSession.reactionTimeMs}ms</span>
                </div>
              )}
            </div>

            {/* Session Stats (Duration & Monthly Count) */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Duration: ~4 min total</span>
              </div>
              {completionResult && (
                <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                  <CalendarCheck className="w-4 h-4 text-emerald-400" />
                  <span>You&apos;ve completed {completionResult.streakState.monthlyCompletedDays.length} sessions this month.</span>
                </div>
              )}
            </div>

            {/* Strictly Non-Diagnostic Disclaimer */}
            <p className="text-[11px] text-slate-400 text-center italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              Your game performance was compared with your personal baseline.
            </p>

            <button
              onClick={() => router.push("/games")}
              className="w-full min-h-[48px] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer"
            >
              Return to Games Hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GameSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] text-slate-100 p-6 flex items-center justify-center">
          <div className="text-slate-400 text-sm">Loading Daily Game Session...</div>
        </div>
      }
    >
      <GameSessionContent />
    </Suspense>
  );
}
