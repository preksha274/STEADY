"use client";

export interface PilotSessionRecord {
  id: string;
  participantId: string;
  timestamp: string; // ISO string
  algorithmTapScore: 0 | 1 | 2 | 3 | 4;
  clinicianTapScore?: 0 | 1 | 2 | 3 | 4;
  tapRateHz: number;
  decrementPct: number;
  clinicianNotes?: string;
}

export interface PilotAgreementResult {
  nPairs: number;
  cohenWeightedKappa: number;
  meanAbsoluteDifference: number;
  exactAgreementPct: number;
  withinOnePointPct: number;
}

const PILOT_STORAGE_KEY = "steady_pilot_records";

export function getPilotRecords(): PilotSessionRecord[] {
  if (typeof window === "undefined") return getDefaultPilotRecords();
  try {
    const raw = localStorage.getItem(PILOT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse pilot records", e);
  }
  return getDefaultPilotRecords();
}

export function savePilotRecord(record: PilotSessionRecord): PilotSessionRecord[] {
  const current = getPilotRecords();
  const index = current.findIndex((r) => r.id === record.id);
  let updated: PilotSessionRecord[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = record;
  } else {
    updated = [record, ...current];
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save pilot record", e);
    }
  }
  return updated;
}

export function computePilotAgreement(records: PilotSessionRecord[]): PilotAgreementResult {
  const valid = records.filter((r) => r.clinicianTapScore !== undefined && r.clinicianTapScore !== null);
  if (valid.length === 0) {
    return {
      nPairs: 0,
      cohenWeightedKappa: 0.0,
      meanAbsoluteDifference: 0.0,
      exactAgreementPct: 0.0,
      withinOnePointPct: 0.0,
    };
  }

  const n = valid.length;
  let absDiffSum = 0;
  let exactCount = 0;
  let withinOneCount = 0;

  // Cohen's Quadratic Weighted Kappa calculation
  let obsAgreement = 0;
  let expAgreement = 0;
  
  const algCounts = [0, 0, 0, 0, 0];
  const clinCounts = [0, 0, 0, 0, 0];
  
  valid.forEach((r) => {
    const a = r.algorithmTapScore;
    const c = r.clinicianTapScore!;
    const diff = Math.abs(a - c);
    
    absDiffSum += diff;
    if (diff === 0) exactCount++;
    if (diff <= 1) withinOneCount++;

    algCounts[a]++;
    clinCounts[c]++;

    const weight = 1 - Math.pow(diff / 4.0, 2); // Quadratic weighting
    obsAgreement += weight;
  });

  obsAgreement /= n;

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const weight = 1 - Math.pow(Math.abs(i - j) / 4.0, 2);
      const probI = algCounts[i] / n;
      const probJ = clinCounts[j] / n;
      expAgreement += weight * probI * probJ;
    }
  }

  const kappa = expAgreement < 1.0 ? (obsAgreement - expAgreement) / (1.0 - expAgreement) : 1.0;

  return {
    nPairs: n,
    cohenWeightedKappa: Math.max(0.0, Math.min(1.0, Math.round(kappa * 1000) / 1000)),
    meanAbsoluteDifference: Math.round((absDiffSum / n) * 100) / 100,
    exactAgreementPct: Math.round((exactCount / n) * 1000) / 10,
    withinOnePointPct: Math.round((withinOneCount / n) * 1000) / 10,
  };
}

function getDefaultPilotRecords(): PilotSessionRecord[] {
  return [
    { id: "p1", participantId: "ST-PLT-001", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), algorithmTapScore: 1, clinicianTapScore: 1, tapRateHz: 2.8, decrementPct: 18, clinicianNotes: "Matched slight rhythm decrement" },
    { id: "p2", participantId: "ST-PLT-002", timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), algorithmTapScore: 2, clinicianTapScore: 2, tapRateHz: 2.1, decrementPct: 32, clinicianNotes: "Mild fatigue halfway through task" },
    { id: "p3", participantId: "ST-PLT-003", timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), algorithmTapScore: 0, clinicianTapScore: 0, tapRateHz: 3.5, decrementPct: 8, clinicianNotes: "Smooth, fast tapping" },
    { id: "p4", participantId: "ST-PLT-004", timestamp: new Date(Date.now() - 3600000 * 30).toISOString(), algorithmTapScore: 3, clinicianTapScore: 3, tapRateHz: 1.4, decrementPct: 52, clinicianNotes: "Moderate hesitation and freezing" },
    { id: "p5", participantId: "ST-PLT-005", timestamp: new Date(Date.now() - 3600000 * 48).toISOString(), algorithmTapScore: 1, clinicianTapScore: 1, tapRateHz: 2.6, decrementPct: 22, clinicianNotes: "Good tap amplitude" },
  ];
}
