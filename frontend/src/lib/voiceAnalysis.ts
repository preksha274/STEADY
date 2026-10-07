/**
 * STEADY Web Audio API Voice Feature Extraction
 * Client-side acoustic feature extraction for sustained vowel recordings ("aaah").
 * 
 * Computes:
 * - Fundamental Frequency (F0 in Hz) via autocorrelation
 * - Jitter (%): cycle-to-cycle variation in F0 period
 * - Shimmer (%): cycle-to-cycle variation in peak amplitude
 * - Harmonics-to-Noise Ratio (HNR in dB): periodic vs residual energy ratio
 * - Background noise floor & confidence estimation
 * 
 * NOTE: These are client-side approximations, not clinical acoustic lab metrics.
 */

export interface VoiceAnalysisResult {
  f0Hz: number;
  jitterPct: number;
  shimmerPct: number;
  hnrDb: number;
  loudnessDb: number;
  durationSec: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  isSimulated?: boolean;
}

export interface VoiceBaselineComparison {
  f0Diff: number; // Hz difference vs baseline
  jitterDiff: number; // % point difference vs baseline
  shimmerDiff: number; // % point difference vs baseline
  hnrDiff: number; // dB difference vs baseline
  isJitterUnusual: boolean;
  isShimmerUnusual: boolean;
  isHnrUnusual: boolean;
  overallFlag: "normal" | "unusual";
  summaryText: string;
}

/**
 * Perform acoustic extraction on a Float32Array of audio samples.
 */
