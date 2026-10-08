/**
 * STEADY Wearable Configuration Constants & Client Types
 */

export const SERIAL_BAUD = 115200;
export const STALE_DATA_SECONDS = 3;
export const TREMOR_RMS_G = 0.04;
export const REST_RMS_G = 0.015;
export const BASELINE_SECONDS = 60;
export const BASELINE_MIN_VALID_SECONDS = 30;
export const BASELINE_EPSILON = 0.01;
export const RULE_WINDOW_SECONDS = 120;
export const RULE_MARGIN_POINTS = 15;
export const RULE_COOLDOWN_SECONDS = 60;
export const BAND_ALERT_SUPPRESS_SECONDS = 5;
export const DB_BATCH_SECONDS = 1;
export const LIVE_CHART_XYZ_SECONDS = 10;
export const LIVE_CHART_RMS_SECONDS = 60;
export const READINGS_PER_SECOND_EXPECTED = 10;

export const DISCLAIMER_TEXT =
  "Prototype for movement monitoring and decision support only. It is not a medical device and does not provide a diagnosis.";

export interface WearableStatus {
  connected: boolean;
  port: string;
  state: "connected" | "no_data" | "port_busy" | "port_missing" | "legacy_format" | "disconnected";
  mpu_ok: boolean;
  last_reading_at: string | null;
  readings_per_second: number;
  skipped_lines: number;
  legacy_lines: number;
  last_bad_line: string;
}

export interface Person {
  id: string;
  code: string;
  display_name: string | null;
  created_at: string;
  is_sample?: boolean;
  session_count?: number;
  last_session_at?: string | null;
}

export interface Session {
  id: string;
  person_id: string;
  person_code?: string;
  type: "normal" | "baseline";
  label: "still" | "typing" | "walking" | "shaking" | "other" | null;
  note: string | null;
  source: "live" | "replay";
  started_at: string;
  ended_at: string | null;
  is_sample?: boolean;
}

export interface LiveReading {
  ts: string;
  t_ms: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  rms: number;
  freq: number;
  tremor: number;
  alert: number;
  btn: number;
}

export interface WearableAlert {
  id: string;
  person_id: string | null;
  person_code?: string;
  session_id: string | null;
  ts: string;
  reason: string;
  source: "band" | "rule" | "test";
}

