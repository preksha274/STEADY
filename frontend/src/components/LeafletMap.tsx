"use client";

import React, { useEffect, useRef, useState } from "react";

interface LeafletMapProps {
  patientLat: number;
  patientLng: number;
  safeZoneLat: number;
  safeZoneLng: number;
  safeZoneRadiusM: number;
  patientLabel?: string;
  isOutside?: boolean;
  className?: string;
  onSafeZoneChange?: (newLat: number, newLng: number, newRadius: number) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  patientLat,
  patientLng,
  safeZoneLat,
  safeZoneLng,
  safeZoneRadiusM,
  patientLabel = "Patient",
  isOutside = false,
  className = "h-64 w-full rounded-2xl overflow-hidden shadow-inner",
  onSafeZoneChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const patientMarkerRef = useRef<any>(null);
  const safeZoneCircleRef = useRef<any>(null);
  const safeZoneMarkerRef = useRef<any>(null);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);

  // Load Leaflet JS & CSS dynamically from free CDN
  useEffect(() => {
    if (window.L) {
      setIsLeafletLoaded(true);
      return;
    }

    // Add Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Add Leaflet JS
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setIsLeafletLoaded(true);
      document.body.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (window.L) {
          setIsLeafletLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!isLeafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = window.L;

    // Create Map Instance centering on patient or safe zone
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([patientLat, patientLng], 15);

    // Free OpenStreetMap Tile Layer (NO API KEY)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Safe Zone Circle
    const circle = L.circle([safeZoneLat, safeZoneLng], {
      color: isOutside ? "#EF4444" : "#10B981",
      fillColor: isOutside ? "#EF4444" : "#10B981",
      fillOpacity: 0.15,
      radius: safeZoneRadiusM,
      weight: 2,
    }).addTo(map);
    safeZoneCircleRef.current = circle;

    // Safe Zone Center Marker (Home Base)
    const homeIcon = L.divIcon({
      className: "custom-home-icon",
      html: `<div style="background-color: #2563EB; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🏠</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const safeZoneMarker = L.marker([safeZoneLat, safeZoneLng], { icon: homeIcon }).addTo(map);
    safeZoneMarker.bindPopup("<b>Safe Zone Center (Home Base)</b>");
    safeZoneMarkerRef.current = safeZoneMarker;

    // Patient Position Marker
    const patientIcon = L.divIcon({
      className: "custom-patient-icon",
      html: `<div style="background-color: ${isOutside ? "#EF4444" : "#10B981"}; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4);" class="animate-bounce">📍</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const patientMarker = L.marker([patientLat, patientLng], { icon: patientIcon }).addTo(map);
    patientMarker.bindPopup(`<b>${patientLabel}</b><br/>${isOutside ? "⚠️ Outside Safe Zone!" : "Inside Safe Zone"}`);
    patientMarkerRef.current = patientMarker;

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLeafletLoaded]);

  // Update Markers & Circle when props change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;

    // Update patient marker
    if (patientMarkerRef.current) {
      patientMarkerRef.current.setLatLng([patientLat, patientLng]);
      const patientIcon = L.divIcon({
        className: "custom-patient-icon",
        html: `<div style="background-color: ${isOutside ? "#EF4444" : "#10B981"}; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4);" class="animate-bounce">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      patientMarkerRef.current.setIcon(patientIcon);
    }

    // Update safe zone circle
    if (safeZoneCircleRef.current) {
      safeZoneCircleRef.current.setLatLng([safeZoneLat, safeZoneLng]);
      safeZoneCircleRef.current.setRadius(safeZoneRadiusM);
      safeZoneCircleRef.current.setStyle({
        color: isOutside ? "#EF4444" : "#10B981",
        fillColor: isOutside ? "#EF4444" : "#10B981",
      });
    }

    // Update safe zone marker
    if (safeZoneMarkerRef.current) {
      safeZoneMarkerRef.current.setLatLng([safeZoneLat, safeZoneLng]);
    }

    // Pan map to contain patient
    mapInstanceRef.current.panTo([patientLat, patientLng]);
  }, [patientLat, patientLng, safeZoneLat, safeZoneLng, safeZoneRadiusM, isOutside]);

  return (
    <div className={`relative ${className}`}>
      {!isLeafletLoaded && (
        <div className="absolute inset-0 bg-slate-900 text-white flex flex-col items-center justify-center space-y-2 text-xs">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>Loading OpenStreetMap Leaflet Engine...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
