/**
 * STEADY Daily Brain & Movement Module
 * Lightweight cognition & rhythm entrainment games with streak protection logic.
 */

export type GameId = "focus-target" | "rhythm-tap" | "finger-piano";

export interface GameSession {
  id: string;
  gameId: GameId;
  timestamp: string; // ISO string
  accuracy: number; // 0-100%
  reactionTimeMs?: number;
  timingDeviationMs?: number;
  completionRate: number; // 0-100%
  difficultyLevel: "easy" | "medium" | "adaptive";
  durationSec: number;
  source: "user" | "seed";
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  streakFreezesAvailable: number;
  lastSessionDate: string; // YYYY-MM-DD
  monthlyCompletedDays: string[]; // array of YYYY-MM-DD
  lastFreezeUsedDate?: string;
  welcomeBackTriggered?: boolean;
}

const SESSIONS_KEY = "steady_game_sessions";
const STREAK_KEY = "steady_streak_state";

/**
 * Seed data generator for 10 days of realistic sessions and 7-day streak + 1 missed day
 */
function getDefaultSeedData(): { sessions: GameSession[]; streak: StreakState } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Helper to format date offset from today
  const getDateStr = (offsetDays: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split("T")[0];
  };

  // Completed days: 7 days streak (Day 8 to Day 2 ago) with Day 1 ago missed
  // Day 0 = Today (pending)
  // Day 1 = Yesterday (missed -> trigger streak freeze demo!)
  // Day 2..8 = 7 consecutive active days (Sept 18..Sept 24)
  // Day 9..10 = earlier history
  const activeDays = [
    getDateStr(8),
    getDateStr(7),
    getDateStr(6),
    getDateStr(5),
    getDateStr(4),
    getDateStr(3),
    getDateStr(2),
  ];

  const sessions: GameSession[] = [];

  // Seed 10 sessions for focus-target
  const focusAccuracies = [82, 85, 88, 86, 91, 89, 94, 92, 90, 95];
  const reactionTimes = [380, 365, 350, 355, 335, 340, 320, 315, 325, 310];

  // Seed 10 sessions for rhythm-tap
  const rhythmAccuracies = [80, 84, 86, 87, 90, 88, 93, 91, 89, 94];
  const timingDeviations = [45, 40, 38, 35, 30, 32, 28, 26, 29, 24];

  // Seed 10 sessions for finger-piano
  const pianoAccuracies = [67, 100, 67, 100, 100, 100, 67, 100, 100, 100];
  const pianoReactionTimes = [420, 390, 380, 360, 340, 350, 320, 310, 300, 290];

  for (let i = 0; i < 10; i++) {
    const dayStr = getDateStr(i + 1); // 1 to 10 days ago
    const isoTimestamp = new Date(dayStr + "T10:15:00.000Z").toISOString();

    // Focus Target session
    sessions.push({
      id: `seed-focus-${i}`,
      gameId: "focus-target",
      timestamp: isoTimestamp,
      accuracy: focusAccuracies[i],
      reactionTimeMs: reactionTimes[i],
      completionRate: 100,
      difficultyLevel: "adaptive",
      durationSec: 120,
      source: "seed",
    });

    // Rhythm Tap session
    sessions.push({
      id: `seed-rhythm-${i}`,
      gameId: "rhythm-tap",
      timestamp: isoTimestamp,
      accuracy: rhythmAccuracies[i],
      timingDeviationMs: timingDeviations[i],
      completionRate: 100,
      difficultyLevel: "adaptive",
      durationSec: 120,
      source: "seed",
    });

    // Finger Piano session
    sessions.push({
      id: `seed-piano-${i}`,
      gameId: "finger-piano",
      timestamp: isoTimestamp,
      accuracy: pianoAccuracies[i],
      reactionTimeMs: pianoReactionTimes[i],
      completionRate: 100,
      difficultyLevel: "adaptive",
      durationSec: 6,
      source: "seed",
    });
  }

  const streak: StreakState = {
    currentStreak: 7,
    longestStreak: 12,
    streakFreezesAvailable: 1,
    lastSessionDate: getDateStr(2), // Missed yesterday (getDateStr(1)), so freeze will be used on next completion!
    monthlyCompletedDays: [
      getDateStr(10),
      getDateStr(9),
      ...activeDays,
    ],
  };

  return { sessions, streak };
}

/**
 * Get all game sessions safely (localStorage, loaded after mount)
 */
