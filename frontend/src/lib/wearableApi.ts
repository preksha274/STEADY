"use client";

/**
 * Client service for fetching wearable summaries and timeseries series from FastAPI backend.
 */

import { SeverityEvaluation } from "./severityConfig";

export interface WearableSummary {
  range: string;
  has_data?: boolean;
  session_id: string;
  session_started_at_utc?: string;
  total_tracked_seconds?: number;
  total_minutes_tracked: number;
  total_tremor_seconds?: number;
  total_tremor_minutes: number;
  overall_tremor_pct: number;
  average_amplitude_g: number;
  peak_amplitude_g: number;
  average_dominant_freq_hz: number;
  total_samples: number;
  bad_lines_count: number;
  data_quality_pct: number;
  records_count?: number;
  severity?: SeverityEvaluation;
  quality_severity?: {
    level: "GOOD" | "MODERATE" | "HIGH" | "NO_DATA";
    label: string;
    color: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    hex: string;
    icon: string;
  };
}

export interface WearableSeriesPoint {
  session_id: string;
  minute_start_utc: string;
  sample_count: number;
  assessed_sample_count: number;
  tracked_seconds?: number;
  tracked_minutes?: number;
  tremor_seconds?: number;
  tremor_minutes: number;
  tremor_pct: number;
  mean_amplitude_g: number;
  max_amplitude_g: number;
  dominant_freq_hz: number;
  not_assessed_pct: number;
  bad_lines_count: number;
  drops_count: number;
  severity_level?: "GOOD" | "MODERATE" | "HIGH" | "NO_DATA";
  severity_color?: string;
  severity_hex?: string;
}

export async function fetchWearableSummary(
  range: string = "day",
  apiUrl: string = "http://127.0.0.1:8000"
): Promise<WearableSummary> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/wearable/summary?range=${range}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Could not fetch wearable summary from backend", e);
  }

  // Fallback summary (neutral / no data state if offline and no backend)
  return {
    range,
    has_data: false,
    session_id: "wearable_ses_offline",
    total_tracked_seconds: 0,
    total_minutes_tracked: 0,
    total_tremor_seconds: 0,
    total_tremor_minutes: 0,
    overall_tremor_pct: 0,
    average_amplitude_g: 0,
    peak_amplitude_g: 0,
    average_dominant_freq_hz: 0,
    total_samples: 0,
    bad_lines_count: 0,
    data_quality_pct: 0,
  };
}

export async function fetchWearableSeries(
  range: string = "day",
  apiUrl: string = "http://127.0.0.1:8000"
): Promise<WearableSeriesPoint[]> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/wearable/series?range=${range}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Could not fetch wearable series from backend", e);
  }

  return [];
}
