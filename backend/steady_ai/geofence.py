"""
STEADY AI - Geofencing Utilities
Pure, dependency-free geospatial helpers for the Guardian safe-zone layer.

These functions are intentionally side-effect free so they can be unit tested
without any persistence or framework dependencies. No heavy geospatial library
is required (great-circle distance via the Haversine formula only).
"""

import math
from typing import Any, Dict, Iterable, List, Optional

EARTH_RADIUS_M = 6371000.0  # Mean Earth radius in meters

# State tokens returned by ``determine_transition``.
TRANSITION_NONE = "NONE"
TRANSITION_ENTER = "ENTER"
TRANSITION_EXIT = "EXIT"


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two coordinates in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    # Clamp for floating point safety before asin.
    return 2.0 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def is_point_in_circle(
    lat: float,
    lon: float,
    center_lat: float,
    center_lon: float,
    radius_m: float,
) -> bool:
    """True if the point lies within ``radius_m`` of the circle center."""
    return haversine_m(lat, lon, center_lat, center_lon) <= radius_m


def evaluate_safe_zones(
    lat: float,
    lon: float,
    zones: Optional[Iterable[Dict[str, Any]]],
) -> Dict[str, Any]:
    """
    Evaluate a patient location against a collection of circular safe zones.

    A patient is considered *inside* if they are inside at least one enabled
    safe zone. Returns a summary dict::

        {
            "inside": bool,
            "matched_zone_ids": [...],
            "nearest_distance_m": float | None,
            "nearest_zone_id": str | None,
        }
    """
    matched: List[str] = []
    nearest_distance: Optional[float] = None
    nearest_zone_id: Optional[str] = None

    for zone in zones or []:
        if not zone.get("enabled", True):
            continue

        center_lat = zone.get("latitude")
        center_lon = zone.get("longitude")
        radius_m = zone.get("radius_m")
        if center_lat is None or center_lon is None or radius_m is None:
            continue

        try:
            distance = haversine_m(lat, lon, float(center_lat), float(center_lon))
        except (TypeError, ValueError):
            continue

        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance
            nearest_zone_id = zone.get("id")

        if distance <= float(radius_m):
            matched.append(zone.get("id"))

    return {
        "inside": len(matched) > 0,
        "matched_zone_ids": matched,
        "nearest_distance_m": nearest_distance,
        "nearest_zone_id": nearest_zone_id,
    }


def determine_transition(
    previous_inside: Optional[bool],
    current_inside: bool,
) -> str:
    """
    Determine the safe-zone state transition.

    ``previous_inside`` of ``None`` means there is no known prior state
    (e.g. the very first location ping), so no transition alert is emitted.
    """
    if previous_inside is None:
        return TRANSITION_NONE
    if previous_inside and not current_inside:
        return TRANSITION_EXIT
    if (not previous_inside) and current_inside:
        return TRANSITION_ENTER
    return TRANSITION_NONE


__all__ = [
    "EARTH_RADIUS_M",
    "TRANSITION_NONE",
    "TRANSITION_ENTER",
    "TRANSITION_EXIT",
    "haversine_m",
    "is_point_in_circle",
    "evaluate_safe_zones",
    "determine_transition",
]
