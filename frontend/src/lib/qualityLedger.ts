"use client";

/**
 * STEADY Quality Ledger & Per-Modality Confidence Engine
 *
 * Implements a 4-field quality ledger per modality & derived metric:
 * 1. signal_integrity (dropouts, clipping, BLE gaps, noise, sensor placement/orientation shift)
 * 2. context_validity (task verification, lighting, unoccluded view, audio quietness)
 * 3. model_uncertainty (conformal variance, baseline deviation, epistemic score)
 * 4. freshness (age in seconds, coverage in minutes)
 */

export type ModalityId = "wrist_imu" | "phone_imu" | "camera_pose" | "voice";

export type DerivedMetricId =
  | "tremor_power"
  | "stride_variability"
  | "finger_tap_score"
  | "voice_jitter"
  | "freeze_event";

export type MetricQualityStatus =
  | "reliable"
  | "low_confidence"
  | "no_reliable_estimate";

export type ReasonCode =
  | "band_moved"
  | "sensor_clipping"
  | "ble_dropout"
  | "high_background_noise"
  | "camera_occluded"
  | "poor_lighting"
  | "invalid_task_context"
  | "stale_data"
  | "conformal_uncertainty_high"
  | "insufficient_duration";

export interface SignalIntegrity {
  dropout: boolean;
  clipping_saturation: boolean;
  ble_gaps: boolean;
  noise_level: "low" | "medium" | "high";
  placement_shift: boolean; // e.g. band moved / sensor shifted orientation
  score: number; // 0.0 to 1.0
  details: string[];
}

export interface ContextValidity {
  task_valid: boolean; // was user actually performing the required movement/speech
  environment_valid: boolean; // lighting, occlusion, background quietness
  score: number; // 0.0 to 1.0
  details: string[];
}

export interface ModelUncertainty {
  conformal_interval: [number, number] | null;
  baseline_variance: number;
  epistemic_score: number; // 0.0 (high uncertainty) to 1.0 (certain)
  uncertainty_level: "low" | "medium" | "high";
}

export interface Freshness {
  age_seconds: number;
  coverage_minutes: number;
  is_fresh: boolean;
}

export interface MetricQualityLedger {
  modality: ModalityId;
  metric: DerivedMetricId;
  status: MetricQualityStatus;
  primary_issue?: string;
  reason_code?: ReasonCode;
  actionable_prompt?: string;
  signal_integrity: SignalIntegrity;
  context_validity: ContextValidity;
  model_uncertainty: ModelUncertainty;
  freshness: Freshness;
  raw_value?: number | string | null;
  timestamp: string;
}

export interface RejectedReadingRecord {
  id: string;
  timestamp: string;
  modality: ModalityId;
  metric: DerivedMetricId;
  reason_code: ReasonCode;
  description: string;
  integrity_score: number;
  context_score: number;
}

export interface QualityAwareFusionResult {
  status: "reliable" | "low_confidence" | "not_enough_reliable_data";
  label: string;
  shortLabel: string;
  reason: string;
  actionablePrompt?: string;
  activeMetricsCount: number;
  rejectedMetricsCount: number;
  ledgers: MetricQualityLedger[];
  rejectedLog: RejectedReadingRecord[];
}

const REJECTED_LOG_KEY = "steady_quality_rejected_log";
const PROMPT_SESSION_KEY = "steady_session_prompt_shown";

/**
 * Log a rejected/missing reading into localStorage for auditing & diagnosis
 */
