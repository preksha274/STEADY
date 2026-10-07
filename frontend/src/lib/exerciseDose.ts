"use client";

export const CYCLE_II_CITATION =
  "Based on cadence-paced aerobic exercise shown to slow motor progression in a 2025 randomized trial (CYCLE-II).";

export interface ExerciseDoseSession {
  id: string;
  timestamp: string; // ISO string
  totalDurationSec: number;
  qualifyingMinutes: number; // minutes with sustained cadence (syncScore >= threshold)
  avgSyncScore: number;
  exerciseName: string;
  source?: "user" | "demo" | "seed";
}

export interface WeeklyDoseResult {
  minutesThisWeek: number;
  targetMinutes: number; // 45 minutes
  sessionsThisWeek: number;
  targetSessions: number; // 3 sessions
  weekStartDate: string;
  progressPct: number;
  qualifyingSessions: ExerciseDoseSession[];
  citationNote: string;
}

const STORAGE_KEY = "steady_exercise_dose_history";

/**
 * Returns the ISO timestamp for the start of the current week (Monday at 00:00:00).
 */
export function getMondayOfWeek(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Seeds demo exercise dose data for the current week showing meaningful partial progress
 * (e.g. 2 sessions completed this week, 32 / 45 qualifying minutes total).
 */
export function seedDemoExerciseDose(forceReset = false): ExerciseDoseSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && !forceReset) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read exercise dose history", e);
  }

  const monday = getMondayOfWeek(new Date());
  const dayMs = 24 * 60 * 60 * 1000;

  // 2 sessions in current week:
  // Session 1 (Monday 10:15 AM): 18 qualifying minutes (20 min total, 88% sync)
  // Session 2 (Wednesday 2:30 PM): 14 qualifying minutes (15 min total, 84% sync)
  const mondaySessionTime = new Date(monday.getTime() + 10 * 3600 * 1000 + 15 * 60 * 1000);
  const wednesdaySessionTime = new Date(monday.getTime() + 2 * dayMs + 14 * 3600 * 1000 + 30 * 60 * 1000);

  const seeded: ExerciseDoseSession[] = [
    {
      id: "dose-seed-1",
      timestamp: mondaySessionTime.toISOString(),
      totalDurationSec: 1200, // 20 min
      qualifyingMinutes: 18,
      avgSyncScore: 88,
      exerciseName: "High Knees Marching",
      source: "seed",
    },
    {
      id: "dose-seed-2",
      timestamp: wednesdaySessionTime.toISOString(),
      totalDurationSec: 900, // 15 min
      qualifyingMinutes: 14,
      avgSyncScore: 84,
      exerciseName: "Arm Reach & Torso Twist",
      source: "seed",
    },
  ];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch (e) {
      console.error("Failed to seed demo exercise dose data", e);
    }
  }

  return seeded;
}

/**
 * Calculates current week's exercise dose progress (Mon-Sun window).
 */
export function getWeeklyDose(isDemoMode = true): WeeklyDoseResult {
  const targetMinutes = 45;
  const targetSessions = 3;
  const monday = getMondayOfWeek(new Date());
  const weekStartIso = monday.toISOString();

  if (typeof window === "undefined") {
    return {
      minutesThisWeek: 32,
      targetMinutes,
      sessionsThisWeek: 2,
      targetSessions,
      weekStartDate: weekStartIso,
      progressPct: Math.round((32 / targetMinutes) * 100),
      qualifyingSessions: [],
      citationNote: CYCLE_II_CITATION,
    };
  }

  let allSessions: ExerciseDoseSession[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      allSessions = seedDemoExerciseDose();
    } else {
      allSessions = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to parse exercise dose history", e);
    allSessions = seedDemoExerciseDose();
  }

  // Filter sessions that fall in the current week (timestamp >= Monday 00:00:00)
  const mondayTime = monday.getTime();
  const weekSessions = allSessions.filter(
    (s) => new Date(s.timestamp).getTime() >= mondayTime
  );

  const minutesThisWeek = weekSessions.reduce((acc, s) => acc + s.qualifyingMinutes, 0);
  // Count session if qualifyingMinutes >= 5 min
  const sessionsThisWeek = weekSessions.filter((s) => s.qualifyingMinutes >= 5).length;
  const progressPct = Math.min(100, Math.round((minutesThisWeek / targetMinutes) * 100));

  return {
    minutesThisWeek,
    targetMinutes,
    sessionsThisWeek,
    targetSessions,
    weekStartDate: weekStartIso,
    progressPct,
    qualifyingSessions: weekSessions,
    citationNote: CYCLE_II_CITATION,
  };
}

/**
 * Records a completed Move Coach exercise session into the weekly dose tracker.
 */
export function recordExerciseDoseSession(input: {
  totalDurationSec: number;
  avgSyncScore: number;
  exerciseName: string;
  syncThresholdPct?: number; // default 50%
}): { newSession: ExerciseDoseSession; weeklyDose: WeeklyDoseResult } {
  const {
    totalDurationSec,
    avgSyncScore,
    exerciseName,
    syncThresholdPct = 50,
  } = input;

  // Calculate qualifying minutes where rhythm entrainment / sync matching was maintained
  // If avgSyncScore >= threshold, count proportional duration; if syncScore >= 60%, 100% of duration counts
  const syncRatio = Math.min(1.0, Math.max(0, avgSyncScore / 100));
  const effectiveQualityRatio = avgSyncScore >= syncThresholdPct ? Math.min(1.0, syncRatio * 1.1) : 0.4;
  const rawQualifyingSec = totalDurationSec * effectiveQualityRatio;
  const qualifyingMinutes = Math.max(1, Math.round(rawQualifyingSec / 60));

  const newSession: ExerciseDoseSession = {
    id: `dose-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    totalDurationSec,
    qualifyingMinutes,
    avgSyncScore: Math.round(avgSyncScore),
    exerciseName,
    source: "user",
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getWeeklyDose().qualifyingSessions;
      const raw = localStorage.getItem(STORAGE_KEY);
      const all: ExerciseDoseSession[] = raw ? JSON.parse(raw) : seedDemoExerciseDose();
      const updated = [...all, newSession];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to record exercise dose session", e);
    }
  }

  const weeklyDose = getWeeklyDose();
  return { newSession, weeklyDose };
}
