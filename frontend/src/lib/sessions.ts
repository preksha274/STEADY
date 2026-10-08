export interface SessionTremor {
  frequencyHz: number;
  amplitude: number;
  intensity: "mild" | "moderate" | "high";
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}

export interface SessionGait {
  cadence: number;
  symmetry: number;
  confidence: "high" | "medium" | "low";
}

export interface SessionEEG {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  confidence: "high" | "medium" | "low";
}

export interface SessionBradykinesia {
  hand: "right" | "left" | "both";
  tapCount: number;
  tapRateHz: number;
  amplitudePx?: number;
  decrementPct: number;
  updrsScore: 0 | 1 | 2 | 3 | 4;
  updrsLabel: "Normal" | "Slight" | "Mild" | "Moderate" | "Severe";
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}

export interface SessionVoice {
  f0Hz: number;
  jitterPct: number;
  shimmerPct: number;
  hnrDb: number;
  loudnessDb: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}

export interface SessionStats {
  wearTimeMinutes: number;   // Monitored wear time in minutes
  alertsRaised: number;      // Total tremor/freeze alerts raised
  alertsCancelled: number;   // Alerts manually cancelled by user
  cueDisableEvents: number;  // Cue-disable / pause events
}

export interface Session {
  id: string;
  timestamp: string; // ISO string
  tremor: SessionTremor;
  gait?: SessionGait;
  eeg?: SessionEEG;
  bradykinesia?: SessionBradykinesia;
  voice?: SessionVoice;
  stats?: SessionStats;
  source: "upload" | "demo" | "seed" | "live" | "band";
}

export interface Baseline {
  tremorAmplitudeMean: number;
  tremorFrequencyMean: number;
  gaitCadenceMean: number | null;
  eegBetaMean: number | null;
  voiceF0Mean: number | null;
  voiceJitterMean: number | null;
  voiceShimmerMean: number | null;
  voiceHnrMean: number | null;
  sampleCount: number;
}

export interface MetricChange {
  currentValue: number;
  baselineValue: number;
  pctChange: number;
  direction: "better" | "similar" | "worse";
}

export interface BaselineComparison {
  tremorAmplitude: MetricChange;
  tremorFrequency: MetricChange;
  gaitCadence: MetricChange | null;
  eegBeta: MetricChange | null;
  voiceJitter: MetricChange | null;
  voiceShimmer: MetricChange | null;
  voiceHnr: MetricChange | null;
}

const STORAGE_KEY = "movepilot_sessions";

export const getSessions = (includeDemo?: boolean): Session[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let sessions: Session[] = JSON.parse(raw);

    // Determine effective includeDemo preference if not explicitly provided
    let shouldIncludeDemo = includeDemo;
    if (shouldIncludeDemo === undefined) {
      const storedSetting = localStorage.getItem("movepilot_demo_mode");
      shouldIncludeDemo = storedSetting !== null ? JSON.parse(storedSetting) : true;
    }

    if (!shouldIncludeDemo) {
      sessions = sessions.filter((s) => s.source === "upload");
    }

    // Sort chronologically ascending
    return sessions.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (e) {
    console.error("Failed to read sessions from localStorage", e);
    return [];
  }
};

export const addSession = (sessionData: Omit<Session, "id"> | Session): Session => {
  const existing = getSessions(true); // Always append to full array in storage
  const id = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const newSession: Session = {
    ...sessionData,
    id: "id" in sessionData && sessionData.id ? sessionData.id : id,
  };

  const updated = [...existing, newSession].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save session to localStorage", e);
  }

  return newSession;
};

