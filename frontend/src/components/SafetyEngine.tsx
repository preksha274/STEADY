"use client";

import React, { useEffect, useRef } from "react";
import {
  checkInactivity,
  registerActivity,
  startLocationSharing,
  LocationSharingController,
} from "@/lib/guardian";

export const LOCATION_SHARING_KEY = "steady_location_sharing_enabled";
export const LOCATION_SHARING_EVENT = "steady:location-sharing-changed";

/** Reads the persisted, explicit location-sharing opt-in. */
export function isLocationSharingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LOCATION_SHARING_KEY) === "true";
  } catch (err) {
    console.warn("Could not read location sharing preference", err);
    return false;
  }
}

/** Persists + broadcasts a location-sharing toggle change. */
export function setLocationSharingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LOCATION_SHARING_KEY, enabled ? "true" : "false");
  } catch (err) {
    console.warn("Could not persist location sharing preference", err);
  }
  window.dispatchEvent(
    new CustomEvent(LOCATION_SHARING_EVENT, { detail: { enabled } })
  );
}

const ACTIVITY_DEBOUNCE_MS = 60000; // at most one activity ping per minute
const INACTIVITY_CHECK_MS = 60000; // evaluate prolonged inactivity every minute

/**
 * Background awareness engine (runs while the app is open):
 *  - registers debounced device activity (drives night-awareness + resets inactivity)
 *  - periodically evaluates prolonged inactivity
 *  - keeps opt-in location sharing alive (pings at a fixed interval)
 *
 * Renders nothing. Awareness only - no emergency-service contact is made.
 */
export const SafetyEngine: React.FC = () => {
  const sharingRef = useRef<LocationSharingController | null>(null);
  const lastActivityRef = useRef<number>(0);

  const noteActivity = () => {
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;
    lastActivityRef.current = now;
    void registerActivity(true, "device_interaction");
  };

  const applySharing = (enabled: boolean) => {
    if (enabled && !sharingRef.current) {
      sharingRef.current = startLocationSharing(undefined, (error) => {
        console.warn("Location sharing paused:", error.message);
      });
    } else if (!enabled && sharingRef.current) {
      sharingRef.current.stop();
      sharingRef.current = null;
    }
  };

  useEffect(() => {
    void registerActivity(true, "app_open");
    void checkInactivity();

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];
    events.forEach((evt) => window.addEventListener(evt, noteActivity, { passive: true }));

    const checkTimer = window.setInterval(
      () => void checkInactivity(),
      INACTIVITY_CHECK_MS
    );

    const onSharingChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled: boolean }>).detail;
      applySharing(Boolean(detail?.enabled));
    };
    window.addEventListener(LOCATION_SHARING_EVENT, onSharingChange);
    applySharing(isLocationSharingEnabled());

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, noteActivity));
      window.clearInterval(checkTimer);
      window.removeEventListener(LOCATION_SHARING_EVENT, onSharingChange);
      sharingRef.current?.stop();
      sharingRef.current = null;
    };
  }, []);

  return null;
};