/**
 * STEADY Guardian - Browser Geolocation Utility
 *
 * Thin, dependency-free wrapper around `navigator.geolocation` with explicit
 * permission / error handling. Location is only ever read when the caller
 * invokes these functions (no silent background tracking).
 */

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: number; // epoch ms
}

export type GeoErrorCode =
  | "unsupported"
  | "permission_denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export interface GeoError {
  code: GeoErrorCode;
  message: string;
}

export const GEO_PERMISSION_DENIED_MESSAGE =
  "Location permission was denied. Enable location access for STEADY in your browser settings to share your location with a guardian.";

function toGeoError(err: GeolocationPositionError): GeoError {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return { code: "permission_denied", message: GEO_PERMISSION_DENIED_MESSAGE };
    case err.POSITION_UNAVAILABLE:
      return {
        code: "unavailable",
        message: "Your location is currently unavailable. Please check your GPS signal and try again.",
      };
    case err.TIMEOUT:
      return {
        code: "timeout",
        message: "Timed out while acquiring your location. Please try again.",
      };
    default:
      return { code: "unknown", message: err.message || "Unable to determine your location." };
  }
}

function fromPosition(pos: GeolocationPosition): GeoPosition {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

/** True when the browser exposes the Geolocation API and we are in a browser. */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Resolves a single current position (or rejects with a GeoError).
 */
export function getCurrentLocation(timeoutMs = 15000): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject({ code: "unsupported", message: "This browser does not support location services." } as GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromPosition(pos)),
      (err) => reject(toGeoError(err)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

/**
 * Starts watching the position. Returns the watch id (pass to `stopWatching`).
 * Returns `null` when geolocation is unsupported.
 */
export function watchLocation(
  onUpdate: (position: GeoPosition) => void,
  onError: (error: GeoError) => void,
  options?: PositionOptions
): number | null {
  if (!isGeolocationSupported()) {
    onError({ code: "unsupported", message: "This browser does not support location services." });
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate(fromPosition(pos)),
    (err) => onError(toGeoError(err)),
    options ?? { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
  );
}

/** Stops a previously started watch. Safe to call with null. */
export function stopWatching(watchId: number | null): void {
  if (watchId !== null && isGeolocationSupported()) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/** Two coordinates formatted for compact display. */
export function formatCoordinates(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return "No location";
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}