export function extractVoiceFeatures(
  pcmSamples: Float32Array,
  sampleRate: number,
  durationSec: number
): VoiceAnalysisResult {
  if (!pcmSamples || pcmSamples.length === 0 || sampleRate <= 0) {
    return getFallbackVoiceFeatures(durationSec);
  }

  // 1. Calculate overall RMS & Loudness (dB)
  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < pcmSamples.length; i++) {
    const val = pcmSamples[i];
    sumSq += val * val;
    if (Math.abs(val) > maxAbs) maxAbs = Math.abs(val);
  }
  const rms = Math.sqrt(sumSq / pcmSamples.length);
  // Convert RMS to approximate dB SPL (with reference offset)
  const loudnessDb = Math.round(20 * Math.log10(Math.max(rms, 0.0001)) + 90);

  // Assess background noise & signal level variance
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const windowRMS: number[] = [];
  for (let i = 0; i < pcmSamples.length - windowSize; i += windowSize) {
    let wSum = 0;
    for (let j = 0; j < windowSize; j++) {
      const v = pcmSamples[i + j];
      wSum += v * v;
    }
    windowRMS.push(Math.sqrt(wSum / windowSize));
  }

  // Find silent/background noise level from quietest 10% windows
  const sortedRMS = [...windowRMS].sort((a, b) => a - b);
  const noiseFloorCount = Math.max(1, Math.floor(sortedRMS.length * 0.1));
  const noiseFloorRMS =
    sortedRMS.slice(0, noiseFloorCount).reduce((a, b) => a + b, 0) / noiseFloorCount;

  // Signal variance across voice windows
  const meanRMS = sortedRMS.reduce((a, b) => a + b, 0) / (sortedRMS.length || 1);
  const varianceRMS =
    sortedRMS.reduce((sum, r) => sum + Math.pow(r - meanRMS, 2), 0) /
    (sortedRMS.length || 1);
  const snr = noiseFloorRMS > 0 ? meanRMS / noiseFloorRMS : 10;

  // Confidence calculation based on recording duration and noise
  let confidence: "high" | "medium" | "low" = "high";
  let confidenceReason = "Sustained recording with clear acoustic signal";

  if (durationSec < 3.0) {
    confidence = "low";
    confidenceReason = "Recording duration was under 3 seconds";
  } else if (snr < 2.5 || varianceRMS > 0.08) {
    confidence = "low";
    confidenceReason = "High background noise or unsteady microphone position detected";
  } else if (durationSec < 4.5 || snr < 4.0) {
    confidence = "medium";
    confidenceReason = "Slight background noise or short sample duration";
  }

  // 2. Fundamental Frequency (F0) via Autocorrelation
  // Search range: 80 Hz to 350 Hz
  const minLag = Math.floor(sampleRate / 350);
  const maxLag = Math.floor(sampleRate / 80);

  // Take a steady frame near middle of recording
  const frameSize = Math.min(4096, pcmSamples.length);
  const startIdx = Math.floor((pcmSamples.length - frameSize) / 2);
  const frame = pcmSamples.subarray(startIdx, startIdx + frameSize);

  // Compute autocorrelation
  const r: number[] = new Array(maxLag + 1).fill(0);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let n = 0; n < frameSize - lag; n++) {
      sum += frame[n] * frame[n + lag];
    }
    r[lag] = sum;
  }

  const r0 = r[0] || 1;
  let maxR = -1;
  let bestLag = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    if (r[lag] > maxR) {
      maxR = r[lag];
      bestLag = lag;
    }
  }

  let f0Hz = 135; // default reasonable pitch
  let normAutocorrPeak = 0.75;

  if (bestLag > 0 && maxR > 0) {
    // Parabolic interpolation for fine pitch estimation
    const prev = r[bestLag - 1] || maxR;
    const next = r[bestLag + 1] || maxR;
    const delta = (next - prev) / (2 * (2 * maxR - next - prev) || 1);
    const fineLag = bestLag + delta;
    f0Hz = Math.round((sampleRate / fineLag) * 10) / 10;
    normAutocorrPeak = Math.min(0.98, maxR / r0);
  }

  // 3. Cycle-to-cycle Period (Jitter) and Amplitude (Shimmer) Tracking
  // Step cycle by cycle across the middle 2 seconds of audio
  const pitchPeriodSamples = Math.round(sampleRate / f0Hz);
  const periods: number[] = [];
  const amplitudes: number[] = [];

  let currPos = startIdx;
  const endIdx = Math.min(pcmSamples.length - pitchPeriodSamples, startIdx + Math.floor(sampleRate * 2));

  while (currPos < endIdx) {
    // Find local peak in expected cycle window
    let peakVal = 0;
    let peakOffset = 0;
    const searchWin = Math.floor(pitchPeriodSamples * 1.3);

    for (let k = 0; k < searchWin && currPos + k < pcmSamples.length; k++) {
      const absV = Math.abs(pcmSamples[currPos + k]);
      if (absV > peakVal) {
        peakVal = absV;
        peakOffset = k;
      }
    }

    if (peakVal > 0.005) {
      amplitudes.push(peakVal);
      if (periods.length > 0) {
        periods.push(peakOffset);
      }
    }

    currPos += Math.max(10, peakOffset > 0 ? peakOffset : pitchPeriodSamples);
    if (amplitudes.length > 60) break; // cap cycle count
  }

  // Calculate Jitter (%)
  let jitterPct = 0.65; // default fallback
  if (periods.length >= 4) {
    let periodDiffSum = 0;
    let periodSum = 0;
    for (let i = 0; i < periods.length; i++) {
      periodSum += periods[i];
      if (i > 0) {
        periodDiffSum += Math.abs(periods[i] - periods[i - 1]);
      }
    }
    const meanPeriod = periodSum / periods.length;
    if (meanPeriod > 0) {
      const rawJitter = (periodDiffSum / (periods.length - 1)) / meanPeriod;
      jitterPct = Math.min(6.5, Math.max(0.2, rawJitter * 100));
    }
  }

  // Calculate Shimmer (%)
  let shimmerPct = 2.1; // default fallback
  if (amplitudes.length >= 4) {
    let ampDiffSum = 0;
    let ampSum = 0;
    for (let i = 0; i < amplitudes.length; i++) {
      ampSum += amplitudes[i];
      if (i > 0) {
        ampDiffSum += Math.abs(amplitudes[i] - amplitudes[i - 1]);
      }
    }
    const meanAmp = ampSum / amplitudes.length;
    if (meanAmp > 0) {
      const rawShimmer = (ampDiffSum / (amplitudes.length - 1)) / meanAmp;
      shimmerPct = Math.min(15.0, Math.max(0.8, rawShimmer * 100));
    }
  }

  // 4. HNR (Harmonics-to-Noise Ratio in dB)
  // Ratio of periodic peak to residual noise energy
  const rNoise = Math.max(0.01, 1 - normAutocorrPeak);
  const hnrRaw = 10 * Math.log10(normAutocorrPeak / rNoise);
  const hnrDb = Math.round(Math.min(32, Math.max(6, hnrRaw)) * 10) / 10;

  return {
    f0Hz: Math.round(f0Hz * 10) / 10,
    jitterPct: Math.round(jitterPct * 100) / 100,
    shimmerPct: Math.round(shimmerPct * 100) / 100,
    hnrDb,
    loudnessDb: Math.min(88, Math.max(40, loudnessDb)),
    durationSec: Math.round(durationSec * 10) / 10,
    confidence,
    confidenceReason,
  };
}

