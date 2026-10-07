/**
 * Plain Language Translation Layer for Patient Health Literacy
 * 
 * Health Literacy Best Practices:
 * - Most adults have limited health literacy (6th - 8th grade reading level).
 * - Patients can misinterpret raw technical data (e.g. 4.8 Hz, Freeze Index 2.7, -18% decrement, correlation r=0.6)
 *   without proper plain-language framing.
 * - Raw technical metrics MUST NOT be the primary display text on patient screens.
 * - Plain language sentence is shown FIRST and LARGEST.
 * - Technical details (Hz, m/s², %, UPDRS scores) are secondary, smaller, and collapsible ("show details").
 * - Research metrics like correlation coefficients (r=...) and clinical scales (MDS-UPDRS) belong only in 
 *   Validation Evidence and Clinical Scores research views.
 */

export interface TranslationResult {
  primary: string;         // Plain-language sentence (6th-8th grade level)
  technicalDetail: string; // Secondary, raw technical string for "Show Details" view
  status: "good" | "warning" | "danger" | "info";
}

/**
 * Tremor translation (Frequency Hz & Amplitude m/s²)
 */
export function translateTremor(
  frequencyHz?: number,
  amplitude?: number,
  changeFromBaselinePct?: number
): TranslationResult {
  const freqStr = frequencyHz ? `${frequencyHz.toFixed(1)} Hz` : "N/A";
  const ampStr = amplitude ? `${amplitude.toFixed(2)} m/s²` : "N/A";
  const tech = `Tremor Frequency: ${freqStr} • Amplitude: ${ampStr}`;

  if (changeFromBaselinePct !== undefined) {
    if (changeFromBaselinePct <= -10) {
      return {
        primary: "Your tremor is calmer than usual today",
        technicalDetail: `${tech} (${Math.abs(Math.round(changeFromBaselinePct))}% calmer than baseline)`,
        status: "good",
      };
    } else if (changeFromBaselinePct >= 15) {
      return {
        primary: "Your tremor is a bit stronger than usual today",
        technicalDetail: `${tech} (+${Math.round(changeFromBaselinePct)}% over baseline)`,
        status: "warning",
      };
    }
  }

  if (amplitude && amplitude > 0.35) {
    return {
      primary: "Your tremor is a bit stronger today",
      technicalDetail: tech,
      status: "warning",
    };
  }

  return {
    primary: "Your tremor is similar to your usual",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Freeze Index / Freezing of Gait translation
 */
export function translateFreezeIndex(
  freezeIndex?: number,
  isDetected?: boolean
): TranslationResult {
  const fiStr = freezeIndex ? freezeIndex.toFixed(2) : "N/A";
  const tech = `Freeze Index: ${fiStr} • Sensor gait ratio`;

  if (isDetected || (freezeIndex && freezeIndex >= 2.5)) {
    return {
      primary: "We noticed a change in how you were walking",
      technicalDetail: `${tech} (Above 2.5 threshold)`,
      status: "danger",
    };
  } else if (freezeIndex && freezeIndex >= 1.8) {
    return {
      primary: "We noticed slight hesitation in your steps",
      technicalDetail: tech,
      status: "warning",
    };
  }

  return {
    primary: "Your steps are moving smoothly",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Bradykinesia / Finger Tapping Decrement translation
 */
export function translateBradykinesia(
  decrementPct?: number,
  tapRateHz?: number,
  updrsScore?: number,
  updrsLabel?: string
): TranslationResult {
  const rateStr = tapRateHz ? `${tapRateHz.toFixed(1)} Hz` : "N/A";
  const decStr = decrementPct !== undefined ? `-${Math.abs(decrementPct)}%` : "N/A";
  const scoreStr = updrsScore !== undefined ? ` (Level ${updrsScore}${updrsLabel ? ` - ${updrsLabel}` : ""})` : "";
  const tech = `Finger tap speed: ${rateStr} • Fatigue slowdown: ${decStr}${scoreStr}`;

  if (decrementPct !== undefined && decrementPct >= 15) {
    return {
      primary: "Your tapping slowed down a bit partway through the test",
      technicalDetail: tech,
      status: "warning",
    };
  } else if (decrementPct !== undefined && decrementPct > 25) {
    return {
      primary: "Your hand movement slowed down noticeably during tapping",
      technicalDetail: tech,
      status: "danger",
    };
  }

  return {
    primary: "Your tapping stayed quick and steady",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Voice Acoustic Analysis translation (Jitter, Shimmer, HNR)
 */
export function translateVoice(
  jitterPct?: number,
  shimmerPct?: number,
  hnrDb?: number
): TranslationResult {
  const jitStr = jitterPct ? `${jitterPct.toFixed(1)}% Jitter` : "N/A";
  const shimStr = shimmerPct ? `${shimmerPct.toFixed(1)}% Shimmer` : "N/A";
  const hnrStr = hnrDb ? `${hnrDb.toFixed(1)} dB HNR` : "N/A";
  const tech = `Voice acoustics: ${jitStr} • ${shimStr} • ${hnrStr}`;

  if ((jitterPct && jitterPct > 2.0) || (shimmerPct && shimmerPct > 5.0) || (hnrDb && hnrDb < 14)) {
    return {
      primary: "Your voice sounds a little softer or tired today",
      technicalDetail: tech,
      status: "warning",
    };
  }

  return {
    primary: "Your voice sounds steady and clear today",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Gait Speed & Cadence translation
 */
export function translateGait(
  cadenceStepsPerMin?: number,
  symmetryPct?: number
): TranslationResult {
  const cadStr = cadenceStepsPerMin ? `${cadenceStepsPerMin} steps/min` : "N/A";
  const symStr = symmetryPct ? `${symmetryPct}% step balance` : "N/A";
  const tech = `Gait speed: ${cadStr} • Symmetry: ${symStr}`;

  if (cadenceStepsPerMin && cadenceStepsPerMin < 90) {
    return {
      primary: "Your walking pace is a bit slower than usual",
      technicalDetail: tech,
      status: "warning",
    };
  }

  return {
    primary: "Your walking pace is steady and even",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Beta Band Power / EEG translation
 */
export function translateBetaBandPower(betaPct?: number): TranslationResult {
  const pctStr = betaPct ? `${betaPct.toFixed(0)}%` : "N/A";
  const tech = `Beta band power: ${pctStr} (13–30 Hz motor initiation signal)`;

  return {
    primary: "Your movement readiness signals look steady",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Rhythm Entrainment / Cue Synchronization translation
 */
export function translateRhythmSync(
  syncPercent?: number,
  bpm?: number,
  cueType?: string
): TranslationResult {
  const syncStr = syncPercent !== undefined ? `${syncPercent}% sync` : "N/A";
  const bpmStr = bpm ? `${bpm} BPM` : "N/A";
  const typeStr = cueType ? cueType : "rhythm";
  const tech = `Metronome tempo: ${bpmStr} • ${typeStr} • Entrainment match: ${syncStr}`;

  if (syncPercent !== undefined && syncPercent >= 80) {
    return {
      primary: "You stayed right on rhythm with the beat",
      technicalDetail: tech,
      status: "good",
    };
  } else if (syncPercent !== undefined && syncPercent >= 60) {
    return {
      primary: "You followed the rhythm well during movement",
      technicalDetail: tech,
      status: "good",
    };
  }

  return {
    primary: "You are working on matching the rhythm",
    technicalDetail: tech,
    status: "warning",
  };
}

/**
 * Ambient Movement Summary translation
 */
export function translateAmbientSummary(
  label?: string,
  sampleCount?: number
): TranslationResult {
  const countStr = sampleCount ? `${sampleCount} daily samples` : "";
  const tech = `Ambient movement rating: ${label || "Normal"} • ${countStr}`;

  return {
    primary: "Your movement today is typical for your routine",
    technicalDetail: tech,
    status: "good",
  };
}

/**
 * Day Forecast Window translation
 */
export function translateForecastWindow(
  timeSpanLabel: string,
  isBestWindow: boolean = true
): TranslationResult {
  if (isBestWindow) {
    return {
      primary: "Best time for walks, exercise, or outside tasks today",
      technicalDetail: `Peak mobility interval: ${timeSpanLabel} (calculated from medication dose schedule and daily baseline)`,
      status: "good",
    };
  }
  return {
    primary: "You might feel a bit slower or more tired during this hour",
    technicalDetail: `Predicted variable mobility window: ${timeSpanLabel}`,
    status: "warning",
  };
}

/**
 * Health Literacy Sanitizer for strings shown to patients:
 * Removes raw statistical or clinical jargon if mistakenly passed to patient views.
 */
export function sanitizePatientText(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  // Strip correlation coefficient formulas like r=0.6 or p=0.001 if they ever slip in
  cleaned = cleaned.replace(/\(?r\s*=\s*-?\d+\.?\d*\)?/gi, "");
  cleaned = cleaned.replace(/\(?p\s*<=\s*\d+\.?\d*\)?/gi, "");
  cleaned = cleaned.replace(/\(?p\s*=\s*\d+\.?\d*\)?/gi, "");
  // Replace technical jargon terms with plain words if found in patient body text
  cleaned = cleaned.replace(/\bbradykinesia\b/gi, "slowness");
  cleaned = cleaned.replace(/\bamplitude\b/gi, "strength");
  cleaned = cleaned.replace(/\bdecrement\b/gi, "slowdown");
  cleaned = cleaned.replace(/\bfrequency\b/gi, "speed");

  return cleaned.trim();
}
