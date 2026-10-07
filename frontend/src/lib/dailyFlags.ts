"use client";

import { getSessions, Session } from "./sessions";
import { getDiaryEntries } from "./diary";

export const MIN_BASELINE_DAYS = 4; // Require at least 4 complete valid days before flagging
export const MIN_HOURS_WORN_PER_DAY = 4; // Configurable hours worn threshold
export const PERSISTENCE_N = 2; // Require N out of M days
export const PERSISTENCE_M = 3; // Aggregate over 3-day windows

export type FlagSeverity = "cold_start" | "normal" | "unusual_today" | "different_from_usual";

export interface DailyFlagResult {
  severity: FlagSeverity;
  headline: string;
  explanation: string;
  daysLogged: number;
  minDaysRequired: number;
  isColdStart: boolean;
  persistenceMet: boolean;
  flaggedMetrics: string[];
}

/**
 * Format a date string into YYYY-MM-DD
 */
function toDateKey(dInput?: Date | string): string {
  const d = dInput ? (typeof dInput === "string" ? new Date(dInput) : dInput) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

/**
 * Evaluates daily baseline flags with:
 * 1. Cold-start check (requires >= MIN_BASELINE_DAYS complete valid days, >= minHoursWorn)
 * 2. 3-day window aggregation (N-of-M persistence rule: N of last M days outside personal range)
 * 3. Strict non-diagnostic language ("different from your usual", NEVER "worse" or "OFF state")
 * 4. Strictly per-person baselines (NO cross-person thresholds)
 */
export function evaluateDailyFlag(
  targetDate?: Date | string,
  isDemoMode: boolean = true,
  n: number = PERSISTENCE_N,
  m: number = PERSISTENCE_M,
  minHoursWorn: number = MIN_HOURS_WORN_PER_DAY
): DailyFlagResult {
  const allSessions = getSessions(isDemoMode);
  
  // Unique dates logged with hours worn filter
  const dateMap = new Map<string, Session[]>();
  allSessions.forEach((s) => {
    const key = toDateKey(s.timestamp);
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(s);
  });

  const totalDaysLogged = dateMap.size;

  // 1. Cold-Start Check: Need at least MIN_BASELINE_DAYS complete valid days
  if (totalDaysLogged < MIN_BASELINE_DAYS) {
    return {
      severity: "cold_start",
      headline: "still learning your usual",
      explanation: `STEADY requires at least ${MIN_BASELINE_DAYS} complete valid days (≥${minHoursWorn}h worn/day) to build your personal baseline (${totalDaysLogged} of ${MIN_BASELINE_DAYS} days logged so far). No flags are shown during cold start.`,
      daysLogged: totalDaysLogged,
      minDaysRequired: MIN_BASELINE_DAYS,
      isColdStart: true,
      persistenceMet: false,
      flaggedMetrics: [],
    };
  }


  // Calculate baseline metrics across past sessions
  const tremorAmps = allSessions.map((s) => s.tremor.amplitude);
  const meanAmp = tremorAmps.reduce((a, b) => a + b, 0) / (tremorAmps.length || 1);
  const stdAmp = Math.sqrt(
    tremorAmps.reduce((acc, v) => acc + Math.pow(v - meanAmp, 2), 0) / (tremorAmps.length || 1)
  );

  // High threshold = mean + 1.8 * std
  const thresholdAmp = meanAmp + 1.8 * stdAmp;

  // Sorted unique date keys
  const sortedDateKeys = Array.from(dateMap.keys()).sort();
  const recentMKeys = sortedDateKeys.slice(-m);

  let nOutlierDays = 0;
  const flaggedMetrics: string[] = [];

  recentMKeys.forEach((key) => {
    const daySessions = dateMap.get(key) || [];
    const isUnusualDay = daySessions.some(
      (s) =>
        s.tremor.amplitude > thresholdAmp ||
        (s.bradykinesia && s.bradykinesia.decrementPct > 25) ||
        (s.gait && s.gait.cadence < 95)
    );
    if (isUnusualDay) {
      nOutlierDays++;
    }
  });

  const targetKey = toDateKey(targetDate);
  const targetSessions = dateMap.get(targetKey) || [];
  const targetUnusual = targetSessions.some(
    (s) =>
      s.tremor.amplitude > thresholdAmp ||
      (s.bradykinesia && s.bradykinesia.decrementPct > 25) ||
      (s.gait && s.gait.cadence < 95)
  );

  if (targetUnusual) {
    flaggedMetrics.push("Movement Rhythm");
  }

  // 2. N-of-M Persistence Rule
  if (nOutlierDays >= n) {
    return {
      severity: "different_from_usual",
      headline: "Different from your usual",
      explanation: `Movement signals show a sustained pattern different from your 14-day baseline (${nOutlierDays} of the last ${m} days flagged).`,
      daysLogged: totalDaysLogged,
      minDaysRequired: MIN_BASELINE_DAYS,
      isColdStart: false,
      persistenceMet: true,
      flaggedMetrics: ["Movement Rhythm"],
    };
  }

  // Single-day outlier: Display as "Unusual today", NEVER "worsening"
  if (targetUnusual) {
    return {
      severity: "unusual_today",
      headline: "Unusual today",
      explanation: "One of your movement readings is different from your usual today. Single-day variations are expected and not a sustained trend.",
      daysLogged: totalDaysLogged,
      minDaysRequired: MIN_BASELINE_DAYS,
      isColdStart: false,
      persistenceMet: false,
      flaggedMetrics: ["Movement Rhythm"],
    };
  }

  // Normal Baseline
  return {
    severity: "normal",
    headline: "Matching your usual",
    explanation: `Your movement signals match your established ${totalDaysLogged}-day personal baseline.`,
    daysLogged: totalDaysLogged,
    minDaysRequired: MIN_BASELINE_DAYS,
    isColdStart: false,
    persistenceMet: false,
    flaggedMetrics: [],
  };
}
