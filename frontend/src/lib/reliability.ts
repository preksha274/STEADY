/**
 * STEADY Test-Retest Reliability Engine
 * Manages back-to-back measurement consistency checks.
 * Results are stored separately from session timeline history.
 */

export interface ReliabilityRun {
  frequencyHz: number;
  amplitude: number;
  capturedAt: string;
}

export interface ReliabilityRecord {
  id: string;
  timestamp: string;
  modality: "tremor" | "bradykinesia" | "voice";
  run1: ReliabilityRun;
  run2: ReliabilityRun;
  freqDiffPct: number;
  ampDiffPct: number;
  overallConsistencyPct: number;
  isWithinTolerance: boolean; // ±10% tolerance
  source?: "user" | "demo";
}

const STORAGE_KEY = "movepilot_reliability_checks";

export function getReliabilityRecords(): ReliabilityRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDemoReliability();
    const records: ReliabilityRecord[] = JSON.parse(raw);
    return Array.isArray(records) && records.length > 0 ? records : seedDemoReliability();
  } catch (e) {
    console.error("Failed to read reliability records", e);
    return seedDemoReliability();
  }
}

export function saveReliabilityRecord(
  run1: ReliabilityRun,
  run2: ReliabilityRun,
  modality: "tremor" | "bradykinesia" | "voice" = "tremor"
): ReliabilityRecord {
  // Compute percent differences
  const meanFreq = (run1.frequencyHz + run2.frequencyHz) / 2 || 1;
  const freqDiffPct = Math.round((Math.abs(run1.frequencyHz - run2.frequencyHz) / meanFreq) * 1000) / 10;

  const meanAmp = (run1.amplitude + run2.amplitude) / 2 || 0.1;
  const ampDiffPct = Math.round((Math.abs(run1.amplitude - run2.amplitude) / meanAmp) * 1000) / 10;

  const avgDiff = (freqDiffPct + ampDiffPct) / 2;
  const overallConsistencyPct = Math.round(Math.max(0, 100 - avgDiff) * 10) / 10;
  const isWithinTolerance = avgDiff <= 10.0;

  const record: ReliabilityRecord = {
    id: "rel_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    modality,
    run1,
    run2,
    freqDiffPct,
    ampDiffPct,
    overallConsistencyPct,
    isWithinTolerance,
    source: "user",
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getReliabilityRecords();
      const updated = [record, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save reliability record", e);
    }
  }

  return record;
}

export function seedDemoReliability(): ReliabilityRecord[] {
  if (typeof window === "undefined") return [];
  const now = new Date();
  const seeded: ReliabilityRecord[] = [
    {
      id: "seed_rel_1",
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      modality: "tremor",
      run1: { frequencyHz: 4.8, amplitude: 0.182, capturedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 - 15000).toISOString() },
      run2: { frequencyHz: 4.9, amplitude: 0.185, capturedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
      freqDiffPct: 2.1,
      ampDiffPct: 1.6,
      overallConsistencyPct: 98.1,
      isWithinTolerance: true,
      source: "demo",
    },
    {
      id: "seed_rel_2",
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      modality: "tremor",
      run1: { frequencyHz: 5.1, amplitude: 0.240, capturedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 - 15000).toISOString() },
      run2: { frequencyHz: 5.0, amplitude: 0.246, capturedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() },
      freqDiffPct: 2.0,
      ampDiffPct: 2.5,
      overallConsistencyPct: 97.8,
      isWithinTolerance: true,
      source: "demo",
    },
  ];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch (e) {}

  return seeded;
}