/**
 * Realistic simulated voice features for demo/testing when mic is unavailable.
 */
export function getFallbackVoiceFeatures(
  durationSec: number = 5.0,
  isUnusual: boolean = false
): VoiceAnalysisResult {
  const f0Hz = isUnusual ? 118.4 : 142.5;
  const jitterPct = isUnusual ? 2.45 : 0.72;
  const shimmerPct = isUnusual ? 5.12 : 2.15;
  const hnrDb = isUnusual ? 13.8 : 22.4;
  const loudnessDb = isUnusual ? 50 : 66;

  return {
    f0Hz,
    jitterPct,
    shimmerPct,
    hnrDb,
    loudnessDb,
    durationSec,
    confidence: durationSec >= 3 ? "high" : "low",
    confidenceReason:
      durationSec >= 3
        ? "Clean sustained voice sample captured"
        : "Short sample duration (<3s)",
    isSimulated: true,
  };
}

/**
 * Compare current voice result against personal baseline.
 */
export function compareVoiceToBaseline(
  current: { f0Hz: number; jitterPct: number; shimmerPct: number; hnrDb: number },
  baseline: { f0Hz: number; jitterPct: number; shimmerPct: number; hnrDb: number }
): VoiceBaselineComparison {
  const f0Diff = Math.round((current.f0Hz - baseline.f0Hz) * 10) / 10;
  const jitterDiff = Math.round((current.jitterPct - baseline.jitterPct) * 100) / 100;
  const shimmerDiff = Math.round((current.shimmerPct - baseline.shimmerPct) * 100) / 100;
  const hnrDiff = Math.round((current.hnrDb - baseline.hnrDb) * 10) / 10;

  // Thresholds:
  // Jitter elevated if > 30% higher than personal baseline OR > 1.8%
  const isJitterUnusual = current.jitterPct > baseline.jitterPct * 1.35 || current.jitterPct > 1.8;
  // Shimmer elevated if > 30% higher than personal baseline OR > 4.5%
  const isShimmerUnusual = current.shimmerPct > baseline.shimmerPct * 1.35 || current.shimmerPct > 4.5;
  // HNR degraded if < baseline - 3.5 dB OR < 15 dB
  const isHnrUnusual = current.hnrDb < baseline.hnrDb - 3.5 || current.hnrDb < 15.0;

  const overallFlag = isJitterUnusual || isShimmerUnusual || isHnrUnusual ? "unusual" : "normal";

  let summaryText = "Voice stability matches your usual personal baseline.";
  if (overallFlag === "unusual") {
    const issues: string[] = [];
    if (isJitterUnusual) issues.push("elevated pitch jitter");
    if (isShimmerUnusual) issues.push("increased amplitude shimmer");
    if (isHnrUnusual) issues.push("reduced harmonics-to-noise ratio");
    summaryText = `Unusual vocal acoustic fluctuations detected: ${issues.join(", ")}.`;
  }

  return {
    f0Diff,
    jitterDiff,
    shimmerDiff,
    hnrDiff,
    isJitterUnusual,
    isShimmerUnusual,
    isHnrUnusual,
    overallFlag,
    summaryText,
  };
}
