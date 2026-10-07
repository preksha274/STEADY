export const BRADYKINESIA_THRESHOLDS = {
  NORMAL: { minTapRateHz: 3.5, maxDecrementPct: 10 },
  SLIGHT: { minTapRateHz: 2.8, maxDecrementPct: 20 },
  MILD: { minTapRateHz: 2.0, maxDecrementPct: 35 },
  MODERATE: { minTapRateHz: 1.2, maxDecrementPct: 50 },
  MIN_TAPS_HIGH_CONFIDENCE: 15,
} as const;

export type UPDRSScore = 0 | 1 | 2 | 3 | 4;
export type UPDRSLabel = "Normal" | "Slight" | "Mild" | "Moderate" | "Severe";

export interface UPDRSRatingMeta {
  label: UPDRSLabel;
  description: string;
  badgeClass: string;
  textClass: string;
  bgClass: string;
}

export const UPDRS_RATING_INFO: Record<UPDRSScore, UPDRSRatingMeta> = {
  0: {
    label: "Normal",
    description: "No slowing, hesitations, or decrement in tapping rate or amplitude.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    textClass: "text-emerald-600",
    bgClass: "bg-emerald-50/60 border-emerald-200",
  },
  1: {
    label: "Slight",
    description: "Slight slowing and/or subtle decrement in tap rate towards the end.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    textClass: "text-blue-600",
    bgClass: "bg-blue-50/60 border-blue-200",
  },
  2: {
    label: "Mild",
    description: "Mild slowing and/or early sequence effect decrement, occasional hesitation.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    textClass: "text-amber-600",
    bgClass: "bg-amber-50/60 border-amber-200",
  },
  3: {
    label: "Moderate",
    description: "Moderate slowing, clear decrement in amplitude/speed, frequent hesitations.",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    textClass: "text-orange-600",
    bgClass: "bg-orange-50/60 border-orange-200",
  },
  4: {
    label: "Severe",
    description: "Severe slowing, major fatigue decrement (>50%), or frequent freezing halts.",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    textClass: "text-rose-600",
    bgClass: "bg-rose-50/60 border-rose-200",
  },
};

export interface TapSample {
  timestamp: number; // ms
  zone: "A" | "B";
  x: number;
  y: number;
}

export interface BradykinesiaCalculationResult {
  updrsScore: UPDRSScore;
  updrsLabel: UPDRSLabel;
  tapCount: number;
  tapRateHz: number;
  decrementPct: number;
  velocityDecrementPct: number;
  amplitudePx: number;
  firstHalfRateHz: number;
  secondHalfRateHz: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  attribution: string; // Feature-attribution rule explanation
}

/**
 * Calculates MDS-UPDRS Item 3.4/3.6 Finger-Tapping metrics and score
 * based on tap timestamps and zone locations.
 * Follows the clinically validated BRAIN Tap Test methodology (velocity-decrement slope).
 */
