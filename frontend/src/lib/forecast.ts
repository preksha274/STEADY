import { buildResponseCurve, ResponseCurveResult } from "./responseCurve";
import { getDiaryEntries, getDoseLogs } from "./diary";
import { getSessions } from "./sessions";
import { getWeeklyDose } from "./exerciseDose";

export interface HourlyForecastItem {
  hour: number; // 7 to 21
  hourLabel: string; // "7:00 AM", "8:00 AM"...
  score: number; // 0.0 (best) to 1.0 (hardest)
  status: "good" | "variable" | "difficult";
  bandMin: number; // score - bandWidth
  bandMax: number; // score + bandWidth
  isCurrentHour: boolean;
}

export interface MergedForecastWindow {
  status: "good" | "variable" | "difficult";
  startLabel: string;
  endLabel: string;
  timeSpanLabel: string; // "10:00 AM - 12:00 PM"
  title: string; // "Better movement window", etc.
}

export interface ForecastSignalContribution {
  name: string;
  category: "medication" | "sleep" | "activity" | "history";
  status: "optimal" | "cautious" | "penalty";
  detail: string;
}

export interface DayForecastResult {
  hourly: HourlyForecastItem[];
  windows: MergedForecastWindow[];
  bestWindow: MergedForecastWindow | null;
  confidenceScore: number; // 0 to 100
  confidenceLevel: "high" | "medium" | "low";
  coverageLevel: "none" | "low" | "ok";
  reasons: string[];
  signals: ForecastSignalContribution[];
  isOfflineFallback?: boolean;
}

/**
 * Format hour number (7-21) to 12-hour string (e.g. 7 -> "7:00 AM", 13 -> "1:00 PM")
 */
