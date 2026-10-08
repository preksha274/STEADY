"use client";

import { WearableStatus, Person, Session, WearableAlert } from "@/config/wearableConfig";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchWearableStatus(): Promise<WearableStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/wearable/status`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Could not fetch wearable status", e);
  }

  return {
    connected: false,
    port: "COM5",
    state: "disconnected",
    mpu_ok: true,
    last_reading_at: null,
    readings_per_second: 0,
    skipped_lines: 0,
    legacy_lines: 0,
    last_bad_line: "",
  };
}

export async function fetchLatestReadings(n: number = 25): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/wearable/latest?n=${n}`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Network fallback
  }
  return [];
}

export async function triggerBandVibration(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/wearable/vibrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, message: data.message || "Vibration command sent." };
    }
    return { success: false, message: data.detail || "Band vibration failed." };
  } catch (e: any) {
    return { success: false, message: e.message || "Network error connecting to backend." };
  }
}

export async function triggerTestAlert(params?: { personId?: string; sessionId?: string }): Promise<{ success: boolean; alert?: WearableAlert; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/alerts/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: params?.personId || null,
        session_id: params?.sessionId || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, alert: data.alert };
    }
    return { success: false, error: data.detail || "Failed to trigger test alert." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function fetchPeople(includeSample: boolean = true): Promise<Person[]> {
  try {
    const res = await fetch(`${API_BASE}/api/people?include_sample=${includeSample}`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to list people", e);
  }
  return [];
}

export async function createPerson(code: string, displayName?: string): Promise<{ success: boolean; person?: Person; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, display_name: displayName || null }),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, person: data };
    }
    return { success: false, error: data.detail || "Failed to create person." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function fetchActiveSession(): Promise<{ active: boolean; session: Session | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions/active`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to fetch active session", e);
  }
  return { active: false, session: null };
}

export async function startSession(params: {
  personId: string;
  type?: "normal" | "baseline";
  label?: "still" | "typing" | "walking" | "shaking" | "other" | null;
  note?: string | null;
}): Promise<{ success: boolean; session?: Session; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: params.personId,
        type: params.type || "normal",
        label: params.label || null,
        note: params.note || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, session: data };
    }
    return { success: false, error: data.detail || "Failed to start session." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function stopSession(sessionId: string): Promise<{ success: boolean; session?: Session; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, session: data };
    }
    return { success: false, error: data.detail || "Failed to stop session." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function fetchPersonBaseline(personId: string): Promise<{
  person_id: string;
  tremor_share: number | null;
  tremor_strength: number | null;
  sessions_used: number;
  recorded_at: string | null;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/people/${personId}/baseline`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to fetch baseline", e);
  }
  return {
    person_id: personId,
    tremor_share: null,
    tremor_strength: null,
    sessions_used: 0,
    recorded_at: null,
  };
}

export async function fetchSessions(personId?: string, includeSample: boolean = true): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (personId) params.append("person_id", personId);
    params.append("include_sample", String(includeSample));
    const url = `${API_BASE}/api/sessions?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to list sessions", e);
  }
  return [];
}

export async function fetchAlerts(personId?: string, sessionId?: string): Promise<WearableAlert[]> {
  try {
    let url = `${API_BASE}/api/alerts`;
    const params = new URLSearchParams();
    if (sessionId) {
      url = `${API_BASE}/api/sessions/${sessionId}/alerts`;
    } else if (personId) {
      params.append("person_id", personId);
      url = `${API_BASE}/api/alerts?${params.toString()}`;
    }
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to list alerts", e);
  }
  return [];
}

export async function fetchSessionTimeline(sessionId: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/timeline`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to fetch session timeline", e);
  }
  return null;
}

export async function loadReplayDataset(params: {
  preset?: "demo_short" | "demo_tremor" | null;
  csvText?: string | null;
  filename?: string | null;
}): Promise<{ success: boolean; filename?: string; sampleCount?: number; meta?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset: params.preset || null,
        csv_text: params.csvText || null,
        filename: params.filename || "dataset.csv",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, filename: data.filename, sampleCount: data.sample_count, meta: data.meta };
    }
    return { success: false, error: data.detail || "Failed to load CSV." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function commitValidationSession(params: {
  personId: string;
  sessionType?: "normal" | "baseline";
  label?: string | null;
  note?: string | null;
}): Promise<{ success: boolean; session?: any; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/commit_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: params.personId,
        session_type: params.sessionType || "normal",
        label: params.label || null,
        note: params.note || "Imported from validation replay",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, session: data.session, message: data.message };
    }
    return { success: false, error: data.detail || "Failed to commit session." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function startReplay(params: {
  speed?: number;
  personId?: string | null;
  sessionType?: "normal" | "baseline";
  label?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speed: params.speed || 1.0,
        person_id: params.personId || null,
        session_type: params.sessionType || "normal",
        label: params.label || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: data.detail || "Failed to start replay." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function pauseReplay(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/pause`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resumeReplay(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/resume`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function stopReplay(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/stop`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchReplayStatus(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/status`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to fetch replay status", e);
  }
  return {
    state: "idle",
    connected: false,
    port: "REPLAY_SIMULATOR",
    filename: "",
    current_index: 0,
    total_samples: 0,
    progress_pct: 0.0,
    speed: 1.0,
    last_reading: null,
    vibrations_count: 0,
  };
}

export async function fetchReportSummary(
  personId: string,
  range: string = "7d",
  fromDate?: string,
  toDate?: string
): Promise<any | null> {
  try {
    const params = new URLSearchParams();
    params.append("person_id", personId);
    params.append("range", range);
    if (fromDate) params.append("from", fromDate);
    if (toDate) params.append("to", toDate);

    const res = await fetch(`${API_BASE}/api/people/${personId}/report?${params.toString()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to fetch multi-day report summary", e);
  }
  return null;
}

export async function loadSamplePerson(): Promise<{
  success: boolean;
  message?: string;
  summary?: {
    person_code: string;
    person_name: string;
    sessions_created: number;
    readings_created: number;
    alerts_created: number;
    days_span: number;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/sample-person/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, message: data.message, summary: data.summary };
    }
    return { success: false, error: data.detail || "Failed to load sample person." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function removeSamplePerson(): Promise<{
  success: boolean;
  message?: string;
  summary?: {
    deleted_sessions: number;
    deleted_readings: number;
    deleted_alerts: number;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/sample-person/remove`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, message: data.message, summary: data.summary };
    }
    return { success: false, error: data.detail || "Failed to remove sample person." };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error." };
  }
}

export async function fetchSamplePersonStatus(): Promise<{
  exists: boolean;
  person?: Person | null;
  sessions_count?: number;
  readings_count?: number;
  alerts_count?: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/sample-person/status`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Failed to fetch sample person status", e);
  }
  return { exists: false };
}






