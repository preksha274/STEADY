import { getSessions, getBaseline, getChangeFromBaseline, Session } from "./sessions";
import { getDiaryEntries, DiaryEntry } from "./diary";

export interface SymptomSeverity {
  level: "mild" | "moderate" | "high";
  label: string; // "Mild", "Moderate", "High"
  description: string; // "Compared to your usual"
  source: "seed" | "user";
}

export interface SeverityResult {
  tremor: SymptomSeverity;
  slowness: SymptomSeverity;
  freezing: SymptomSeverity;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  hasSeededData: boolean;
  isLiveSession: boolean;
}

/**
 * Maps a numeric severity score (1-3) to level string and label.
 */
function mapScoreToLevel(score: number): { level: "mild" | "moderate" | "high"; label: string } {
  if (score <= 1.4) {
    return { level: "mild", label: "Mild" };
  }
  if (score <= 2.3) {
    return { level: "moderate", label: "Moderate" };
  }
  return { level: "high", label: "High" };
}

/**
 * Calculate symptom severity levels blending latest movement session and diary check-in.
 * Wording strictly enforces "Compared to your usual".
 */
export function getSeverity(isDemoMode: boolean = true): SeverityResult {
  if (typeof window === "undefined") {
    return {
      tremor: { level: "mild", label: "Mild", description: "Compared to your usual", source: "seed" },
      slowness: { level: "mild", label: "Mild", description: "Compared to your usual", source: "seed" },
      freezing: { level: "mild", label: "Mild", description: "Compared to your usual", source: "seed" },
      confidence: "low",
      confidenceReason: "No data loaded yet",
      hasSeededData: true,
      isLiveSession: false,
    };
  }

  const sessions = getSessions(isDemoMode);
  const diaryEntries = getDiaryEntries(isDemoMode);

  const latestSession: Session | null = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const latestDiary: DiaryEntry | null = diaryEntries.length > 0 ? diaryEntries[0] : null;

  const hasSession = latestSession !== null;
  const hasDiary = latestDiary !== null;

  // Determine source
  const isSessionSeeded = latestSession ? (latestSession.source === "seed" || latestSession.source === "demo") : false;
  const isDiarySeeded = latestDiary ? latestDiary.source === "seed" : false;
  const hasSeededData = isSessionSeeded || isDiarySeeded;

  // 1. Tremor Severity Computation
  let tremorObjScore = 2; // Default moderate
  if (latestSession) {
    const comp = getChangeFromBaseline(latestSession, isDemoMode);
    if (comp?.tremorAmplitude) {
      if (comp.tremorAmplitude.direction === "better") tremorObjScore = 1;
      else if (comp.tremorAmplitude.direction === "worse") tremorObjScore = 3;
      else tremorObjScore = 2;
    } else {
      tremorObjScore = latestSession.tremor.intensity === "mild" ? 1 : latestSession.tremor.intensity === "high" ? 3 : 2;
    }
  }

  let tremorSubjScore = 2;
  if (latestDiary) {
    const raw = latestDiary.symptoms.tremor;
    tremorSubjScore = raw === 0 ? 1 : raw === 1 ? 1 : raw === 2 ? 2 : 3;
  }

  const blendedTremorScore = hasSession && hasDiary
    ? Math.round((tremorObjScore * 0.5 + tremorSubjScore * 0.5) * 10) / 10
    : hasSession ? tremorObjScore : hasDiary ? tremorSubjScore : 2;

  const tremorMap = mapScoreToLevel(blendedTremorScore);

  // 2. Slowness (Bradykinesia) Severity Computation
  let slownessObjScore = 2;
  if (latestSession?.gait?.cadence) {
    const c = latestSession.gait.cadence;
    slownessObjScore = c >= 110 ? 1 : c >= 100 ? 2 : 3;
  }

  let slownessSubjScore = 2;
  if (latestDiary) {
    const raw = latestDiary.symptoms.slowness;
    slownessSubjScore = raw === 0 ? 1 : raw === 1 ? 1 : raw === 2 ? 2 : 3;
  }

  const blendedSlownessScore = hasSession && hasDiary
    ? Math.round((slownessObjScore * 0.4 + slownessSubjScore * 0.6) * 10) / 10
    : hasSession ? slownessObjScore : hasDiary ? slownessSubjScore : 2;

  const slownessMap = mapScoreToLevel(blendedSlownessScore);

  // 3. Freezing of Gait Severity Computation
  let freezingSubjScore = 1;
  if (latestDiary) {
    const raw = latestDiary.symptoms.freezing;
    freezingSubjScore = raw === 0 ? 1 : raw === 1 ? 1 : raw === 2 ? 2 : 3;
  }

  const blendedFreezingScore = freezingSubjScore;
  const freezingMap = mapScoreToLevel(blendedFreezingScore);

  // 4. Confidence Level
  let confidence: "high" | "medium" | "low" = "low";
  let confidenceReason = "";

  if (hasSession && hasDiary) {
    confidence = "high";
    confidenceReason = "Combined sensor session & recent diary check-in";
  } else if (hasSession) {
    confidence = "low";
    confidenceReason = "Based on movement analysis only; diary check-in pending";
  } else if (hasDiary) {
    confidence = "low";
    confidenceReason = "Based on diary check-in only; movement test pending";
  } else {
    confidence = "low";
    confidenceReason = "Insufficient check-in & movement data";
  }

  return {
    tremor: {
      level: tremorMap.level,
      label: tremorMap.label,
      description: "Compared to your usual",
      source: isSessionSeeded ? "seed" : "user",
    },
    slowness: {
      level: slownessMap.level,
      label: slownessMap.label,
      description: "Compared to your usual",
      source: isDiarySeeded ? "seed" : "user",
    },
    freezing: {
      level: freezingMap.level,
      label: freezingMap.label,
      description: "Compared to your usual",
      source: isDiarySeeded ? "seed" : "user",
    },
    confidence,
    confidenceReason,
    hasSeededData,
    isLiveSession: latestSession?.source === "live",
  };
}