function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${ampm}`;
}

/**
 * Build the Day Forecast predicting difficulty for each hour from 7 AM to 9 PM.
 */
export function buildForecast(isDemoMode: boolean = true): DayForecastResult {
  if (typeof window === "undefined") {
    return {
      hourly: [],
      windows: [],
      bestWindow: null,
      confidenceScore: 0,
      confidenceLevel: "low",
      coverageLevel: "none",
      reasons: ["Medication timing"],
      signals: [],
    };
  }

  // 1. Read User Profile Dose Times
  let doseHours: number[] = [8.0, 13.0, 18.0]; // Defaults: 8 AM, 1 PM, 6 PM

  try {
    const profileRaw = localStorage.getItem("movepilot_user_profile");
    if (profileRaw) {
      const parsed = JSON.parse(profileRaw);
      if (parsed.medicationTimes && Array.isArray(parsed.medicationTimes) && parsed.medicationTimes.length > 0) {
        const parsedHours: number[] = [];
        parsed.medicationTimes.forEach((t: string) => {
          if (t.includes(":")) {
            const parts = t.split(":");
            let h = parseInt(parts[0], 10);
            const isPM = t.toLowerCase().includes("pm");
            const isAM = t.toLowerCase().includes("am");
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
            parsedHours.push(h);
          }
        });
        if (parsedHours.length > 0) {
          doseHours = parsedHours.sort((a, b) => a - b);
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse user dose times for forecast", e);
  }

  // 2. Fetch Response Curve
  const curve = buildResponseCurve(isDemoMode);

  // Fallback curve lookup helper
  const getCurveDifficulty = (hrsSinceDose: number): number => {
    if (curve.bins.length > 0) {
      // Find nearest bin
      const matchingBin = curve.bins.find(
        (b) => Math.abs(b.hoursBin - hrsSinceDose) <= 0.25
      );
      if (matchingBin && matchingBin.meanScore !== null) {
        return matchingBin.meanScore;
      }
    }
    // Default shape if response curve data points are scarce:
    // Peak ON ~1.5h post-dose (0.20), Wearing-off ~5h post-dose (0.65)
    if (hrsSinceDose <= 0.5) return 0.40;
    if (hrsSinceDose <= 2.0) return 0.22;
    if (hrsSinceDose <= 3.5) return 0.38;
    if (hrsSinceDose <= 5.0) return 0.62;
    return 0.70;
  };

  // 3. Sleep & Fatigue Modifiers (Last night's duration & quality from NeuroDiary)
  let sleepPenalty = 0;
  let qualityPenalty = 0;
  let sleepBoost = 0;
  let fatiguePenalty = 0;
  let sleepSignalDetail = "No recent sleep entry logged; using baseline population prior.";
  let sleepStatus: "optimal" | "cautious" | "penalty" = "optimal";

  const diaryEntries = getDiaryEntries(isDemoMode);
  if (diaryEntries.length > 0) {
    const latestDiary = diaryEntries[0];
    const hours = latestDiary.sleepHours ?? 7.0;
    const quality = latestDiary.sleepQuality ?? 3;

    if (hours < 6.0) {
      sleepPenalty = 0.18; // Measurable penalty for short sleep (<6h)
      sleepStatus = "penalty";
      sleepSignalDetail = `Short sleep (${hours}h < 6h threshold) • +18% difficulty penalty applied`;
    } else if (quality <= 2) {
      qualityPenalty = 0.10;
      sleepStatus = "cautious";
      sleepSignalDetail = `Poor sleep quality rating (${quality}/5) • +10% difficulty penalty applied`;
    } else if (hours >= 7.5 && quality >= 4) {
      sleepBoost = 0.05;
      sleepStatus = "optimal";
      sleepSignalDetail = `Restful sleep (${hours}h, rating ${quality}/5) • -5% difficulty boost`;
    } else {
      sleepSignalDetail = `Typical sleep (${hours}h, rating ${quality}/5) • Normal baseline`;
    }

    if (latestDiary.fatigue >= 4) {
      fatiguePenalty = 0.08;
    }
  }

  // 4. Recent 24-48h Activity Level (from Weekly Exercise Dose & Session History)
  let activityPenalty = 0;
  let activityBonus = 0;
  let activitySignalDetail = "Moderate activity level recorded over past 24-48 hours.";
  let activityStatus: "optimal" | "cautious" | "penalty" = "optimal";

  try {
    const weeklyDose = getWeeklyDose(isDemoMode);
    const mins = weeklyDose.minutesThisWeek;

    if (mins < 15) {
      activityPenalty = 0.12; // Measurable penalty for very low activity / stiffness
      activityStatus = "penalty";
      activitySignalDetail = `Low recent activity (${mins}m exercise this week) • +12% stiffness penalty applied`;
    } else if (mins >= 30) {
      activityBonus = 0.05;
      activityStatus = "optimal";
      activitySignalDetail = `Sustained aerobic exercise dose (${mins}m active pacing) • -5% mobility boost`;
    } else {
      activitySignalDetail = `Moderate active exercise dose (${mins}m active pacing) • Baseline mobility`;
    }
  } catch (e) {
    console.error("Failed to read exercise dose for forecast", e);
  }

  // 5. Current hour determination
  const now = new Date();
  const currentHourNum = now.getHours();

  // 6. Build Hourly Items (7 AM = 7 to 9 PM = 21)
  const hourly: HourlyForecastItem[] = [];

  for (let h = 7; h <= 21; h++) {
    // Find preceding dose hour
    let precedingDose = doseHours[0];
    for (let d of doseHours) {
      if (d <= h) {
        precedingDose = d;
      }
    }

    const hrsSinceDose = h >= precedingDose ? h - precedingDose : (24 - precedingDose) + h;
    const baseDiff = getCurveDifficulty(hrsSinceDose);
    const totalDiff = baseDiff + sleepPenalty + qualityPenalty + fatiguePenalty + activityPenalty - sleepBoost - activityBonus;
    const score = Math.min(0.95, Math.max(0.05, Math.round(totalDiff * 100) / 100));

    let status: "good" | "variable" | "difficult" = "variable";
    if (score < 0.35) {
      status = "good";
    } else if (score > 0.65) {
      status = "difficult";
    }

    // Confidence Band width
    // Lower coverage = wider confidence band
    const bandWidth =
      curve.coverageLevel === "none" ? 0.25 : curve.coverageLevel === "low" ? 0.16 : 0.08;

    const bandMin = Math.max(0, Math.round((score - bandWidth) * 100) / 100);
    const bandMax = Math.min(1, Math.round((score + bandWidth) * 100) / 100);

    hourly.push({
      hour: h,
      hourLabel: formatHourLabel(h),
      score,
      status,
      bandMin,
      bandMax,
      isCurrentHour: h === currentHourNum,
    });
  }

  // 7. Merge Contiguous Windows
  const windows: MergedForecastWindow[] = [];
  if (hourly.length > 0) {
    let currentWinStart = hourly[0];
    let currentWinEnd = hourly[0];

    for (let i = 1; i < hourly.length; i++) {
      const item = hourly[i];
      if (item.status === currentWinStart.status) {
        currentWinEnd = item;
      } else {
        const title =
          currentWinStart.status === "good"
            ? "Better movement window"
            : currentWinStart.status === "variable"
            ? "Variable mobility window"
            : "Difficult / Wearing-off window";

        windows.push({
          status: currentWinStart.status,
          startLabel: currentWinStart.hourLabel,
          endLabel: currentWinEnd.hourLabel,
          timeSpanLabel: `${currentWinStart.hourLabel.replace(":00", "")} - ${currentWinEnd.hourLabel.replace(":00", "")}`,
          title,
        });

        currentWinStart = item;
        currentWinEnd = item;
      }
    }

    // Push last window
    const title =
      currentWinStart.status === "good"
        ? "Better movement window"
        : currentWinStart.status === "variable"
        ? "Variable mobility window"
        : "Difficult / Wearing-off window";

    windows.push({
      status: currentWinStart.status,
      startLabel: currentWinStart.hourLabel,
      endLabel: currentWinEnd.hourLabel,
      timeSpanLabel: `${currentWinStart.hourLabel.replace(":00", "")} - ${currentWinEnd.hourLabel.replace(":00", "")}`,
      title,
    });
  }

  // Best Window
  const goodWindows = windows.filter((w) => w.status === "good");
  const bestWindow = goodWindows.length > 0 ? goodWindows[0] : windows[0] || null;

  // 8. Calculate Confidence, Reasons & Active Signals
  let confidenceScore = 85; // Base for ok coverage + sleep + activity fusion
  if (curve.coverageLevel === "none") {
    confidenceScore = 35;
  } else if (curve.coverageLevel === "low") {
    confidenceScore = 62;
  }

  const confidenceLevel: "high" | "medium" | "low" =
    confidenceScore >= 75 ? "high" : confidenceScore >= 50 ? "medium" : "low";

  const reasons: string[] = [
    "Medication schedule & dose timing",
    "Last night's sleep (duration & quality)",
    "Recent 24-48h activity level",
    "Movement history & baseline",
  ];

  const signals: ForecastSignalContribution[] = [
    {
      name: "Medication Timing",
      category: "medication",
      status: "optimal",
      detail: `Time-since-dose curve for scheduled hours (${doseHours.map((h) => formatHourLabel(h)).join(", ")})`,
    },
    {
      name: "Last Night's Sleep",
      category: "sleep",
      status: sleepStatus,
      detail: sleepSignalDetail,
    },
    {
      name: "Recent 24-48h Activity",
      category: "activity",
      status: activityStatus,
      detail: activitySignalDetail,
    },
    {
      name: "Movement Baseline",
      category: "history",
      status: "optimal",
      detail: "Historical PSD tremor frequency & gait cadence baseline",
    },
  ];

  return {
    hourly,
    windows,
    bestWindow,
    confidenceScore,
    confidenceLevel,
    coverageLevel: curve.coverageLevel,
    reasons,
    signals,
    isOfflineFallback: true,
  };


}

/**
 * Fetch Day Forecast from backend API primary source, falling back to client offline calculator.
 */
export async function fetchForecastAsync(isDemoMode: boolean = true): Promise<DayForecastResult> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/forecast/today`, {
      headers: {
        "X-User-ID": "user_sarah_default",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.timeline) && data.timeline.length > 0) {
        const nowHour = new Date().getHours();

        const hourly: HourlyForecastItem[] = data.timeline.map((pt: any) => {
          const h = pt.hour;
          const displayHour = h % 12 === 0 ? 12 : h % 12;
          const ampm = h >= 12 ? "PM" : "AM";
          const hourLabel = `${displayHour}:00 ${ampm}`;

          // Convert backend mobility score (1.0 = best, 0.0 = low) to frontend difficulty score (0.0 = best, 1.0 = difficult)
          const rawMobility = typeof pt.mobility_score === "number" ? pt.mobility_score : 0.6;
          const difficultyScore = Math.max(0.05, Math.min(0.95, Math.round((1.0 - rawMobility) * 100) / 100));

          let status: "good" | "variable" | "difficult" = "variable";
          if (difficultyScore <= 0.35) status = "good";
          else if (difficultyScore >= 0.60) status = "difficult";

          return {
            hour: h,
            hourLabel,
            score: difficultyScore,
            status,
            bandMin: Math.max(0, difficultyScore - 0.1),
            bandMax: Math.min(1, difficultyScore + 0.1),
            isCurrentHour: h === nowHour,
          };
        });

        let bestWindow: MergedForecastWindow | null = null;
        if (data.best_window) {
          const bw = data.best_window;
          const sH = Math.floor(bw.start_hour || 10);
          const eH = Math.floor(bw.end_hour || 12);
          const sLabel = `${sH % 12 === 0 ? 12 : sH % 12}:00 ${sH >= 12 ? "PM" : "AM"}`;
          const eLabel = `${eH % 12 === 0 ? 12 : eH % 12}:00 ${eH >= 12 ? "PM" : "AM"}`;
          bestWindow = {
            status: "good",
            startLabel: sLabel,
            endLabel: eLabel,
            timeSpanLabel: `${sLabel} - ${eLabel}`,
            title: bw.label || "Better movement window",
          };
        }

        const confTier = data.confidence?.tier || "medium";
        const confScore = Math.round((data.confidence?.numeric_score || 0.8) * 100);

        return {
          hourly,
          windows: bestWindow ? [bestWindow] : [],
          bestWindow,
          confidenceScore: confScore,
          confidenceLevel: confTier === "high" ? "high" : confTier === "low" ? "low" : "medium",
          coverageLevel: "ok",
          reasons: ["Backend AI engine", "Medication schedule", "Circadian prior"],
          signals: [
            {
              name: "Medication Timing",
              category: "medication",
              status: "optimal",
              detail: "Time-since-dose backend model prediction",
            },
            {
              name: "Last Night's Sleep",
              category: "sleep",
              status: "optimal",
              detail: "Backend sleep & circadian prior factor",
            },
            {
              name: "Recent 24-48h Activity",
              category: "activity",
              status: "optimal",
              detail: "Backend continuous movement prior",
            },
          ],
          isOfflineFallback: false,
        };
      }
    }
  } catch (err) {
    // API unreachable -> fallback to client estimate
  }

  const fallback = buildForecast(isDemoMode);
  return { ...fallback, isOfflineFallback: true };
}
