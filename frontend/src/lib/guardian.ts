/**
 * STEADY Guardian Client Library
 * API operations for guardian linking, safe zones, location sharing, alerts,
 * SOS and the guardian dashboard.
 *
 * Follows the existing client pattern: X-User-ID header from the stored
 * session, Next.js `/api/backend` proxy, and null/[] fallback when the backend
 * is unreachable (offline-first). This is an awareness layer only - no medical
 * claims and no emergency-service contact.
 */

import {
  GeoError,
  GeoPosition,
  watchLocation,
  stopWatching,
} from "./location";

export const GUARDIAN_API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

export const LOCATION_PING_INTERVAL_MS = 60000; // send at most once per minute

export type GuardianRole = "patient" | "family" | "guardian" | "both";

export interface GuardianUserContext {
  user_id: string;
  email?: string;
  name?: string;
  role: GuardianRole;
}

export interface LinkStatus {
  user_id: string;
  role: GuardianRole;
  guardian_link_count: number; // patients this user watches
  patient_link_count: number; // guardians watching this user
}

export interface PairingCode {
  code: string;
  patient_id: string;
  expires_at: string;
  expires_in_minutes: number;
}

export interface LinkedPatient {
  link_id: string;
  patient_id: string;
  patient_label?: string | null;
  linked_at?: string;
}

export interface LinkedGuardian {
  link_id: string;
  guardian_id: string;
  guardian_email?: string | null;
  guardian_label?: string | null;
  linked_at?: string;
}

