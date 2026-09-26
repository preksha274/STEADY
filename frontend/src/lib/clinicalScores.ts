/**
 * STEADY Clinical Scores Client Library
 * Handles manual entry and storage of clinician/doctor-assessed MDS-UPDRS scores.
 * Purely optional record-keeping. The app NEVER administers or interprets this scale,
 * and the AI layer never reads or factors this into predictions.
 */

export interface ClinicalScore {
  id: string;
  patient_id: string;
  author_user_id: string;
  author_role: "patient" | "family" | "clinician";
  scale: "MDS-UPDRS";
  part: "I" | "II" | "III" | "IV";
  score: number;
  max_score: number;
  clinician_name?: string;
  date_recorded: string;
  notes?: string;
  created_at: string;
}

export const MDS_UPDRS_PARTS = [
  {
    part: "I",
    title: "Part I: Non-Motor Daily Living",
    max_score: 52,
    desc: "Assessed by clinician (Mentation, behavior, mood, sleep)",
  },
  {
    part: "II",
    title: "Part II: Motor Daily Living",
    max_score: 52,
    desc: "Assessed by clinician (Speech, eating, dressing, hygiene, walking)",
  },
  {
    part: "III",
    title: "Part III: Motor Examination",
    max_score: 132,
    desc: "Assessed in-clinic by neurologist (Tremor, rigidity, bradykinesia, gait)",
  },
  {
    part: "IV",
    title: "Part IV: Motor Complications",
    max_score: 24,
    desc: "Assessed by clinician (Dyskinesias, motor fluctuations)",
  },
] as const;

const STORAGE_KEY = "steady_clinical_scores";

// Seeded sample for demo patient (Sarah Miller)
const SEEDED_SCORES: ClinicalScore[] = [
  {
    id: "cs_demo_01",
    patient_id: "default_user",
    author_user_id: "default_user",
    author_role: "patient",
    scale: "MDS-UPDRS",
    part: "III",
    score: 28,
    max_score: 132,
    clinician_name: "Dr. Aris Thorne (Movement Disorder Specialist)",
    date_recorded: "2026-09-02",
    notes: "Clinic follow-up. Mild right-hand rest tremor noted. Gait velocity steady on Levodopa.",
    created_at: "2026-09-02T10:30:00Z",
  },
  {
    id: "cs_demo_02",
    patient_id: "default_user",
    author_user_id: "default_user",
    author_role: "patient",
    scale: "MDS-UPDRS",
    part: "II",
    score: 14,
    max_score: 52,
    clinician_name: "Dr. Aris Thorne",
    date_recorded: "2026-09-02",
    notes: "Reported slight difficulty with buttons in late afternoon.",
    created_at: "2026-09-02T10:35:00Z",
  },
  {
    id: "cs_demo_03",
    patient_id: "default_user",
    author_user_id: "default_user",
    author_role: "patient",
    scale: "MDS-UPDRS",
    part: "III",
    score: 32,
    max_score: 132,
    clinician_name: "Dr. Aris Thorne",
    date_recorded: "2026-06-15",
    notes: "Prior quarterly evaluation. Baseline motor exam.",
    created_at: "2026-06-15T11:00:00Z",
  },
];

export function getClinicalScores(patientId: string = "default_user"): ClinicalScore[] {
  if (typeof window === "undefined") return SEEDED_SCORES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEEDED_SCORES));
      return SEEDED_SCORES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEEDED_SCORES;
  } catch (e) {
    console.error("Failed to load clinical scores from storage:", e);
    return SEEDED_SCORES;
  }
}

export async function fetchClinicalScores(patientId: string = "default_user"): Promise<ClinicalScore[]> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/clinical-scores?patient_id=${encodeURIComponent(patientId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch (e) {
    console.warn("Backend GET /api/v1/clinical-scores failed, falling back to local storage:", e);
  }

  return getClinicalScores(patientId);
}

export async function addClinicalScore(
  scoreData: Omit<ClinicalScore, "id" | "created_at">
): Promise<ClinicalScore> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/clinical-scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scoreData),
    });

    if (res.ok) {
      const createdScore: ClinicalScore = await res.json();
      if (typeof window !== "undefined") {
        try {
          const existing = getClinicalScores(scoreData.patient_id);
          const updated = [createdScore, ...existing.filter((s) => s.id !== createdScore.id)];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to sync to localStorage:", e);
        }
      }
      return createdScore;
    }
  } catch (e) {
    console.error("Backend POST failed, using client storage fallback:", e);
  }

  const fallbackScore: ClinicalScore = {
    ...scoreData,
    id: `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getClinicalScores(scoreData.patient_id);
      const updated = [fallbackScore, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save clinical score to localStorage:", e);
    }
  }

  return fallbackScore;
}

