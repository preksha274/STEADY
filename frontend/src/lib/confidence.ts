import { getSessions } from "./sessions";
import { getDiaryEntries } from "./diary";
import {
  buildMetricQualityLedger,
  fuseQualityLedgers,
  MetricQualityLedger,
  QualityAwareFusionResult,
  getRejectedReadingsLog,
  canShowActionablePrompt,
  markActionablePromptShown,
} from "./qualityLedger";

export * from "./qualityLedger";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  reason: string;
}

export interface IMUQualityFlags {
  duration_s?: number;
  is_short?: boolean;
  is_noisy?: boolean;
  missing_samples_pct?: number;
}

export interface EEGQualityFlags {
  duration_s?: number;
  flat_channels?: string[];
  artifact_channels?: string[];
  line_noise_present?: boolean;
  is_short?: boolean;
}

export interface CameraQualityFlags {
  duration_s?: number;
  avg_foot_visibility?: number;
  is_feet_visible?: boolean;
}

export type CompositeCode =
  | "multiple_agree"
  | "mixed_signals"
  | "single_metric"
  | "normal_agree"
  | "insufficient_data";

export interface CompositeConfidenceResult {
  code: CompositeCode;
  level: "high" | "medium" | "low";
  label: string;
  shortLabel: string;
  reason: string;
  availableCount: number;
  unusualCount: number;
  flaggedModalities: string[];
  qualityFusion?: QualityAwareFusionResult;
}

export interface VoiceCheckRecord {
  id: string;
  timestamp: string;
  loudnessDb: number;
  source?: "user" | "seed";
}

const VOICE_CHECK_STORAGE_KEY = "movepilot_voice_checks";

/**
 * Fetch voice check records from localStorage, seeding if empty in demo mode.
 */
export function getVoiceChecks(isDemoMode: boolean = true): VoiceCheckRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(VOICE_CHECK_STORAGE_KEY);
    if (!raw) {
      return seedDemoVoiceChecks();
    }
    const logs: VoiceCheckRecord[] = JSON.parse(raw);
    if (!Array.isArray(logs) || logs.length === 0) {
      return seedDemoVoiceChecks();
    }
    return isDemoMode ? logs : logs.filter((l) => l.source === "user" || !l.source);
  } catch (e) {
    console.error("Failed to read voice checks from localStorage", e);
    return seedDemoVoiceChecks();
  }
}

/**
 * Save a new voice check entry.
 */
export function saveVoiceCheck(entry: Omit<VoiceCheckRecord, "id">): VoiceCheckRecord {
  const newEntry: VoiceCheckRecord = {
    ...entry,
    id: "voice_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
  };
  if (typeof window !== "undefined") {
    try {
      const existing = getVoiceChecks(true);
      const updated = [newEntry, ...existing];
      localStorage.setItem(VOICE_CHECK_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save voice check", e);
    }
  }
  return newEntry;
}

/**
 * Seed demo voice check records over 18 sample history days matching seedDemoSessions.
 */
export function seedDemoVoiceChecks(forceReset: boolean = false): VoiceCheckRecord[] {
  if (typeof window === "undefined") return [];

  const now = new Date();
  const seeded: VoiceCheckRecord[] = [];

  for (let i = 17; i >= 0; i--) {
    const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayDate.setHours(10, 15, 0, 0);

    // Days 15, 7, and 4 flag unusual hypophonia (<55 dB)
    const isUnusualVoice = i === 15 || i === 7 || i === 4;
    const loudnessDb = isUnusualVoice ? (i === 15 ? 48 : i === 7 ? 50 : 52) : 68;

    seeded.push({
      id: `seed_voice_${18 - i}`,
      timestamp: dayDate.toISOString(),
      loudnessDb,
      source: "seed",
    });
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(VOICE_CHECK_STORAGE_KEY, JSON.stringify(seeded));
    } catch (e) {
      console.error("Failed to save seeded voice checks", e);
    }
  }

  return seeded;
}

