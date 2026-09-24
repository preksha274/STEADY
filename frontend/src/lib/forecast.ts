import { buildResponseCurve, ResponseCurveResult } from "./responseCurve";
import { getDiaryEntries, getDoseLogs } from "./diary";
import { getSessions } from "./sessions";

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

export interface DayForecastResult {
  hourly: HourlyForecastItem[];
  windows: MergedForecastWindow[];
  bestWindow: MergedForecastWindow | null;
  confidenceScore: number; // 0 to 100
  confidenceLevel: "high" | "medium" | "low";
  coverageLevel: "none" | "low" | "ok";
  reasons: string[];
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

  // 3. Sleep & Fatigue Modifiers from Recent Check-in
  let sleepPenalty = 0;
  let fatiguePenalty = 0;
  let sleepRecorded = false;

  const diaryEntries = getDiaryEntries(isDemoMode);
  if (diaryEntries.length > 0) {
    const latestDiary = diaryEntries[0];
    if (latestDiary.sleepHours !== undefined) {
      sleepRecorded = true;
      if (latestDiary.sleepHours < 6.0) {
        sleepPenalty = 0.15;
      }
    }
    if (latestDiary.fatigue >= 4) {
      fatiguePenalty = 0.10;
    }
  }

  // 4. Current hour determination
  const now = new Date();
  const currentHourNum = now.getHours();

  // 5. Build Hourly Items (7 AM = 7 to 9 PM = 21)
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
    const totalDiff = baseDiff + sleepPenalty + fatiguePenalty;
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

  // 6. Merge Contiguous Windows
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

  // 7. Calculate Confidence & Reasons List
  let confidenceScore = 82; // Base for ok coverage
  if (curve.coverageLevel === "none") {
    confidenceScore = 30;
  } else if (curve.coverageLevel === "low") {
    confidenceScore = 58;
  }

  const confidenceLevel: "high" | "medium" | "low" =
    confidenceScore >= 75 ? "high" : confidenceScore >= 50 ? "medium" : "low";

  const reasons: string[] = ["Medication timing"];
  if (getSessions(isDemoMode).length > 0) {
    reasons.push("Movement history");
  }
  if (diaryEntries.length > 0) {
    reasons.push("Diary check-ins");
  }
  if (sleepRecorded) {
    reasons.push("Sleep quality");
  }

  return {
    hourly,
    windows,
    bestWindow,
    confidenceScore,
    confidenceLevel,
    coverageLevel: curve.coverageLevel,
    reasons,
  };
}