export const clearSessions = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const getBaseline = (
  currentSessionOrTimestamp?: Session | string,
  includeDemo?: boolean
): Baseline | null => {
  const sessions = getSessions(includeDemo);
  if (sessions.length === 0) return null;

  let targetTime: number = Date.now();
  if (currentSessionOrTimestamp) {
    targetTime =
      typeof currentSessionOrTimestamp === "string"
        ? new Date(currentSessionOrTimestamp).getTime()
        : new Date(currentSessionOrTimestamp.timestamp).getTime();
  }

  // Find up to 10 prior sessions BEFORE targetTime
  const priorSessions = sessions
    .filter((s) => new Date(s.timestamp).getTime() < targetTime)
    .slice(-10); // Take last 10 prior sessions

  if (priorSessions.length < 3) {
    return null; // Return null if fewer than 3 prior sessions exist
  }

  const tremorAmps = priorSessions.map((s) => s.tremor.amplitude);
  const tremorFreqs = priorSessions.map((s) => s.tremor.frequencyHz);

  const gaitSessions = priorSessions.filter((s) => s.gait && typeof s.gait.cadence === "number");
  const eegSessions = priorSessions.filter((s) => s.eeg && typeof s.eeg.beta === "number");
  const voiceSessions = priorSessions.filter((s) => s.voice && typeof s.voice.jitterPct === "number");

  const tremorAmplitudeMean =
    tremorAmps.reduce((a, b) => a + b, 0) / tremorAmps.length;
  const tremorFrequencyMean =
    tremorFreqs.reduce((a, b) => a + b, 0) / tremorFreqs.length;

  const gaitCadenceMean =
    gaitSessions.length > 0
      ? gaitSessions.reduce((sum, s) => sum + s.gait!.cadence, 0) / gaitSessions.length
      : null;

  const eegBetaMean =
    eegSessions.length > 0
      ? eegSessions.reduce((sum, s) => sum + s.eeg!.beta, 0) / eegSessions.length
      : null;

  const voiceF0Mean =
    voiceSessions.length > 0
      ? voiceSessions.reduce((sum, s) => sum + s.voice!.f0Hz, 0) / voiceSessions.length
      : null;

  const voiceJitterMean =
    voiceSessions.length > 0
      ? voiceSessions.reduce((sum, s) => sum + s.voice!.jitterPct, 0) / voiceSessions.length
      : null;

  const voiceShimmerMean =
    voiceSessions.length > 0
      ? voiceSessions.reduce((sum, s) => sum + s.voice!.shimmerPct, 0) / voiceSessions.length
      : null;

  const voiceHnrMean =
    voiceSessions.length > 0
      ? voiceSessions.reduce((sum, s) => sum + s.voice!.hnrDb, 0) / voiceSessions.length
      : null;

  return {
    tremorAmplitudeMean: round(tremorAmplitudeMean, 4),
    tremorFrequencyMean: round(tremorFrequencyMean, 2),
    gaitCadenceMean: gaitCadenceMean !== null ? round(gaitCadenceMean, 1) : null,
    eegBetaMean: eegBetaMean !== null ? round(eegBetaMean, 4) : null,
    voiceF0Mean: voiceF0Mean !== null ? round(voiceF0Mean, 1) : null,
    voiceJitterMean: voiceJitterMean !== null ? round(voiceJitterMean, 2) : null,
    voiceShimmerMean: voiceShimmerMean !== null ? round(voiceShimmerMean, 2) : null,
    voiceHnrMean: voiceHnrMean !== null ? round(voiceHnrMean, 1) : null,
    sampleCount: priorSessions.length,
  };
};

