export interface DiaryEntry {
  id: string;
  timestamp: string; // ISO string
  symptoms: {
    tremor: 0 | 1 | 2 | 3; // 0 none, 1 mild, 2 moderate, 3 high
    slowness: 0 | 1 | 2 | 3;
    freezing: 0 | 1 | 2 | 3;
  };
  mood: 1 | 2 | 3 | 4; // 1 poor, 2 fair, 3 good, 4 excellent
  fatigue: 1 | 2 | 3 | 4 | 5; // 1 energetic to 5 exhausted
  sleepHours?: number;
  sleepQuality?: 1 | 2 | 3 | 4 | 5; // 1 poor to 5 great
  source: "user" | "seed";
}

export interface DoseLog {
  id: string;
  timestamp: string; // ISO string
  onOff?: "on" | "off";
  source?: "user" | "seed";
}

const DIARY_STORAGE_KEY = "movepilot_diary_entries";
const DOSE_STORAGE_KEY = "movepilot_dose_logs";

/**
 * Get all diary entries from localStorage.
 * Filtered by demo mode if specified.
 */
export function getDiaryEntries(isDemoMode: boolean = true): DiaryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(DIARY_STORAGE_KEY);
    if (!raw) return [];
    const entries: DiaryEntry[] = JSON.parse(raw);

    const filtered = isDemoMode
      ? entries
      : entries.filter((e) => e.source === "user");

    return filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (e) {
    console.error("Failed to read diary entries from localStorage", e);
    return [];
  }
}

/**
 * Add a new diary entry to localStorage.
 */
export function addDiaryEntry(
  entryData: Omit<DiaryEntry, "id" | "timestamp"> & { timestamp?: string; id?: string }
): DiaryEntry {
  const newEntry: DiaryEntry = {
    id: entryData.id || "diary_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    timestamp: entryData.timestamp || new Date().toISOString(),
    symptoms: entryData.symptoms,
    mood: entryData.mood,
    fatigue: entryData.fatigue,
    sleepHours: entryData.sleepHours,
    sleepQuality: entryData.sleepQuality,
    source: entryData.source || "user",
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getDiaryEntries(true);
      const updated = [newEntry, ...existing];
      localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save diary entry to localStorage", e);
    }
  }

  return newEntry;
}

/**
 * Get all dose logs from localStorage.
 * Filtered by demo mode if specified.
 */
export function getDoseLogs(isDemoMode: boolean = true): DoseLog[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(DOSE_STORAGE_KEY);
    if (!raw) return [];
    const logs: DoseLog[] = JSON.parse(raw);

    const filtered = isDemoMode
      ? logs
      : logs.filter((l) => l.source === "user" || !l.source);

    return filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (e) {
    console.error("Failed to read dose logs from localStorage", e);
    return [];
  }
}

/**
 * Add a dose log (Log Dose function).
 * Records current time (or specified timestamp) with optional ON/OFF state.
 */
export function addDoseLog(
  onOff?: "on" | "off",
  timestamp?: string,
  source: "user" | "seed" = "user"
): DoseLog {
  const newLog: DoseLog = {
    id: "dose_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    timestamp: timestamp || new Date().toISOString(),
    onOff,
    source,
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getDoseLogs(true);
      const updated = [newLog, ...existing];
      localStorage.setItem(DOSE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save dose log to localStorage", e);
    }
  }

  return newLog;
}

/** Alias for addDoseLog as requested */
export const logDose = addDoseLog;

/**
 * Get the most recent dose log.
 */
export function getLastDose(isDemoMode: boolean = true): DoseLog | null {
  const logs = getDoseLogs(isDemoMode);
  if (logs.length === 0) return null;
  return logs[0]; // Already sorted descending by timestamp
}

/**
 * Calculate hours since last dose prior to specified time `at` (default current time).
 */
export function hoursSinceLastDose(
  at?: Date | string,
  isDemoMode: boolean = true
): number | null {
  const targetTimeMs = at
    ? typeof at === "string"
      ? new Date(at).getTime()
      : at.getTime()
    : Date.now();

  const logs = getDoseLogs(isDemoMode);
  const priorLogs = logs.filter(
    (l) => new Date(l.timestamp).getTime() <= targetTimeMs
  );

  if (priorLogs.length === 0) return null;

  const lastDoseMs = new Date(priorLogs[0].timestamp).getTime();
  const diffHours = (targetTimeMs - lastDoseMs) / (1000 * 60 * 60);

  return Math.max(0, Math.round(diffHours * 10) / 10);
}

/**
 * Clear all diary entries and dose logs from localStorage.
 */
