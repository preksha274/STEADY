"use client";

export interface CueResult {
  id: string;
  timestamp: string; // ISO string
  type: "audio" | "vibration" | "visual";
  bpm: number;
  responseScore: number;
  meanCadence: number;
  sync: number;
  simulated: boolean;
  source?: "user" | "seed";
  isPersonalized?: boolean;
  baselineCadence?: number | null;
}

const HISTORY_STORAGE_KEY = "movepilot_cue_history";
const ACTIVE_CUE_STORAGE_KEY = "movepilot_active_cue";

/**
 * Seed 4 past cue results with a slowly declining response score for the same audio cue.
 * Best = 86 (10 days ago), then 80 (7 days ago), 74 (4 days ago), 68 (1 day ago).
 * Drop from best (86) to latest (68) is (86 - 68) / 86 = 20.9% (>= 15%), triggering cue fatigue.
 */
export function seedDemoCues(): CueResult[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const demoResults: CueResult[] = [
    {
      id: "cue-seed-1",
      timestamp: new Date(now - 10 * dayMs).toISOString(),
      type: "audio",
      bpm: 88,
      responseScore: 86,
      meanCadence: 88,
      sync: 90,
      simulated: true,
      source: "seed",
      isPersonalized: true,
      baselineCadence: 88,
    },
    {
      id: "cue-seed-2",
      timestamp: new Date(now - 7 * dayMs).toISOString(),
      type: "audio",
      bpm: 88,
      responseScore: 80,
      meanCadence: 86,
      sync: 84,
      simulated: true,
      source: "seed",
      isPersonalized: true,
      baselineCadence: 88,
    },
    {
      id: "cue-seed-3",
      timestamp: new Date(now - 4 * dayMs).toISOString(),
      type: "audio",
      bpm: 88,
      responseScore: 74,
      meanCadence: 84,
      sync: 78,
      simulated: true,
      source: "seed",
      isPersonalized: true,
      baselineCadence: 88,
    },
    {
      id: "cue-seed-4",
      timestamp: new Date(now - 1 * dayMs).toISOString(),
      type: "audio",
      bpm: 88,
      responseScore: 68,
      meanCadence: 82,
      sync: 72,
      simulated: true,
      source: "seed",
      isPersonalized: true,
      baselineCadence: 88,
    },
  ];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(demoResults));
      localStorage.setItem(ACTIVE_CUE_STORAGE_KEY, JSON.stringify(demoResults[3]));
      localStorage.setItem(
        "movepilot_saved_cue",
        JSON.stringify({ type: demoResults[3].type, bpm: demoResults[3].bpm })
      );
    } catch (e) {
      console.error("Failed to seed demo cues", e);
    }
  }

  return demoResults;
}

/**
 * Fetch cue history from localStorage, seeding if empty.
 */
export function getCueHistory(isDemoMode: boolean = false): CueResult[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return seedDemoCues();
    }
    const parsed: CueResult[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return seedDemoCues();
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load cue history", e);
    return seedDemoCues();
  }
}

/**
 * Save a new cue test result to history and set it as active cue.
 */
