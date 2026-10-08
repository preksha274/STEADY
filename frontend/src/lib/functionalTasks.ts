"use client";

export const DEFAULT_SUGGESTED_GOALS = [
  "Buttoning my shirt",
  "Writing legibly",
  "Walking to the mailbox without stopping",
  "Using utensils at dinner",
  "Rising from an armchair",
  "Pouring a glass of water without spilling",
];

export interface TaskCheckInEntry {
  id: string;
  timestamp: string; // ISO date string
  ratings: Record<string, number>; // taskName -> score (1 = easy, 5 = very hard)
}

export interface TaskTrendPoint {
  date: string;
  formattedDate: string;
  score: number; // 1 to 5
  taskName: string;
}

const GOALS_STORAGE_KEY = "steady_functional_goals";
const CHECKINS_STORAGE_KEY = "steady_functional_checkins";

/**
 * Returns active patient-defined functional task goals.
 */
export function getTaskGoals(): string[] {
  if (typeof window === "undefined") {
    return [
      "Buttoning my shirt",
      "Walking to the mailbox without stopping",
      "Writing legibly",
    ];
  }

  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load functional goals", e);
  }

  // Fallback default goals
  const defaults = [
    "Buttoning my shirt",
    "Walking to the mailbox without stopping",
    "Writing legibly",
  ];
  saveTaskGoals(defaults);
  return defaults;
}

/**
 * Saves patient-defined functional task goals.
 */
export function saveTaskGoals(goals: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned = goals.map((g) => g.trim()).filter((g) => g.length > 0);
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.error("Failed to save functional goals", e);
  }
}

/**
 * Seeds realistic 4-week demo check-in history showing believable progressive improvement.
 */
export function seedDemoFunctionalTasks(forceReset = false): TaskCheckInEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const existingRaw = localStorage.getItem(CHECKINS_STORAGE_KEY);
    if (existingRaw && !forceReset) {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed checking existing functional check-ins", e);
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // 4 weeks of weekly check-ins showing steady improvement
  // Difficulty scale: 1 = Very Easy, 5 = Extremely Hard
  const seededCheckIns: TaskCheckInEntry[] = [
    {
      id: "func-seed-1",
      timestamp: new Date(now.getTime() - 21 * dayMs).toISOString(), // 3 weeks ago
      ratings: {
        "Buttoning my shirt": 4,
        "Walking to the mailbox without stopping": 4,
        "Writing legibly": 5,
      },
    },
    {
      id: "func-seed-2",
      timestamp: new Date(now.getTime() - 14 * dayMs).toISOString(), // 2 weeks ago
      ratings: {
        "Buttoning my shirt": 3,
        "Walking to the mailbox without stopping": 3,
        "Writing legibly": 4,
      },
    },
    {
      id: "func-seed-3",
      timestamp: new Date(now.getTime() - 7 * dayMs).toISOString(), // 1 week ago
      ratings: {
        "Buttoning my shirt": 2,
        "Walking to the mailbox without stopping": 3,
        "Writing legibly": 3,
      },
    },
    {
      id: "func-seed-4",
      timestamp: new Date(now.getTime() - 1 * dayMs).toISOString(), // Yesterday / current week
      ratings: {
        "Buttoning my shirt": 2,
        "Walking to the mailbox without stopping": 2,
        "Writing legibly": 2,
      },
    },
  ];

  try {
    localStorage.setItem(CHECKINS_STORAGE_KEY, JSON.stringify(seededCheckIns));
  } catch (e) {
    console.error("Failed to seed functional task check-ins", e);
  }

  return seededCheckIns;
}

/**
 * Returns all recorded task check-in history.
 */
export function getTaskCheckIns(isDemoMode = true): TaskCheckInEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CHECKINS_STORAGE_KEY);
    if (!raw) {
      return seedDemoFunctionalTasks(false);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return seedDemoFunctionalTasks(false);
    }
    return parsed;
  } catch (e) {
    console.error("Failed reading functional check-ins", e);
    return seedDemoFunctionalTasks(false);
  }
}

/**
 * Records a new weekly functional check-in entry.
 */
export function recordTaskCheckIn(ratings: Record<string, number>): TaskCheckInEntry {
  const newEntry: TaskCheckInEntry = {
    id: `func-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ratings,
  };

  if (typeof window !== "undefined") {
    try {
      const current = getTaskCheckIns();
      const updated = [...current, newEntry];
      localStorage.setItem(CHECKINS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed recording task check-in", e);
    }
  }

  return newEntry;
}

/**
 * Gets difficulty score history for a specific task over time for charting.
 */
export function getTaskTrend(taskName: string): TaskTrendPoint[] {
  const checkIns = getTaskCheckIns();

  return checkIns
    .filter((entry) => entry.ratings[taskName] !== undefined)
    .map((entry) => {
      const d = new Date(entry.timestamp);
      return {
        date: entry.timestamp,
        formattedDate: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        score: entry.ratings[taskName],
        taskName,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Gets aggregated trend data across all active goals formatted for recharts or line lists.
 */
export function getAllTaskTrends(): {
  goals: string[];
  history: Array<{ dateLabel: string; [taskName: string]: any }>;
  latestRatings: Array<{ taskName: string; score: number; trend: "improving" | "stable" | "worsening" }>;
} {
  const goals = getTaskGoals();
  const checkIns = getTaskCheckIns();

  const sortedCheckIns = [...checkIns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const history = sortedCheckIns.map((entry) => {
    const d = new Date(entry.timestamp);
    const item: { dateLabel: string; [taskName: string]: any } = {
      dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    goals.forEach((g) => {
      if (entry.ratings[g] !== undefined) {
        item[g] = entry.ratings[g];
      }
    });
    return item;
  });

  const latestRatings = goals.map((g) => {
    const points = sortedCheckIns
      .filter((c) => c.ratings[g] !== undefined)
      .map((c) => c.ratings[g]);

    const latest = points.length > 0 ? points[points.length - 1] : 3;
    const prev = points.length > 1 ? points[points.length - 2] : latest;

    let trend: "improving" | "stable" | "worsening" = "stable";
    if (latest < prev) trend = "improving"; // lower score = easier/better
    else if (latest > prev) trend = "worsening";

    return {
      taskName: g,
      score: latest,
      trend,
    };
  });

  return { goals, history, latestRatings };
}
