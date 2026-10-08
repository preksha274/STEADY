import rawConfig from "@/config/severity_config.json";

export interface SeverityLevelConfig {
  level: "GOOD" | "MODERATE" | "HIGH" | "NO_DATA";
  label: string;
  status: "good" | "moderate" | "high" | "no_data";
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  hex: string;
  icon: string;
}

export interface SeverityConfig {
  version: string;
  name: string;
  disclaimer: string;
  tremor_ratio_thresholds: {
    good_max_pct: number;
    moderate_max_pct: number;
  };
  sustained_tremor_seconds: {
    moderate_min_s: number;
    high_min_s: number;
  };
  data_quality_pct: {
    good_min_pct: number;
    moderate_min_pct: number;
  };
  levels: Record<string, SeverityLevelConfig>;
}

export const severityConfig: SeverityConfig = rawConfig as SeverityConfig;

export interface SeverityEvaluation {
  level: "GOOD" | "MODERATE" | "HIGH" | "NO_DATA";
  label: string;
  status: "good" | "moderate" | "high" | "no_data";
  reason: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  hex: string;
  icon: "check" | "alert-triangle" | "alert-octagon" | "help-circle";
}

/**
 * Evaluate Movement Severity based on configured thresholds.
 * - GOOD: tremor ratio < 15% and no sustained live tremor
 * - MODERATE: tremor ratio 15% to 30% OR sustained tremor 10-30s
 * - HIGH: tremor ratio > 30% OR sustained tremor > 30s OR active family alert
 * - NO_DATA: missing or 0 tracked duration
 */
export function evaluateMovementSeverity(params: {
  tremorRatioPct: number | null | undefined;
  trackedSeconds?: number;
  sustainedTremorSeconds?: number;
  hasActiveAlert?: boolean;
  timeRangeLabel?: string;
  isConnected?: boolean;
}): SeverityEvaluation {
  const {
    tremorRatioPct,
    trackedSeconds = 0,
    sustainedTremorSeconds = 0,
    hasActiveAlert = false,
    timeRangeLabel = "today",
    isConnected = true,
  } = params;

  const cfg = severityConfig;
  const ratioThresh = cfg.tremor_ratio_thresholds;
  const sustainedThresh = cfg.sustained_tremor_seconds;

  // 1. NO DATA (or 0 tracked seconds)
  if (trackedSeconds <= 0 || tremorRatioPct === null || tremorRatioPct === undefined || (!isConnected && trackedSeconds === 0)) {
    const meta = cfg.levels.NO_DATA;
    return {
      level: "NO_DATA",
      label: meta.label,
      status: meta.status,
      reason: `No telemetry recorded for ${timeRangeLabel}`,
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      badgeBg: meta.badgeBg,
      badgeText: meta.badgeText,
      badgeBorder: meta.badgeBorder,
      hex: meta.hex,
      icon: "help-circle",
    };
  }

  // 2. HIGH: ratio > 30% OR sustained > 30s OR active family alert
  if (
    tremorRatioPct > ratioThresh.moderate_max_pct ||
    sustainedTremorSeconds >= sustainedThresh.high_min_s ||
    hasActiveAlert
  ) {
    const meta = cfg.levels.HIGH;
    let reason = `High: tremor-like movement for ${tremorRatioPct.toFixed(1)}% of ${timeRangeLabel}`;
    if (hasActiveAlert) {
      reason = "High: active family notice triggered";
    } else if (sustainedTremorSeconds >= sustainedThresh.high_min_s) {
      reason = `High: sustained tremor-like movement for ${Math.round(sustainedTremorSeconds)}s`;
    }

    return {
      level: "HIGH",
      label: meta.label,
      status: meta.status,
      reason,
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      badgeBg: meta.badgeBg,
      badgeText: meta.badgeText,
      badgeBorder: meta.badgeBorder,
      hex: meta.hex,
      icon: "alert-octagon",
    };
  }

  // 3. MODERATE: ratio 15% to 30% OR sustained 10 to 30s
  if (
    tremorRatioPct >= ratioThresh.good_max_pct ||
    sustainedTremorSeconds >= sustainedThresh.moderate_min_s
  ) {
    const meta = cfg.levels.MODERATE;
    let reason = `Moderate: tremor-like movement for ${tremorRatioPct.toFixed(1)}% of ${timeRangeLabel}`;
    if (sustainedTremorSeconds >= sustainedThresh.moderate_min_s) {
      reason = `Moderate: tremor-like movement sustained for ${Math.round(sustainedTremorSeconds)}s`;
    }

    return {
      level: "MODERATE",
      label: meta.label,
      status: meta.status,
      reason,
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      badgeBg: meta.badgeBg,
      badgeText: meta.badgeText,
      badgeBorder: meta.badgeBorder,
      hex: meta.hex,
      icon: "alert-triangle",
    };
  }

  // 4. GOOD: ratio < 15% and no sustained tremor
  const meta = cfg.levels.GOOD;
  return {
    level: "GOOD",
    label: meta.label,
    status: meta.status,
    reason: `Good: tremor-like movement at ${tremorRatioPct.toFixed(1)}% of ${timeRangeLabel}`,
    color: meta.color,
    textColor: meta.textColor,
    bgColor: meta.bgColor,
    borderColor: meta.borderColor,
    badgeBg: meta.badgeBg,
    badgeText: meta.badgeText,
    badgeBorder: meta.badgeBorder,
    hex: meta.hex,
    icon: "check",
  };
}

/**
 * Evaluate Data Quality Severity:
 * >= 90% GOOD, 70 to 90% MODERATE, < 70% HIGH (low reliability)
 */
export function evaluateQualitySeverity(qualityPct: number | null | undefined, totalSamples: number = 0): {
  level: "GOOD" | "MODERATE" | "HIGH" | "NO_DATA";
  label: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  hex: string;
  icon: "check" | "alert-triangle" | "alert-octagon" | "help-circle";
} {
  if (totalSamples <= 0 || qualityPct === null || qualityPct === undefined) {
    const meta = severityConfig.levels.NO_DATA;
    return {
      level: "NO_DATA",
      label: "No data",
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      hex: meta.hex,
      icon: "help-circle",
    };
  }

  const qThresh = severityConfig.data_quality_pct;
  if (qualityPct >= qThresh.good_min_pct) {
    const meta = severityConfig.levels.GOOD;
    return {
      level: "GOOD",
      label: "High Reliability",
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      hex: meta.hex,
      icon: "check",
    };
  } else if (qualityPct >= qThresh.moderate_min_pct) {
    const meta = severityConfig.levels.MODERATE;
    return {
      level: "MODERATE",
      label: "Moderate Reliability",
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      hex: meta.hex,
      icon: "alert-triangle",
    };
  } else {
    const meta = severityConfig.levels.HIGH;
    return {
      level: "HIGH",
      label: "Low Reliability - Gaps Detected",
      color: meta.color,
      textColor: meta.textColor,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      hex: meta.hex,
      icon: "alert-octagon",
    };
  }
}