export interface SafeZone {
  id: string;
  patient_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SafeZoneInput {
  name: string;
  latitude: number;
  longitude: number;
  radius_m?: number;
  enabled?: boolean;
  patient_id?: string;
}

export interface LocationPing {
  id: string;
  patient_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  captured_at: string;
  received_at: string;
  source?: string;
  created_at?: string;
}

export type AlertType =
  | "SAFE_ZONE_BREACH"
  | "SAFE_ZONE_RETURN"
  | "NIGHT_ACTIVITY"
  | "PROLONGED_INACTIVITY"
  | "FREEZE_ASSIST"
  | "SOS";

export type AlertPriority = "INFO" | "AWARENESS" | "IMPORTANT" | "HIGH" | "CRITICAL";

export interface GuardianAlert {
  id: string;
  patient_id: string;
  type: AlertType;
  priority: AlertPriority;
  message: string;
  resolved: boolean;
  resolved_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NightAwareness {
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export interface GuardianSettings {
  patient_id: string;
  inactivity_threshold_min: number;
  night_awareness: NightAwareness;
  last_activity_at?: string | null;
}

export interface DashboardPatient {
  link_id: string;
  patient_id: string;
  patient_label: string;
  linked_at?: string;
  latest_location: LocationPing | null;
  safe_zone_status: {
    inside: boolean | null;
    evaluated_at: string | null;
    zone_count: number;
  };
  recent_alerts: GuardianAlert[];
  unresolved_alert_count: number;
  recent_activity: {
    last_activity_at: string | null;
    minutes_since: number | null;
    status: "active" | "quiet" | "inactive" | "unknown";
  };
  night_awareness_status: NightAwareness & {
    within_window: boolean;
    last_night_alert_date: string | null;
  };
}

export interface GuardianDashboard {
  guardian_id: string;
  generated_at: string;
  count: number;
  total_unresolved_alerts: number;
  patients: DashboardPatient[];
}

/** Reads the current user identity/role from the stored login session. */
export function getUserContext(): GuardianUserContext {
  if (typeof window === "undefined") return { user_id: "user_sarah_default", role: "patient" };
  try {
    const raw = localStorage.getItem("steady_user_session");
    if (raw) {
      const session = JSON.parse(raw);
      const isFamily = session.role === "family" || session.role === "guardian";
      return {
        user_id: session.user_id || "user_sarah_default",
        email: session.email,
        name: session.name,
        role: isFamily ? "family" : "patient",
      };
    }
  } catch (e) {
    console.warn("Failed to read guardian user context:", e);
  }
  return { user_id: "user_sarah_default", role: "patient" };
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-User-ID": getUserContext().user_id,
  };
}

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GUARDIAN_API_BASE}${path}`, { headers: headers() });
    if (res.ok) return (await res.json()) as T;
  } catch (e) {
    console.warn(`Guardian GET ${path} failed:`, e);
  }
  return null;
}

async function apiSend<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T | null> {
  try {
    const res = await fetch(`${GUARDIAN_API_BASE}${path}`, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as T;
    console.warn(`Guardian ${method} ${path} -> ${res.status}`);
  } catch (e) {
    console.warn(`Guardian ${method} ${path} failed:`, e);
  }
  return null;
}


// ---------------------------------------------------------------------------
// Guardian linking
// ---------------------------------------------------------------------------
export async function getLinkStatus(): Promise<LinkStatus | null> {
  return apiGet<LinkStatus>("/api/v1/guardian-links/status");
}

export async function createPairingCode(expiresInMinutes = 10): Promise<PairingCode | null> {
  return apiSend<PairingCode>("POST", "/api/v1/guardian-links/pairing-code", {
    expires_in_minutes: expiresInMinutes,
  });
}

export async function pairWithCode(
  code: string,
  labels?: { guardian_label?: string; patient_label?: string }
): Promise<{ id: string; patient_id: string; guardian_id: string } | null> {
  return apiSend("POST", "/api/v1/guardian-links/pair", { code, ...(labels || {}) });
}

export async function getLinkedPatients(): Promise<LinkedPatient[]> {
  const res = await apiGet<{ patients: LinkedPatient[] }>("/api/v1/guardian-links/patients");
  return res?.patients ?? [];
}

export async function getLinkedGuardians(): Promise<LinkedGuardian[]> {
  const res = await apiGet<{ guardians: LinkedGuardian[] }>("/api/v1/guardian-links/guardians");
  return res?.guardians ?? [];
}

export async function unlinkGuardian(linkId: string): Promise<boolean> {
  const res = await apiSend<{ status: string }>("DELETE", `/api/v1/guardian-links/${linkId}`);
  return res?.status === "unlinked";
}


// ---------------------------------------------------------------------------
// Safe zones
// ---------------------------------------------------------------------------
export async function listSafeZones(patientId?: string): Promise<SafeZone[]> {
  const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  const res = await apiGet<{ safe_zones: SafeZone[] }>(`/api/v1/safe-zones${query}`);
  return res?.safe_zones ?? [];
}

export async function createSafeZone(input: SafeZoneInput): Promise<SafeZone | null> {
  return apiSend<SafeZone>("POST", "/api/v1/safe-zones", input);
}

export async function updateSafeZone(
  zoneId: string,
  updates: Partial<SafeZoneInput>
): Promise<SafeZone | null> {
  return apiSend<SafeZone>("PATCH", `/api/v1/safe-zones/${zoneId}`, updates);
}

export async function deleteSafeZone(zoneId: string): Promise<boolean> {
  const res = await apiSend<{ status: string }>("DELETE", `/api/v1/safe-zones/${zoneId}`);
  return res?.status === "deleted";
}


// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------
export async function sendLocationPing(position: GeoPosition): Promise<LocationPing | null> {
  const res = await apiSend<{ ping: LocationPing }>("POST", "/api/v1/location-pings", {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy_m: position.accuracy,
    captured_at: new Date(position.timestamp).toISOString(),
    source: "browser_geolocation",
  });
  return res?.ping ?? null;
}

export async function getLatestLocation(patientId?: string): Promise<LocationPing | null> {
  const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  const res = await apiGet<{ latest: LocationPing | null }>(`/api/v1/location-pings/latest${query}`);
  return res?.latest ?? null;
}

export async function getLocationHistory(patientId?: string, limit = 50): Promise<LocationPing[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (patientId) params.set("patient_id", patientId);
  const res = await apiGet<{ pings: LocationPing[] }>(`/api/v1/location-pings/history?${params.toString()}`);
  return res?.pings ?? [];
}


// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export async function listAlerts(
  patientId?: string,
  onlyUnresolved = false
): Promise<GuardianAlert[]> {
  const params = new URLSearchParams();
  if (patientId) params.set("patient_id", patientId);
  if (onlyUnresolved) params.set("resolved", "false");
  const res = await apiGet<{ alerts: GuardianAlert[] }>(`/api/v1/alerts?${params.toString()}`);
  return res?.alerts ?? [];
}

export async function resolveAlert(alertId: string, note?: string): Promise<GuardianAlert | null> {
  return apiSend<GuardianAlert>("PATCH", `/api/v1/alerts/${alertId}/resolve`, note ? { note } : {});
}

export async function triggerSos(): Promise<GuardianAlert | null> {
  const res = await apiSend<{ alert: GuardianAlert }>("POST", "/api/v1/alerts/sos");
  return res?.alert ?? null;
}

export async function reportFreezeAssist(input?: {
  duration_s?: number;
  location_label?: string;
  notes?: string;
}): Promise<{ created: boolean; alert?: GuardianAlert } | null> {
  return apiSend("POST", "/api/v1/alerts/freeze-assist", input || {});
}

export async function registerActivity(
  significant = false,
  source = "device"
): Promise<{ last_activity_at: string; night_alert_id: string | null } | null> {
  return apiSend("POST", "/api/v1/alerts/activity", { significant, source });
}

export async function checkInactivity(patientId?: string): Promise<unknown> {
  const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  return apiSend("POST", `/api/v1/alerts/inactivity-check${query}`);
}


// ---------------------------------------------------------------------------
// Guardian dashboard + settings
// ---------------------------------------------------------------------------
export async function getGuardianDashboard(): Promise<GuardianDashboard | null> {
  return apiGet<GuardianDashboard>("/api/v1/guardian/dashboard");
}

export async function getGuardianSettings(patientId?: string): Promise<GuardianSettings | null> {
  const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  return apiGet<GuardianSettings>(`/api/v1/guardian/settings${query}`);
}

export async function updateGuardianSettings(input: {
  patient_id?: string;
  inactivity_threshold_min?: number;
  night_awareness?: NightAwareness;
}): Promise<GuardianSettings | null> {
  return apiSend<GuardianSettings>("PATCH", "/api/v1/guardian/settings", input);
}


// ---------------------------------------------------------------------------
// Location sharing controller (explicit, opt-in)
// ---------------------------------------------------------------------------
export interface LocationSharingController {
  stop: () => void;
}

/**
 * Starts explicit, opt-in location sharing: watches the browser position and
 * POSTs a ping to the backend at a fixed interval (not on every GPS update).
 * Returns a controller whose `stop()` disables watching and pinging.
 */
export function startLocationSharing(
  onUpdate?: (position: GeoPosition) => void,
  onError?: (error: GeoError) => void,
  intervalMs: number = LOCATION_PING_INTERVAL_MS
): LocationSharingController {
  let latest: GeoPosition | null = null;

  const watchId = watchLocation(
    (position) => {
      latest = position;
      onUpdate?.(position);
    },
    (error) => onError?.(error)
  );

  const timer = setInterval(() => {
    if (latest) {
      void sendLocationPing(latest);
    }
  }, intervalMs);

  return {
    stop: () => {
      clearInterval(timer);
      stopWatching(watchId);
    },
  };
}