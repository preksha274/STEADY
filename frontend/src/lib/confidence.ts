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
