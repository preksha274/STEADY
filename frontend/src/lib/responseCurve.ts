import { getSessions, getBaseline, Session } from "./sessions";
import { getDiaryEntries, getDoseLogs, DiaryEntry, DoseLog } from "./diary";

export interface ResponseCurveBin {
  hoursBin: number; // e.g. 0.5, 1.0, 1.5 ... 6.0
  hoursLabel: string; // e.g. "0.5h", "1.0h"
  meanScore: number | null; // 0 (good) to 1 (hard)
  stdDev: number;
  minScore: number | null; // mean - stdDev (clamped to 0)
  maxScore: number | null; // mean + stdDev (clamped to 1)
  sampleCount: number;
}

export interface ResponseCurveResult {
  bins: ResponseCurveBin[];
  bestWindow: { startHours: number; endHours: number } | null;
  worstWindow: { startHours: number; endHours: number } | null;
  sampleCount: number;
  coverageLevel: "none" | "low" | "ok";
}

/**
 * Compute the movement difficulty score for a Session (0 good, 1 hard)
 */
function getSessionDifficulty(session: Session, baselineTremorMean?: number): number {
  const baseMean = baselineTremorMean || 0.28;
  // Tremor amplitude score relative to baseline
  const tremorScore = Math.min(1, Math.max(0, session.tremor.amplitude / (baseMean * 1.6)));

  if (session.gait && session.gait.cadence) {
    // Cadence score (lower cadence = harder)
    const gaitScore = Math.min(1, Math.max(0, (120 - session.gait.cadence) / 35));
    return Math.round((tremorScore * 0.7 + gaitScore * 0.3) * 100) / 100;
  }

  return Math.round(tremorScore * 100) / 100;
}

/**
 * Compute the movement difficulty score for a DiaryEntry (0 good, 1 hard)
 */
function getDiaryDifficulty(entry: DiaryEntry): number {
  const symptomAvg =
    (entry.symptoms.tremor + entry.symptoms.slowness + entry.symptoms.freezing) / 9; // 0 to 1
  const fatigueScore = (entry.fatigue - 1) / 4; // 0 to 1
  const moodScore = (4 - entry.mood) / 3; // 0 to 1 (lower mood = higher difficulty)

  const score = symptomAvg * 0.5 + fatigueScore * 0.3 + moodScore * 0.2;
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

/**
 * Build the Response Curve model relating hours-since-dose to movement difficulty.
 */
export function buildResponseCurve(isDemoMode: boolean = true): ResponseCurveResult {
  if (typeof window === "undefined") {
    return {
      bins: [],
      bestWindow: null,
      worstWindow: null,
      sampleCount: 0,
      coverageLevel: "none",
    };
  }

  const sessions = getSessions(isDemoMode);
  const diaryEntries = getDiaryEntries(isDemoMode);
  const doseLogs = getDoseLogs(isDemoMode);
  const baseline = getBaseline(undefined, isDemoMode);
  const baseTremorMean = baseline?.tremorAmplitudeMean;

  // Sort dose logs by timestamp ascending
  const sortedDoses = [...doseLogs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  interface DataPoint {
    hoursSinceDose: number;
    difficulty: number;
  }

  const dataPoints: DataPoint[] = [];

  // Helper to find hours since preceding dose
  const getHoursSinceLastDose = (eventTimeIso: string): number | null => {
    const eventTimeMs = new Date(eventTimeIso).getTime();
    const priorDoses = sortedDoses.filter(
      (d) => new Date(d.timestamp).getTime() <= eventTimeMs
    );
    if (priorDoses.length === 0) return null;
    const lastDoseMs = new Date(priorDoses[priorDoses.length - 1].timestamp).getTime();
    const diffHours = (eventTimeMs - lastDoseMs) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 6.0 ? diffHours : null;
  };

  // Process Sessions
  sessions.forEach((s) => {
    const hrs = getHoursSinceLastDose(s.timestamp);
    if (hrs !== null) {
      const difficulty = getSessionDifficulty(s, baseTremorMean);
      dataPoints.push({ hoursSinceDose: hrs, difficulty });
    }
  });

  // Process Diary Entries
  diaryEntries.forEach((e) => {
    const hrs = getHoursSinceLastDose(e.timestamp);
    if (hrs !== null) {
      const difficulty = getDiaryDifficulty(e);
      dataPoints.push({ hoursSinceDose: hrs, difficulty });
    }
  });

  // Define 12 half-hour bins from 0.0 to 6.0h (0.0-0.5, 0.5-1.0, ..., 5.5-6.0)
  const bins: ResponseCurveBin[] = [];
  const BIN_COUNT = 12;

  for (let b = 0; b < BIN_COUNT; b++) {
    const binStart = b * 0.5;
    const binEnd = (b + 1) * 0.5;
    const hoursBin = Math.round(((binStart + binEnd) / 2) * 10) / 10;

    const matchingPoints = dataPoints.filter(
      (p) => p.hoursSinceDose >= binStart && p.hoursSinceDose < binEnd
    );

    if (matchingPoints.length > 0) {
      const scores = matchingPoints.map((p) => p.difficulty);
      const meanScore =
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;

      // Variance & StdDev
      const variance =
        scores.reduce((acc, val) => acc + Math.pow(val - meanScore, 2), 0) /
        scores.length;
      const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

      const minScore = Math.max(0, Math.round((meanScore - stdDev) * 100) / 100);
      const maxScore = Math.min(1, Math.round((meanScore + stdDev) * 100) / 100);

      bins.push({
        hoursBin,
        hoursLabel: `${hoursBin}h`,
        meanScore,
        stdDev,
        minScore,
        maxScore,
        sampleCount: scores.length,
      });
    } else {
      bins.push({
        hoursBin,
        hoursLabel: `${hoursBin}h`,
        meanScore: null,
        stdDev: 0,
        minScore: null,
        maxScore: null,
        sampleCount: 0,
      });
    }
  }

  const sampleCount = dataPoints.length;
  const coverageLevel: "none" | "low" | "ok" =
    sampleCount < 5 ? "none" : sampleCount < 15 ? "low" : "ok";

  // Find best window (lowest difficulty 1.5h span) and worst window (highest difficulty 1.5h span)
  let bestWindow: { startHours: number; endHours: number } | null = null;
  let worstWindow: { startHours: number; endHours: number } | null = null;

  if (sampleCount >= 5) {
    let minWindowMean = Infinity;
    let maxWindowMean = -Infinity;

    // Check sliding 3-bin windows (1.5 hours)
    for (let i = 0; i <= bins.length - 3; i++) {
      const windowBins = bins.slice(i, i + 3).filter((b) => b.meanScore !== null);
      if (windowBins.length >= 2) {
        const windowMean =
          windowBins.reduce((acc, b) => acc + (b.meanScore || 0), 0) /
          windowBins.length;

        const startH = bins[i].hoursBin - 0.25;
        const endH = bins[i + 2].hoursBin + 0.25;

        if (windowMean < minWindowMean) {
          minWindowMean = windowMean;
          bestWindow = { startHours: startH, endHours: endH };
        }
        if (windowMean > maxWindowMean) {
          maxWindowMean = windowMean;
          worstWindow = { startHours: startH, endHours: endH };
        }
      }
    }
  }

  return {
    bins,
    bestWindow,
    worstWindow,
    sampleCount,
    coverageLevel,
  };
}
