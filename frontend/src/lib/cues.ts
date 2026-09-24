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
  // Find all past uses for the active cue's type
  const sameTypeUses = history.filter((item) => item.type === activeCue.type);

  if (sameTypeUses.length < 3) {
    return { isFatigued: false, dropPercent: 0, currentCue: activeCue };
  }

  // Get last 3 (or more) uses
  const recentUses = sameTypeUses.slice(-4); // take up to last 4
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