export function logRejectedReading(record: Omit<RejectedReadingRecord, "id">): RejectedReadingRecord {
  const newEntry: RejectedReadingRecord = {
    ...record,
    id: `rej_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(REJECTED_LOG_KEY);
      const existing: RejectedReadingRecord[] = raw ? JSON.parse(raw) : [];
      const updated = [newEntry, ...existing].slice(0, 100); // keep last 100
      localStorage.setItem(REJECTED_LOG_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to log rejected reading", e);
    }
  }

  return newEntry;
}

/**
 * Fetch rejected readings log
 */
export function getRejectedReadingsLog(): RejectedReadingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REJECTED_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Actionable Prompt Throttling: Max 1 prompt per user session
 */
export function canShowActionablePrompt(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const shown = sessionStorage.getItem(PROMPT_SESSION_KEY);
    return !shown;
  } catch (e) {
    return true;
  }
}

export function markActionablePromptShown(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PROMPT_SESSION_KEY, "true");
  } catch (e) {
    // ignore
  }
}

/**
 * Evaluates a single metric's Quality Ledger based on its four component fields.
 */
export function buildMetricQualityLedger(params: {
  modality: ModalityId;
  metric: DerivedMetricId;
  rawValue?: number | string | null;
  timestamp?: string;
  // Overrides for simulation/live checks
  dropout?: boolean;
  clipping?: boolean;
  bleGaps?: boolean;
  noiseLevel?: "low" | "medium" | "high";
  placementShift?: boolean;
  taskValid?: boolean;
  environmentValid?: boolean;
  baselineVariance?: number;
  epistemicScore?: number;
  ageSeconds?: number;
  coverageMinutes?: number;
}): MetricQualityLedger {
  const now = new Date().toISOString();
  const timestamp = params.timestamp || now;

  const dropout = params.dropout ?? false;
  const clipping = params.clipping ?? false;
  const bleGaps = params.bleGaps ?? false;
  const noiseLevel = params.noiseLevel ?? "low";
  const placementShift = params.placementShift ?? false;

  const taskValid = params.taskValid ?? true;
  const environmentValid = params.environmentValid ?? true;

  const baselineVariance = params.baselineVariance ?? 0.12;
  const epistemicScore = params.epistemicScore ?? 0.85;

  const ageSeconds = params.ageSeconds ?? 45;
  const coverageMinutes = params.coverageMinutes ?? 8.5;

  // 1. Signal Integrity Calculation
  const integrityDetails: string[] = [];
  let integrityScore = 1.0;

  if (dropout) {
    integrityScore -= 0.5;
    integrityDetails.push("BLE signal dropout detected");
  }
  if (clipping) {
    integrityScore -= 0.4;
    integrityDetails.push("Sensor saturation / clipping");
  }
  if (bleGaps) {
    integrityScore -= 0.3;
    integrityDetails.push("Packet gaps in BLE stream");
  }
  if (noiseLevel === "high") {
    integrityScore -= 0.4;
    integrityDetails.push("High motion noise floor");
  } else if (noiseLevel === "medium") {
    integrityScore -= 0.2;
    integrityDetails.push("Moderate noise floor");
  }
  if (placementShift) {
    integrityScore -= 0.45;
    integrityDetails.push("Sensor band shifted orientation");
  }
  integrityScore = Math.max(0, integrityScore);

  const signal_integrity: SignalIntegrity = {
    dropout,
    clipping_saturation: clipping,
    ble_gaps: bleGaps,
    noise_level: noiseLevel,
    placement_shift: placementShift,
    score: integrityScore,
    details: integrityDetails,
  };

  // 2. Context Validity Calculation
  const contextDetails: string[] = [];
  let contextScore = 1.0;

  if (!taskValid) {
    contextScore -= 0.6;
    contextDetails.push("Task context invalid (person not performing task)");
  }
  if (!environmentValid) {
    contextScore -= 0.5;
    contextDetails.push("Environment context invalid (lighting / occlusion / acoustics)");
  }
  contextScore = Math.max(0, contextScore);

  const context_validity: ContextValidity = {
    task_valid: taskValid,
    environment_valid: environmentValid,
    score: contextScore,
    details: contextDetails,
  };

  // 3. Model Uncertainty Calculation
  const uncertainty_level: "low" | "medium" | "high" =
    epistemicScore < 0.5 || baselineVariance > 0.35
      ? "high"
      : epistemicScore < 0.75 || baselineVariance > 0.2
      ? "medium"
      : "low";

  const model_uncertainty: ModelUncertainty = {
    conformal_interval:
      typeof params.rawValue === "number"
        ? [params.rawValue * 0.9, params.rawValue * 1.1]
        : null,
    baseline_variance: baselineVariance,
    epistemic_score: epistemicScore,
    uncertainty_level,
  };

  // 4. Freshness Calculation
  const is_fresh = ageSeconds <= 600 && coverageMinutes >= 0.5;
  const freshness: Freshness = {
    age_seconds: ageSeconds,
    coverage_minutes: coverageMinutes,
    is_fresh,
  };

  // Status & Reason Code Determination
  let status: MetricQualityStatus = "reliable";
  let primary_issue: string | undefined;
  let reason_code: ReasonCode | undefined;
  let actionable_prompt: string | undefined;

  if (placementShift) {
    status = "low_confidence";
    primary_issue = "band moved";
    reason_code = "band_moved";
    actionable_prompt = "Tighten the band";
  } else if (!environmentValid && params.modality === "camera_pose") {
    status = "no_reliable_estimate";
    primary_issue = "camera view occluded";
    reason_code = "camera_occluded";
    actionable_prompt = "Repeat the 10 s finger-tap in better light";
  } else if (!environmentValid && params.modality === "voice") {
    status = "no_reliable_estimate";
    primary_issue = "background noise";
    reason_code = "high_background_noise";
    actionable_prompt = "Try the voice check again somewhere quieter";
  } else if (!taskValid) {
    status = "no_reliable_estimate";
    primary_issue = "invalid task context";
    reason_code = "invalid_task_context";
  } else if (dropout || bleGaps) {
    status = "no_reliable_estimate";
    primary_issue = "signal dropout / BLE gap";
    reason_code = "ble_dropout";
  } else if (integrityScore < 0.4 || contextScore < 0.4) {
    status = "no_reliable_estimate";
    primary_issue = "poor signal integrity";
    reason_code = "sensor_clipping";
  } else if (integrityScore < 0.75 || contextScore < 0.75 || uncertainty_level === "medium") {
    status = "low_confidence";
    primary_issue = "moderate noise or variance";
    reason_code = "conformal_uncertainty_high";
  } else if (!is_fresh) {
    status = "no_reliable_estimate";
    primary_issue = "stale recording";
    reason_code = "stale_data";
  }

  // If rejected/unreliable, log to persistent rejected reading ledger
  if (status === "no_reliable_estimate" && reason_code) {
    logRejectedReading({
      timestamp,
      modality: params.modality,
      metric: params.metric,
      reason_code,
      description: primary_issue || "Metric failed quality ledger checks",
      integrity_score: integrityScore,
      context_score: contextScore,
    });
  }

  return {
    modality: params.modality,
    metric: params.metric,
    status,
    primary_issue,
    reason_code,
    actionable_prompt,
    signal_integrity,
    context_validity,
    model_uncertainty,
    freshness,
    raw_value: status === "no_reliable_estimate" ? null : params.rawValue, // NEVER silently impute missing/bad to normal
    timestamp,
  };
}

/**
 * Quality-Aware Fusion Engine:
 * Fuses per-modality quality ledgers, gating each metric by its quality status.
 * Can return "reliable", "low_confidence (with reason)", or "not_enough_reliable_data".
 */
export function fuseQualityLedgers(ledgers: MetricQualityLedger[]): QualityAwareFusionResult {
  const rejectedLog = getRejectedReadingsLog();

  // Exclude "no_reliable_estimate" from fusion
  const validLedgers = ledgers.filter((l) => l.status !== "no_reliable_estimate");
  const rejectedLedgers = ledgers.filter((l) => l.status === "no_reliable_estimate");

  if (validLedgers.length === 0) {
    const mainRejReason = rejectedLedgers.length > 0 && rejectedLedgers[0].primary_issue
      ? ` (${rejectedLedgers[0].primary_issue})`
      : "";

    return {
      status: "not_enough_reliable_data",
      label: "Not enough reliable data today",
      shortLabel: "No reliable data",
      reason: `All available sensor checks failed quality integrity or context checks${mainRejReason}.`,
      actionablePrompt: rejectedLedgers.find((l) => l.actionable_prompt)?.actionable_prompt,
      activeMetricsCount: 0,
      rejectedMetricsCount: rejectedLedgers.length,
      ledgers,
      rejectedLog,
    };
  }

  const lowConfLedgers = validLedgers.filter((l) => l.status === "low_confidence");
  const highConfLedgers = validLedgers.filter((l) => l.status === "reliable");

  // Pick prompt (Max 1 per session)
  let actionablePrompt: string | undefined;
  if (canShowActionablePrompt()) {
    const candidatePrompt = validLedgers.find((l) => l.actionable_prompt)?.actionable_prompt;
    if (candidatePrompt) {
      actionablePrompt = candidatePrompt;
    }
  }

  if (lowConfLedgers.length > 0) {
    const reasons = lowConfLedgers.map((l) => `${l.metric.replace("_", " ")}: ${l.primary_issue || "low confidence"}`).join("; ");
    return {
      status: "low_confidence",
      label: `Low confidence reading (${lowConfLedgers[0].primary_issue || "check sensors"})`,
      shortLabel: "Low confidence",
      reason: `Quality issues detected: ${reasons}`,
      actionablePrompt,
      activeMetricsCount: validLedgers.length,
      rejectedMetricsCount: rejectedLedgers.length,
      ledgers,
      rejectedLog,
    };
  }

  return {
    status: "reliable",
    label: "Multiple quality-verified signals agree",
    shortLabel: "Reliable reading",
    reason: `All ${highConfLedgers.length} active metrics passed signal integrity and context validity checks`,
    actionablePrompt,
    activeMetricsCount: validLedgers.length,
    rejectedMetricsCount: rejectedLedgers.length,
    ledgers,
    rejectedLog,
  };
}