export function getGameSessions(gameId?: GameId): GameSession[] {
  if (typeof window === "undefined") {
    return getDefaultSeedData().sessions;
  }

  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) {
      const seed = getDefaultSeedData();
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(seed.sessions));
      localStorage.setItem(STREAK_KEY, JSON.stringify(seed.streak));
      return gameId ? seed.sessions.filter((s) => s.gameId === gameId) : seed.sessions;
    }
    const parsed: GameSession[] = JSON.parse(raw);
    return gameId ? parsed.filter((s) => s.gameId === gameId) : parsed;
  } catch (e) {
    console.error("Error reading game sessions", e);
    return [];
  }
}

/**
 * Save a new game session to localStorage
 */
export function saveGameSession(
  sessionData: Omit<GameSession, "id" | "timestamp" | "source">
): GameSession {
  const newSession: GameSession = {
    ...sessionData,
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    source: "user",
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getGameSessions();
      const updated = [newSession, ...existing];
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving game session", e);
    }
  }

  return newSession;
}

/**
 * Get current streak state safely
 */
export function getStreakState(): StreakState {
  if (typeof window === "undefined") {
    return getDefaultSeedData().streak;
  }

  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) {
      const seed = getDefaultSeedData();
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(seed.sessions));
      localStorage.setItem(STREAK_KEY, JSON.stringify(seed.streak));
      return seed.streak;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading streak state", e);
    return getDefaultSeedData().streak;
  }
}

/**
 * Record daily completion and handle streak freeze / reset logic
 */
export function recordDailyCompletion(): {
  streakState: StreakState;
  freezeUsed: boolean;
  resetOccurred: boolean;
} {
  const current = getStreakState();
  const todayStr = new Date().toISOString().split("T")[0];

  if (current.lastSessionDate === todayStr) {
    return { streakState: current, freezeUsed: false, resetOccurred: false };
  }

  const lastDate = new Date(current.lastSessionDate);
  const today = new Date(todayStr);
  const diffTime = Math.abs(today.getTime() - lastDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let freezeUsed = false;
  let resetOccurred = false;
  let updatedStreak = current.currentStreak;
  let freezesAvailable = current.streakFreezesAvailable;

  if (diffDays === 1) {
    // Completed yesterday -> increment streak
    updatedStreak += 1;
  } else if (diffDays === 2) {
    // Missed 1 day (yesterday)! Check if streak freeze is available
    if (freezesAvailable > 0) {
      freezesAvailable -= 1;
      updatedStreak += 1; // Preserve and advance streak
      freezeUsed = true;
    } else {
      updatedStreak = 1;
      resetOccurred = true;
    }
  } else {
    // Missed multiple days -> reset streak to 1
    updatedStreak = 1;
    resetOccurred = true;
  }

  const newLongest = Math.max(current.longestStreak, updatedStreak);
  const updatedMonthly = current.monthlyCompletedDays.includes(todayStr)
    ? current.monthlyCompletedDays
    : [...current.monthlyCompletedDays, todayStr];

  const updatedState: StreakState = {
    currentStreak: updatedStreak,
    longestStreak: newLongest,
    streakFreezesAvailable: freezesAvailable,
    lastSessionDate: todayStr,
    monthlyCompletedDays: updatedMonthly,
    lastFreezeUsedDate: freezeUsed ? todayStr : current.lastFreezeUsedDate,
    welcomeBackTriggered: resetOccurred,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(updatedState));
    } catch (e) {
      console.error("Error saving streak state", e);
    }
  }

  return { streakState: updatedState, freezeUsed, resetOccurred };
}

/**
 * Calculate personal baseline from last 10 sessions
 */
export function getPersonalBaseline(gameId: GameId) {
  const sessions = getGameSessions(gameId);
  const last10 = sessions.slice(0, 10);

  if (last10.length === 0) {
    return {
      meanAccuracy: 88,
      meanReactionTimeMs: 330,
      meanTimingDeviationMs: 30,
    };
  }

  const meanAccuracy = Math.round(
    last10.reduce((acc, s) => acc + s.accuracy, 0) / last10.length
  );

  const reactionSessions = last10.filter((s) => s.reactionTimeMs !== undefined);
  const meanReactionTimeMs =
    reactionSessions.length > 0
      ? Math.round(
          reactionSessions.reduce((acc, s) => acc + (s.reactionTimeMs || 0), 0) /
            reactionSessions.length
        )
      : undefined;

  const timingSessions = last10.filter((s) => s.timingDeviationMs !== undefined);
  const meanTimingDeviationMs =
    timingSessions.length > 0
      ? Math.round(
          timingSessions.reduce((acc, s) => acc + (s.timingDeviationMs || 0), 0) /
            timingSessions.length
        )
      : undefined;

  return {
    meanAccuracy,
    meanReactionTimeMs,
    meanTimingDeviationMs,
  };
}