export const getChangeFromBaseline = (
  session: Session,
  includeDemo?: boolean
): BaselineComparison | null => {
  const baseline = getBaseline(session, includeDemo);
  if (!baseline) return null;

  // Helper to compute change & direction
  const calcChange = (
    current: number,
    base: number,
    lowerIsBetter: boolean
  ): MetricChange => {
    const pctChange = ((current - base) / base) * 100;
    let direction: "better" | "similar" | "worse" = "similar";

    if (Math.abs(pctChange) > 5.0) {
      if (lowerIsBetter) {
        direction = pctChange < -5.0 ? "better" : "worse";
      } else {
        direction = pctChange > 5.0 ? "better" : "worse";
      }
    }

    return {
      currentValue: round(current, 4),
      baselineValue: round(base, 4),
      pctChange: round(pctChange, 2),
      direction,
    };
  };

  const tremorAmplitude = calcChange(
    session.tremor.amplitude,
    baseline.tremorAmplitudeMean,
    true // lower tremor amplitude is better
  );

  const tremorFrequency = calcChange(
    session.tremor.frequencyHz,
    baseline.tremorFrequencyMean,
    true // slightly lower frequency is generally better/stable
  );

  const gaitCadence =
    session.gait && baseline.gaitCadenceMean !== null
      ? calcChange(
          session.gait.cadence,
          baseline.gaitCadenceMean,
          false // higher cadence is better
        )
      : null;

  const eegBeta =
    session.eeg && baseline.eegBetaMean !== null
      ? calcChange(
          session.eeg.beta,
          baseline.eegBetaMean,
          true // lower beta hyper-synchrony is better
        )
      : null;

  const voiceJitter =
    session.voice && baseline.voiceJitterMean !== null
      ? calcChange(
          session.voice.jitterPct,
          baseline.voiceJitterMean,
          true // lower jitter is better
        )
      : null;

  const voiceShimmer =
    session.voice && baseline.voiceShimmerMean !== null
      ? calcChange(
          session.voice.shimmerPct,
          baseline.voiceShimmerMean,
          true // lower shimmer is better
        )
      : null;

  const voiceHnr =
    session.voice && baseline.voiceHnrMean !== null
      ? calcChange(
          session.voice.hnrDb,
          baseline.voiceHnrMean,
          false // higher HNR is better
        )
      : null;

  return {
    tremorAmplitude,
    tremorFrequency,
    gaitCadence,
    eegBeta,
    voiceJitter,
    voiceShimmer,
    voiceHnr,
  };
};

