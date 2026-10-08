"use client";

export type FreezeEpisodeSource = "auto-detected" | "manual" | "pre-warning";

export interface FreezeEpisode {
  id: string;
  timestamp: string; // ISO string
  source: FreezeEpisodeSource;
  freezeIndex?: number;
  trendRate?: number; // Rate of increase per second (e.g. +0.45/s)
  escalatedToFull?: boolean; // True if pre-warning escalated to full freeze
  cueType?: "audio" | "vibration" | "visual";
  cueBpm?: number;
  isFalseAlarm?: boolean;
  durationSec?: number;
  notes?: string;
}

const FREEZE_EPISODES_KEY = "steady_freeze_episodes";

export function seedDemoFreezeEpisodes(): FreezeEpisode[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const demoEpisodes: FreezeEpisode[] = [
    {
      id: "ep-seed-pre-1",
      timestamp: new Date(now - 0.5 * dayMs).toISOString(),
      source: "pre-warning",
      freezeIndex: 2.15,
      trendRate: 0.38,
      escalatedToFull: false, // Resolved naturally when patient adjusted gait
      notes: "Pre-freeze warning triggered; gait normalized naturally without full freeze.",
    },
    {
      id: "ep-seed-pre-2",
      timestamp: new Date(now - 1.2 * dayMs).toISOString(),
      source: "pre-warning",
      freezeIndex: 2.30,
      trendRate: 0.52,
      escalatedToFull: true, // Continued onto full freeze
      notes: "Pre-freeze warning rapidly escalated to full sustained freeze.",
    },
    {
      id: "ep-seed-1",
      timestamp: new Date(now - 1.2 * dayMs + 5000).toISOString(),
      source: "auto-detected",
      freezeIndex: 3.12,
      cueType: "audio",
      cueBpm: 88,
      isFalseAlarm: false,
      durationSec: 42,
    },
    {
      id: "ep-seed-2",
      timestamp: new Date(now - 4 * dayMs).toISOString(),
      source: "manual",
      freezeIndex: 2.85,
      cueType: "audio",
      cueBpm: 88,
      isFalseAlarm: false,
      durationSec: 65,
    },
    {
      id: "ep-seed-3",
      timestamp: new Date(now - 2 * dayMs).toISOString(),
      source: "auto-detected",
      freezeIndex: 2.95,
      cueType: "vibration",
      cueBpm: 88,
      isFalseAlarm: false,
      durationSec: 38,
    },
    {
      id: "ep-seed-4",
      timestamp: new Date(now - 1 * dayMs).toISOString(),
      source: "auto-detected",
      freezeIndex: 2.6,
      cueType: "audio",
      cueBpm: 88,
      isFalseAlarm: true, // Patient dismissed as false alarm
      durationSec: 10,
    },
  ];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(FREEZE_EPISODES_KEY, JSON.stringify(demoEpisodes));
    } catch (e) {
      console.error("Failed to seed demo freeze episodes", e);
    }
  }

  return demoEpisodes;
}

export function getFreezeEpisodes(): FreezeEpisode[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(FREEZE_EPISODES_KEY);
    if (!raw) {
      return seedDemoFreezeEpisodes();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return seedDemoFreezeEpisodes();
    }
    return parsed;
  } catch (e) {
    console.error("Failed to get freeze episodes", e);
    return seedDemoFreezeEpisodes();
  }
}

export function logFreezeEpisode(
  data: Omit<FreezeEpisode, "id" | "timestamp">
): FreezeEpisode {
  const newEpisode: FreezeEpisode = {
    ...data,
    id: `freeze-ep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const episodes = getFreezeEpisodes();
      const updated = [newEpisode, ...episodes];
      localStorage.setItem(FREEZE_EPISODES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to log freeze episode", e);
    }
  }

  return newEpisode;
}

export function clearFreezeEpisodes(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(FREEZE_EPISODES_KEY);
  }
}