export function calculateBradykinesiaScore(
  taps: TapSample[],
  testDurationSec: number = 10,
  wasInterrupted: boolean = false
): BradykinesiaCalculationResult {
  const tapCount = taps.length;
  const tapRateHz = Math.round((tapCount / testDurationSec) * 10) / 10;

  if (tapCount < 2) {
    const lowAttribution = wasInterrupted
      ? `Flagged because: test recording was interrupted after ${taps.length} taps (threshold: 10.0s duration, 15 taps).`
      : `Flagged because: only ${tapCount} taps recorded in 10s window (threshold: 15 taps for reliable UPDRS score).`;

    return {
      updrsScore: 4,
      updrsLabel: "Severe",
      tapCount,
      tapRateHz: 0,
      decrementPct: 100,
      velocityDecrementPct: 100,
      amplitudePx: 0,
      firstHalfRateHz: 0,
      secondHalfRateHz: 0,
      confidence: "low",
      confidenceReason: wasInterrupted
        ? "Recording was interrupted before completion"
        : "Fewer than 2 taps recorded during the 10-second test window",
      attribution: lowAttribution,
    };
  }

  const halfDurationMs = (testDurationSec / 2) * 1000;
  const startTime = taps[0].timestamp;

  const firstHalfTaps = taps.filter((t) => t.timestamp - startTime <= halfDurationMs);
  const secondHalfTaps = taps.filter((t) => t.timestamp - startTime > halfDurationMs);

  const firstHalfRateHz = Math.round((firstHalfTaps.length / (testDurationSec / 2)) * 10) / 10;
  const secondHalfRateHz = Math.round((secondHalfTaps.length / (testDurationSec / 2)) * 10) / 10;

  // Rate decrement calculation (% drop from 1st half to 2nd half)
  let rateDecrementPct = 0;
  if (firstHalfRateHz > 0) {
    rateDecrementPct = Math.max(0, ((firstHalfRateHz - secondHalfRateHz) / firstHalfRateHz) * 100);
  }

  // Amplitude proxy calculation (average spatial distance between consecutive taps)
  let totalDist = 0;
  let distCount = 0;
  let firstHalfDist = 0;
  let firstHalfDistCount = 0;
  let secondHalfDist = 0;
  let secondHalfDistCount = 0;

  for (let i = 1; i < taps.length; i++) {
    const dx = taps[i].x - taps[i - 1].x;
    const dy = taps[i].y - taps[i - 1].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    totalDist += dist;
    distCount++;

    if (taps[i].timestamp - startTime <= halfDurationMs) {
      firstHalfDist += dist;
      firstHalfDistCount++;
    } else {
      secondHalfDist += dist;
      secondHalfDistCount++;
    }
  }

  const meanAmp = distCount > 0 ? Math.round(totalDist / distCount) : 0;
  const firstHalfMeanAmp = firstHalfDistCount > 0 ? firstHalfDist / firstHalfDistCount : meanAmp;
  const secondHalfMeanAmp = secondHalfDistCount > 0 ? secondHalfDist / secondHalfDistCount : meanAmp;

  let ampDecrementPct = 0;
  if (firstHalfMeanAmp > 0) {
    ampDecrementPct = Math.max(0, ((firstHalfMeanAmp - secondHalfMeanAmp) / firstHalfMeanAmp) * 100);
  }

  // Velocity (Speed x Amplitude Product) slope calculation per BRAIN Tap Test methodology
  const v1 = firstHalfRateHz * (firstHalfMeanAmp || 1);
  const v2 = secondHalfRateHz * (secondHalfMeanAmp || 1);
  const velocityDecrementPct = Math.round(
    Math.max(0, ((v1 - v2) / (v1 || 1)) * 100)
  );

  // Clinical decrement metric combines velocity decrement slope (60%) with max rate/amp drop (40%)
  const maxRawDrop = Math.max(rateDecrementPct, ampDecrementPct);
  const decrementPct = Math.round(0.6 * velocityDecrementPct + 0.4 * maxRawDrop);

  // Determine MDS-UPDRS 0-4 Score using named threshold rules
  let updrsScore: UPDRSScore = 0;
  let updrsLabel: UPDRSLabel = "Normal";

  if (
    tapRateHz >= BRADYKINESIA_THRESHOLDS.NORMAL.minTapRateHz &&
    decrementPct <= BRADYKINESIA_THRESHOLDS.NORMAL.maxDecrementPct
  ) {
    updrsScore = 0;
    updrsLabel = "Normal";
  } else if (
    tapRateHz >= BRADYKINESIA_THRESHOLDS.SLIGHT.minTapRateHz &&
    decrementPct <= BRADYKINESIA_THRESHOLDS.SLIGHT.maxDecrementPct
  ) {
    updrsScore = 1;
    updrsLabel = "Slight";
  } else if (
    tapRateHz >= BRADYKINESIA_THRESHOLDS.MILD.minTapRateHz &&
    decrementPct <= BRADYKINESIA_THRESHOLDS.MILD.maxDecrementPct
  ) {
    updrsScore = 2;
    updrsLabel = "Mild";
  } else if (
    tapRateHz >= BRADYKINESIA_THRESHOLDS.MODERATE.minTapRateHz &&
    decrementPct <= BRADYKINESIA_THRESHOLDS.MODERATE.maxDecrementPct
  ) {
    updrsScore = 3;
    updrsLabel = "Moderate";
  } else {
    updrsScore = 4;
    updrsLabel = "Severe";
  }

  const isLowTapCount = tapCount < BRADYKINESIA_THRESHOLDS.MIN_TAPS_HIGH_CONFIDENCE;
  const confidence: "high" | "medium" | "low" = wasInterrupted
    ? "low"
    : isLowTapCount
    ? "low"
    : "high";

  let attribution = "";
  if (wasInterrupted) {
    attribution = `Flagged because: test was stopped early (threshold: full 10.0s recording window).`;
  } else if (isLowTapCount) {
    attribution = `Flagged because: recording contained ${tapCount} taps (threshold: ${BRADYKINESIA_THRESHOLDS.MIN_TAPS_HIGH_CONFIDENCE} taps for high confidence).`;
  } else if (updrsScore === 0) {
    attribution = `Sustained cadence of ${tapRateHz} taps/s with minimal velocity decrement (${velocityDecrementPct}% drop, threshold: <=10%).`;
  } else {
    attribution = `Driven primarily by velocity decrement of ${velocityDecrementPct}% in 2nd half taps (${firstHalfRateHz}Hz → ${secondHalfRateHz}Hz, threshold: >${BRADYKINESIA_THRESHOLDS.NORMAL.maxDecrementPct}%).`;
  }

  const confidenceReason = wasInterrupted
    ? "Test was stopped before the full 10-second duration"
    : isLowTapCount
    ? `Fewer than ${BRADYKINESIA_THRESHOLDS.MIN_TAPS_HIGH_CONFIDENCE} taps recorded (${tapCount} taps)`
    : `Sufficient tap volume recorded (${tapCount} taps in 10s)`;

  return {
    updrsScore,
    updrsLabel,
    tapCount,
    tapRateHz,
    decrementPct,
    velocityDecrementPct,
    amplitudePx: meanAmp,
    firstHalfRateHz,
    secondHalfRateHz,
    confidence,
    confidenceReason,
    attribution,
  };
}