export const seedDemoSessions = (forceReset = false): Session[] => {
  if (typeof window === "undefined") return [];

  const existing = getSessions();
  if (existing.length > 0 && !forceReset) {
    return existing;
  }

  clearSessions();

  const now = new Date();
  const seededSessions: Session[] = [];

  // Generate 18 sessions over the last 18 days
  for (let i = 17; i >= 0; i--) {
    const sessionDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Alternate morning (9:30 AM) and afternoon (2:15 PM)
    const isMorning = i % 2 === 0;
    sessionDate.setHours(isMorning ? 9 : 14, isMorning ? 30 : 15, 0, 0);

    // Improving tremor trend over 18 days (amplitude drops from 0.42 to 0.18 m/s^2)
    const progressFactor = (17 - i) / 17; // 0 to 1
    const baseAmp = 0.42 - progressFactor * 0.22;
    const noise = (Math.random() - 0.5) * 0.06;
    const amplitude = Math.max(0.08, Math.round((baseAmp + noise) * 1000) / 1000);

    const freqHz = Math.round((4.6 + (Math.random() - 0.5) * 0.4) * 10) / 10;
    const intensity: "mild" | "moderate" | "high" =
      amplitude < 0.15 ? "mild" : amplitude < 0.3 ? "moderate" : "high";

    // Low confidence sessions on day 4 and day 11
    const isLowConfidence = i === 13 || i === 6;
    const confidence: "high" | "medium" | "low" = isLowConfidence ? "low" : "high";
    const confidenceReason = isLowConfidence
      ? "Short recording (<10s) with minor movement noise"
      : "Sufficient recording length with steady baseline";

    // Cadence improving from 98 to 112 steps/min
    const cadence = Math.round(98 + progressFactor * 14 + (Math.random() - 0.5) * 4);
    const symmetry = Math.min(98, Math.round(88 + progressFactor * 8 + Math.random() * 3));

    // EEG Beta relative power around 0.18 - 0.25
    const beta = Math.round((0.26 - progressFactor * 0.07 + (Math.random() - 0.5) * 0.02) * 1000) / 1000;
    const alpha = Math.round((0.65 + (Math.random() - 0.5) * 0.05) * 1000) / 1000;
    const theta = Math.round((0.08 + (Math.random() - 0.5) * 0.02) * 1000) / 1000;
    const delta = Math.round((0.05 + (Math.random() - 0.5) * 0.01) * 1000) / 1000;

    // Bradykinesia Finger-Tap (MDS-UPDRS Item 3.4/3.6)
    // Tap rate improves from ~2.1 Hz to ~3.2 Hz; Decrement drops from ~29% to ~12%
    const baseTapRate = 2.1 + progressFactor * 1.1 + (Math.random() - 0.5) * 0.3;
    const tapRateHz = Math.round(Math.max(1.4, baseTapRate) * 10) / 10;
    const rawCount = Math.round(tapRateHz * 10);
    const tapCount = isLowConfidence ? Math.min(12, rawCount) : rawCount;
    const decrementPct = Math.round(Math.max(8, 29 - progressFactor * 16 + (Math.random() - 0.5) * 4));
    
    let updrsScore: 0 | 1 | 2 | 3 | 4 = 1;
    let updrsLabel: "Normal" | "Slight" | "Mild" | "Moderate" | "Severe" = "Slight";

    if (tapRateHz >= 3.5 && decrementPct <= 10) {
      updrsScore = 0;
      updrsLabel = "Normal";
    } else if (tapRateHz >= 2.8 && decrementPct <= 20) {
      updrsScore = 1;
      updrsLabel = "Slight";
    } else if (tapRateHz >= 2.0 && decrementPct <= 35) {
      updrsScore = 2;
      updrsLabel = "Mild";
    } else if (tapRateHz >= 1.2 && decrementPct <= 50) {
      updrsScore = 3;
      updrsLabel = "Moderate";
    } else {
      updrsScore = 4;
      updrsLabel = "Severe";
    }

    // Voice Check (Sustained vowel "aaah")
    const isUnusualVoice = i === 15 || i === 7 || i === 4;
    const voiceJitterPct = isUnusualVoice
      ? Math.round((2.45 + (17 - i) * 0.02 + (Math.random() - 0.5) * 0.3) * 100) / 100
      : Math.round((0.68 + (Math.random() - 0.5) * 0.12) * 100) / 100;
    const voiceShimmerPct = isUnusualVoice
      ? Math.round((5.12 + (17 - i) * 0.04 + (Math.random() - 0.5) * 0.4) * 100) / 100
      : Math.round((2.15 + (Math.random() - 0.5) * 0.25) * 100) / 100;
    const voiceHnrDb = isUnusualVoice
      ? Math.round((13.8 + (Math.random() - 0.5) * 1.2) * 10) / 10
      : Math.round((22.4 + progressFactor * 2.2 + (Math.random() - 0.5) * 1.5) * 10) / 10;
    const voiceLoudnessDb = isUnusualVoice ? (i === 15 ? 48 : i === 7 ? 50 : 52) : 66;

    const session: Session = {
      id: `seed_session_${18 - i}`,
      timestamp: sessionDate.toISOString(),
      tremor: {
        frequencyHz: freqHz,
        amplitude,
        intensity,
        confidence,
        confidenceReason,
      },
      gait: {
        cadence,
        symmetry,
        confidence: isLowConfidence ? "medium" : "high",
      },
      eeg: {
        delta,
        theta,
        alpha,
        beta,
        confidence: isLowConfidence ? "medium" : "high",
      },
      bradykinesia: {
        hand: i % 2 === 0 ? "right" : "left",
        tapCount,
        tapRateHz,
        amplitudePx: 320 + Math.round(progressFactor * 60),
        decrementPct,
        updrsScore,
        updrsLabel,
        confidence: tapCount >= 15 && !isLowConfidence ? "high" : "low",
        confidenceReason: tapCount < 15
          ? `Fewer than 15 taps recorded (${tapCount} taps)`
          : "Sufficient tap volume recorded over 10s window",
      },
      voice: {
        f0Hz: Math.round((138 + (Math.random() - 0.5) * 8) * 10) / 10,
        jitterPct: voiceJitterPct,
        shimmerPct: voiceShimmerPct,
        hnrDb: voiceHnrDb,
        loudnessDb: voiceLoudnessDb,
        confidence: isLowConfidence ? "low" : "high",
        confidenceReason: isLowConfidence
          ? "Short sample duration or background noise"
          : "Clean sustained vowel sample captured",
      },
      stats: {
        wearTimeMinutes: Math.round(45 + Math.random() * 30),
        alertsRaised: intensity === "high" ? 3 : intensity === "moderate" ? 2 : 1,
        alertsCancelled: intensity === "high" ? 1 : 0,
        cueDisableEvents: isUnusualVoice ? 1 : 0,
      },
      source: "seed",
    };

    seededSessions.push(session);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededSessions));
  } catch (e) {
    console.error("Failed to save seeded sessions to localStorage", e);
  }

  return seededSessions;
};

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