export function saveCueResult(
  data: Omit<CueResult, "id" | "timestamp">
): CueResult {
  const newResult: CueResult = {
    ...data,
    id: `cue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const history = getCueHistory();
      const updated = [...history, newResult];
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      setActiveCue(newResult);
    } catch (e) {
      console.error("Failed to save cue result", e);
    }
  }

  return newResult;
}

/**
 * Get the current active winning cue chosen by the user.
 */
export function getActiveCue(isDemoMode: boolean = false): CueResult | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(ACTIVE_CUE_STORAGE_KEY);
    if (raw) {
      const parsed: CueResult = JSON.parse(raw);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to get active cue", e);
  }

  const history = getCueHistory(isDemoMode);
  if (history.length > 0) {
    return history[history.length - 1];
  }

  // Default fallback cue
  return {
    id: "default-cue",
    timestamp: new Date().toISOString(),
    type: "audio",
    bpm: 88,
    responseScore: 80,
    meanCadence: 88,
    sync: 85,
    simulated: true,
    source: "seed",
  };
}

/**
 * Set a cue result as the active cue.
 */
export function setActiveCue(cue: CueResult): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(ACTIVE_CUE_STORAGE_KEY, JSON.stringify(cue));
    localStorage.setItem(
      "movepilot_saved_cue",
      JSON.stringify({ type: cue.type, bpm: cue.bpm })
    );
  } catch (e) {
    console.error("Failed to set active cue", e);
  }
}

/**
 * Clear cue history and active cue.
 */
export function clearCueHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_CUE_STORAGE_KEY);
  localStorage.removeItem("movepilot_saved_cue");
}

export interface CueCalibrationResult {
  vibrationIntensity: "low" | "medium" | "high";
  rhythm: string;
  canFeel: boolean;
  isComfortable: boolean;
  perceptionThresholdMet: boolean;
  recommendAudio: boolean;
  updatedAt: string;
}

export type CueSessionFeedback = "helped" | "no_effect" | "annoying";

const CALIBRATION_KEY = "steady_cue_calibration";
const FEEDBACK_LOG_KEY = "steady_cue_feedback_log";

export function saveCueCalibration(data: Omit<CueCalibrationResult, "updatedAt" | "perceptionThresholdMet" | "recommendAudio">): CueCalibrationResult {
  const recommendAudio = !data.canFeel || !data.isComfortable;
  const result: CueCalibrationResult = {
    ...data,
    perceptionThresholdMet: data.canFeel && data.isComfortable,
    recommendAudio,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(result));
    } catch (e) {
      console.error("Failed to save cue calibration", e);
    }
  }
  return result;
}

export function getCueCalibration(): CueCalibrationResult {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CALIBRATION_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }
  return {
    vibrationIntensity: "medium",
    rhythm: "100 BPM Metronome",
    canFeel: true,
    isComfortable: true,
    perceptionThresholdMet: true,
    recommendAudio: false,
    updatedAt: new Date().toISOString(),
  };
}

export function logCueFeedback(feedback: CueSessionFeedback): CueSessionFeedback[] {
  if (typeof window === "undefined") return [feedback];

  try {
    const raw = localStorage.getItem(FEEDBACK_LOG_KEY);
    const existing: CueSessionFeedback[] = raw ? JSON.parse(raw) : [];
    const updated = [...existing, feedback];
    localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(updated));

    return updated;
  } catch (e) {
    return [feedback];
  }
}

export function getCueFeedbackLog(): CueSessionFeedback[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FEEDBACK_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export interface CuePolicyState {
  action: "cue_active" | "suggest_switch" | "abstain";
  currentModality: "audio" | "vibration" | "visual";
  suggestedModality?: "audio" | "vibration" | "visual";
  reason: string;
  hasFatigue: boolean;
  dropPercent: number;
  noResponseDetected: boolean;
  activeCue: CueResult | null;
}

export function getCuePolicyState(isDemoMode: boolean = false): CuePolicyState {

  const activeCue = getActiveCue(isDemoMode);
  const history = getCueHistory(isDemoMode);
  const currentModality = activeCue?.type || "audio";

  const fatigueInfo = hasCueFatigue(isDemoMode);
  const feedbackLog = getCueFeedbackLog();

  // Non-responder check: 3 consecutive "no_effect" or "annoying" responses
  const recentFeedback = feedbackLog.slice(-3);
  const isNonResponder =
    recentFeedback.length >= 3 &&
    recentFeedback.every((f) => f === "no_effect" || f === "annoying");

  // Check if all recent session scores are below threshold (< 50 response score)
  const recentSessions = history.slice(-5);
  const avgResponse =
    recentSessions.length > 0
      ? recentSessions.reduce((acc, s) => acc + s.responseScore, 0) / recentSessions.length
      : 80;

  const noResponseDetected = isNonResponder || (recentSessions.length >= 3 && avgResponse < 50);

  // Next modality rotation mapping
  const modalityRotation: Record<"audio" | "vibration" | "visual", "audio" | "vibration" | "visual"> = {
    audio: "vibration",
    vibration: "visual",
    visual: "audio",
  };

  if (noResponseDetected) {
    return {
      action: "abstain",
      currentModality,
      reason: isNonResponder
        ? "Cueing paused by policy due to repeated non-response / discomfort feedback. Re-calibrate in Cue Lab before resuming."
        : "Cueing doesn't appear to be helping during this session. Policy recommends taking a resting break without automatic cueing.",
      hasFatigue: fatigueInfo.isFatigued,
      dropPercent: fatigueInfo.dropPercent,
      noResponseDetected: true,
      activeCue,
    };
  }


  if (fatigueInfo.isFatigued) {
    const suggestedModality = modalityRotation[currentModality];
    return {
      action: "suggest_switch",
      currentModality,
      suggestedModality,
      reason: `Response to ${currentModality.toUpperCase()} pacing has dropped ${fatigueInfo.dropPercent}% due to motor habituation. Policy recommends switching to ${suggestedModality.toUpperCase()} pacing.`,
      hasFatigue: true,
      dropPercent: fatigueInfo.dropPercent,
      noResponseDetected: false,
      activeCue,
    };
  }

  return {
    action: "cue_active",
    currentModality,
    reason: `Response-aware policy active. ${currentModality.toUpperCase()} pacing calibrated to ${activeCue?.bpm || 88} BPM with ${activeCue?.sync || 85}% gait sync.`,
    hasFatigue: false,
    dropPercent: 0,
    noResponseDetected: false,
    activeCue,
  };
}

export type FogSubtype = "trembling" | "akinetic" | "unsure";

export interface TurningCuePolicyOptions {
  allowVisualForTurning: boolean;
  fogSubtype?: FogSubtype;
}

/**
 * Turning Cue Policy Evaluator:
 * Audio/Haptic is offered by default for turning or freezing during turns.
 * Visual cues are NOT offered for turning by default unless user explicitly opts in.
 */
export function getTurningCueRecommendation(
  modality: "audio" | "vibration" | "visual",
  options: TurningCuePolicyOptions = { allowVisualForTurning: false }
): { recommendedModality: "audio" | "vibration" | "visual"; warning?: string } {
  if (modality === "visual" && !options.allowVisualForTurning) {
    return {
      recommendedModality: "vibration",
      warning: "Visual line cues are disabled by default during turning for safety. Recommended Audio or Haptic pacing, or opt in to visual cues in Cue Lab settings.",
    };
  }

  if (options.fogSubtype === "akinetic" && modality === "audio") {
    return {
      recommendedModality: "vibration",
      warning: "Akinetic freezing responds best to high-amplitude haptic vibration over audio beat.",
    };
  }

  return { recommendedModality: modality };
}

/**
 * Cue fatigue logic:
 * Checks if the last 3 or more uses of the active cue show a response score
 * dropping by at least 15% from its best score among those uses.
 */
export function hasCueFatigue(isDemoMode: boolean = false): {
  isFatigued: boolean;
  dropPercent: number;
  currentCue: CueResult | null;
} {
  const activeCue = getActiveCue(isDemoMode);
  if (!activeCue) {
    return { isFatigued: false, dropPercent: 0, currentCue: null };
  }

  const history = getCueHistory(isDemoMode);
  const sameTypeUses = history.filter((item) => item.type === activeCue.type);

  if (sameTypeUses.length < 3) {
    return { isFatigued: false, dropPercent: 0, currentCue: activeCue };
  }

  const recentUses = sameTypeUses.slice(-4);
  const bestScore = Math.max(...recentUses.map((u) => u.responseScore));
  const latestScore = recentUses[recentUses.length - 1].responseScore;

  if (bestScore <= 0) {
    return { isFatigued: false, dropPercent: 0, currentCue: activeCue };
  }

  const dropPercent = Math.round(((bestScore - latestScore) / bestScore) * 100);

  return {
    isFatigued: dropPercent >= 15,
    dropPercent,
    currentCue: activeCue,
  };
}