export function clearDiary(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(DIARY_STORAGE_KEY);
      localStorage.removeItem(DOSE_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear diary data from localStorage", e);
    }
  }
}

/**
 * Seed realistic demo diary entries and dose logs for the last 18 days.
 */
export function seedDemoDiary(forceReset: boolean = false): {
  entries: DiaryEntry[];
  doses: DoseLog[];
} {
  if (typeof window === "undefined") {
    return { entries: [], doses: [] };
  }

  if (!forceReset) {
    const existingEntries = getDiaryEntries(true);
    const existingDoses = getDoseLogs(true);
    if (existingEntries.length > 0 || existingDoses.length > 0) {
      return { entries: existingEntries, doses: existingDoses };
    }
  }

  clearDiary();

  const now = new Date();
  const seededEntries: DiaryEntry[] = [];
  const seededDoses: DoseLog[] = [];

  // Seed data over 18 days matching seedDemoSessions
  for (let i = 17; i >= 0; i--) {
    const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Dose 1: ~08:00 AM (e.g. 7:55 AM to 8:15 AM)
    const morningDoseDate = new Date(dayDate);
    morningDoseDate.setHours(8, (i % 3) * 5, 0, 0);

    // Dose 2: ~1:00 PM (13:00)
    const afternoonDoseDate = new Date(dayDate);
    afternoonDoseDate.setHours(13, (i % 4) * 4, 0, 0);

    // Dose 3: ~6:00 PM (18:00)
    const eveningDoseDate = new Date(dayDate);
    eveningDoseDate.setHours(18, (i % 2) * 10, 0, 0);

    const dose1: DoseLog = {
      id: `seed_dose_${18 - i}_1`,
      timestamp: morningDoseDate.toISOString(),
      onOff: "on",
      source: "seed",
    };
    const dose2: DoseLog = {
      id: `seed_dose_${18 - i}_2`,
      timestamp: afternoonDoseDate.toISOString(),
      onOff: "on",
      source: "seed",
    };
    const dose3: DoseLog = {
      id: `seed_dose_${18 - i}_3`,
      timestamp: eveningDoseDate.toISOString(),
      onOff: i % 5 === 0 ? "off" : "on",
      source: "seed",
    };

    seededDoses.push(dose1, dose2, dose3);

    // Night sleep quality preceding day i (poor sleep on day 15 and day 7)
    const isPoorSleep = i === 15 || i === 7;
    const sleepHours = isPoorSleep ? 4.5 : Math.round((7 + (i % 3) * 0.5) * 10) / 10;
    const sleepQuality: 1 | 2 | 3 | 4 | 5 = isPoorSleep ? 2 : (i % 2 === 0 ? 4 : 5);

    // Morning Diary Entry (~09:30 AM - 1.5 hours post morning dose -> ON peak state)
    const morningEntryDate = new Date(dayDate);
    morningEntryDate.setHours(9, 30, 0, 0);

    const morningEntry: DiaryEntry = {
      id: `seed_diary_${18 - i}_am`,
      timestamp: morningEntryDate.toISOString(),
      symptoms: {
        tremor: isPoorSleep ? 1 : (i > 10 ? 1 : 0),
        slowness: isPoorSleep ? 2 : (i > 10 ? 1 : 0),
        freezing: isPoorSleep ? 1 : 0,
      },
      mood: isPoorSleep ? 2 : 4,
      fatigue: isPoorSleep ? 4 : 1,
      sleepHours,
      sleepQuality,
      source: "seed",
    };
    seededEntries.push(morningEntry);

    // Afternoon Diary Entry (~17:00 PM - 4 hours post 13:00 dose -> wearing off prior to 18:00 dose)
    const afternoonEntryDate = new Date(dayDate);
    afternoonEntryDate.setHours(17, 0, 0, 0);

    const afternoonEntry: DiaryEntry = {
      id: `seed_diary_${18 - i}_pm`,
      timestamp: afternoonEntryDate.toISOString(),
      symptoms: {
        tremor: isPoorSleep ? 3 : (i > 10 ? 2 : 1),
        slowness: isPoorSleep ? 2 : 2,
        freezing: isPoorSleep ? 2 : (i > 10 ? 1 : 0),
      },
      mood: isPoorSleep ? 2 : 3,
      fatigue: isPoorSleep ? 4 : 3,
      source: "seed",
    };
    seededEntries.push(afternoonEntry);
  }

  try {
    localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(seededEntries));
    localStorage.setItem(DOSE_STORAGE_KEY, JSON.stringify(seededDoses));
  } catch (e) {
    console.error("Failed to save seeded diary data to localStorage", e);
  }

  return { entries: seededEntries, doses: seededDoses };
}