function formatDateKey(dateInput?: Date | string): string {
  const d = dateInput
    ? typeof dateInput === "string"
      ? new Date(dateInput)
      : dateInput
    : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

/**
 * Computes a Composite Confidence score by fusing independent modalities
 * (tremor, gait, voice check, diary) for a given date.
 */
export function computeCompositeConfidence(
  dateInput?: Date | string,
  isDemoMode: boolean = true
): CompositeConfidenceResult {
  const targetKey = formatDateKey(dateInput);

  let availableCount = 0;
  let unusualCount = 0;
  const flaggedModalities: string[] = [];

  if (typeof window === "undefined") {
    return {
      code: "insufficient_data",
      level: "low",
      label: "No modality readings recorded today",
      shortLabel: "No signals recorded",
      reason: "No sensor or diary entries found for target date",
      availableCount: 0,
      unusualCount: 0,
      flaggedModalities: [],
    };
  }

  // 1. Tremor Modality
  try {
    const sessions = getSessions(isDemoMode).filter(
      (s) => formatDateKey(s.timestamp) === targetKey
    );
    if (sessions.length > 0) {
      availableCount++;
      const isUnusual = sessions.some(
        (s) =>
          s.tremor.amplitude > 0.28 ||
          s.tremor.intensity === "high" ||
          s.tremor.frequencyHz < 3.8 ||
          s.tremor.frequencyHz > 5.8
      );
      if (isUnusual) {
        unusualCount++;
        flaggedModalities.push("Tremor");
      }
    }
  } catch (e) {
    console.error("Error evaluating tremor for composite confidence", e);
  }

  // 2. Gait Modality
  try {
    const gaitSessions = getSessions(isDemoMode).filter(
      (s) => s.gait && formatDateKey(s.timestamp) === targetKey
    );
    let gaitResultRecorded = false;
    try {
      const rawGait =
        localStorage.getItem("steady_gait_result") ||
        localStorage.getItem("movepilot_gait_result");
      if (rawGait) {
        const parsed = JSON.parse(rawGait);
        if (parsed?.analyzed_at && formatDateKey(parsed.analyzed_at) === targetKey) {
          gaitResultRecorded = true;
        }
      }
    } catch (e) {}

    if (gaitSessions.length > 0 || gaitResultRecorded) {
      availableCount++;
      const isUnusual = gaitSessions.some(
        (s) => (s.gait && s.gait.cadence < 100) || (s.gait && s.gait.symmetry < 85)
      );
      if (isUnusual) {
        unusualCount++;
        flaggedModalities.push("Gait");
      }
    }
  } catch (e) {
    console.error("Error evaluating gait for composite confidence", e);
  }

  // 3. Voice Check Modality
  try {
    const voiceEntries = getVoiceChecks(isDemoMode).filter(
      (v) => formatDateKey(v.timestamp) === targetKey
    );
    if (voiceEntries.length > 0) {
      availableCount++;
      const isUnusual = voiceEntries.some(
        (v) => v.loudnessDb < 55 || v.loudnessDb > 78
      );
      if (isUnusual) {
        unusualCount++;
        flaggedModalities.push("Voice");
      }
    }
  } catch (e) {
    console.error("Error evaluating voice check for composite confidence", e);
  }

  // 4. Diary Entry Modality
  try {
    const diaryEntries = getDiaryEntries(isDemoMode).filter(
      (d) => formatDateKey(d.timestamp) === targetKey
    );
    if (diaryEntries.length > 0) {
      availableCount++;
      const isUnusual = diaryEntries.some(
        (d) =>
          d.fatigue >= 4 ||
          (d.sleepQuality && d.sleepQuality <= 2) ||
          d.symptoms.tremor >= 2 ||
          d.symptoms.slowness >= 2 ||
          d.symptoms.freezing >= 1 ||
          d.mood <= 2
      );
      if (isUnusual) {
        unusualCount++;
        flaggedModalities.push("Diary");
      }
    }
  } catch (e) {
    console.error("Error evaluating diary for composite confidence", e);
  }

  const normalCount = availableCount - unusualCount;

  // Construct Quality Ledgers for modalities
  const ledgers: MetricQualityLedger[] = [];

  // Tremor Ledger
  if (availableCount > 0) {
    ledgers.push(
      buildMetricQualityLedger({
        modality: "phone_imu",
        metric: "tremor_power",
        rawValue: 4.8,
        noiseLevel: "low",
        taskValid: true,
        environmentValid: true,
        epistemicScore: 0.88,
      })
    );
  }

  // Gait Ledger
  if (flaggedModalities.includes("Gait") || availableCount > 1) {
    ledgers.push(
      buildMetricQualityLedger({
        modality: "camera_pose",
        metric: "stride_variability",
        rawValue: 94,
        taskValid: true,
        environmentValid: true,
        epistemicScore: 0.85,
      })
    );
  }

  // Voice Ledger
  const voiceChecksToday = getVoiceChecks(isDemoMode).filter(
    (v) => formatDateKey(v.timestamp) === targetKey
  );
  if (voiceChecksToday.length > 0) {
    const vDb = voiceChecksToday[0].loudnessDb;
    const isQuietEnv = vDb >= 55 && vDb <= 80;
    ledgers.push(
      buildMetricQualityLedger({
        modality: "voice",
        metric: "voice_jitter",
        rawValue: vDb,
        taskValid: isQuietEnv,
        environmentValid: isQuietEnv,
        epistemicScore: isQuietEnv ? 0.9 : 0.4,
      })
    );
  }

  const qualityFusion = fuseQualityLedgers(ledgers);

  // Rule 1: 2+ modalities agree that day is unusual
  if (availableCount >= 2 && unusualCount >= 2) {
    return {
      code: "multiple_agree",
      level: "high",
      label: "Multiple signals agree this is different from your usual",
      shortLabel: "Multiple signals agree",
      reason: `${unusualCount} independent signals (${flaggedModalities.join(", ")}) flagged unusual patterns`,
      availableCount,
      unusualCount,
      flaggedModalities,
      qualityFusion,
    };
  }

  // Rule 2: Modalities disagree (at least 1 unusual, at least 1 normal)
  if (availableCount >= 2 && unusualCount >= 1 && normalCount >= 1) {
    return {
      code: "mixed_signals",
      level: "medium",
      label: "Signals are mixed today — worth another check-in",
      shortLabel: "Signals mixed today",
      reason: `${unusualCount} signal (${flaggedModalities.join(", ")}) flagged unusual while ${normalCount} recorded baseline`,
      availableCount,
      unusualCount,
      flaggedModalities,
      qualityFusion,
    };
  }

  // Rule 3: 2+ modalities agree that day is within baseline
  if (availableCount >= 2 && unusualCount === 0) {
    return {
      code: "normal_agree",
      level: "high",
      label: "Multiple signals agree within your usual range",
      shortLabel: "Multiple signals agree",
      reason: `All ${availableCount} available modalities recorded typical baseline readings`,
      availableCount,
      unusualCount: 0,
      flaggedModalities: [],
      qualityFusion,
    };
  }

  // Rule 4: Only 1 modality recorded
  if (availableCount === 1) {
    return {
      code: "single_metric",
      level: "medium",
      label: "Single modality check-in recorded",
      shortLabel: "Single signal check-in",
      reason: `1 modality reading available (${unusualCount > 0 ? flaggedModalities[0] + " flagged" : "baseline"})`,
      availableCount: 1,
      unusualCount,
      flaggedModalities,
      qualityFusion,
    };
  }

  // Fallback
  return {
    code: "insufficient_data",
    level: "low",
    label: "No modality readings recorded today",
    shortLabel: "No signals recorded",
    reason: "No sensor or diary entries found for target date",
    availableCount: 0,
    unusualCount: 0,
    flaggedModalities: [],
    qualityFusion,
  };
}

/**
 * Maps IMU quality flags to confidence level & combined reason
 */
export function evaluateIMUConfidence(quality: IMUQualityFlags): ConfidenceResult {
  const issues: string[] = [];
  let worstLevel: ConfidenceLevel = "high";

  if (quality.is_short || (quality.duration_s && quality.duration_s < 10.0)) {
    issues.push("Short recording (<10s)");
    worstLevel = "medium";
  }

  if (quality.missing_samples_pct && quality.missing_samples_pct > 5.0) {
    issues.push(`Missing samples (${quality.missing_samples_pct.toFixed(1)}%)`);
    worstLevel = "low";
  }

  if (quality.is_noisy) {
    issues.push("High motion noise detected");
    worstLevel = "low";
  }

  if (issues.length === 0) {
    return {
      level: "high",
      reason: "Sufficient duration & steady signal baseline",
    };
  }

  return {
    level: worstLevel,
    reason: issues.join("; "),
  };
}

/**
 * Maps EEG quality flags to confidence level & combined reason
 */
export function evaluateEEGConfidence(quality: EEGQualityFlags): ConfidenceResult {
  const issues: string[] = [];
  let worstLevel: ConfidenceLevel = "high";

  if (quality.flat_channels && quality.flat_channels.length > 0) {
    issues.push(`Flat channel(s): ${quality.flat_channels.join(", ")}`);
    worstLevel = "low";
  }

  if (quality.artifact_channels && quality.artifact_channels.length > 0) {
    issues.push(`Artifacts in: ${quality.artifact_channels.join(", ")}`);
    if (quality.artifact_channels.length > 1) worstLevel = "low";
    else if (worstLevel !== "low") worstLevel = "medium";
  }

  if (quality.line_noise_present) {
    issues.push("Strong 50/60Hz mains line noise");
    if (worstLevel !== "low") worstLevel = "medium";
  }

  if (quality.is_short || (quality.duration_s && quality.duration_s < 10.0)) {
    issues.push("Short EEG sample (<10s)");
    if (worstLevel !== "low") worstLevel = "medium";
  }

  if (issues.length === 0) {
    return {
      level: "high",
      reason: "Clean multi-channel EEG without artifacts",
    };
  }

  return {
    level: worstLevel,
    reason: issues.join("; "),
  };
}

/**
 * Maps Camera / Gait quality flags to confidence level & combined reason
 */
export function evaluateCameraConfidence(quality: CameraQualityFlags): ConfidenceResult {
  const issues: string[] = [];
  let worstLevel: ConfidenceLevel = "high";

  if (quality.is_feet_visible === false || (quality.avg_foot_visibility && quality.avg_foot_visibility < 0.45)) {
    issues.push("Can't see your feet (low ankle visibility)");
    worstLevel = "low";
  } else if (quality.avg_foot_visibility && quality.avg_foot_visibility < 0.7) {
    issues.push("Partial foot visibility across frames");
    worstLevel = "medium";
  }

  if (quality.duration_s && quality.duration_s < 4.0) {
    issues.push("Short walking clip (<4s)");
    if (worstLevel !== "low") worstLevel = "medium";
  }

  if (issues.length === 0) {
    return {
      level: "high",
      reason: "Clear foot visibility & full-body gait tracking",
    };
  }

  return {
    level: worstLevel,
    reason: issues.join("; "),
  };
}
