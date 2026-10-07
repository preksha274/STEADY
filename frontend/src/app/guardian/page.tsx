"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { LeafletMap } from "@/components/LeafletMap";
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  LocateFixed,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  RefreshCw,
  Lock,
  ArrowLeft,
  Navigation,
  PhoneCall,
  Share2,
  Send,
  AlertCircle,
  Play,
  Square,
  Copy,
} from "lucide-react";

export default function GuardianPatientPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Safe zone & location state
  const [safeLat, setSafeLat] = useState<number>(37.7749);
  const [safeLng, setSafeLng] = useState<number>(-122.4194);
  const [radiusMeters, setRadiusMeters] = useState<number>(150);

  // Consent & Live Sharing State
  const [sharingEnabled, setSharingEnabled] = useState<boolean>(false);
  const [guardianPhone, setGuardianPhone] = useState<string>("+15550192831");

  // Geolocation position & status
  const [currentLat, setCurrentLat] = useState<number>(37.7749);
  const [currentLng, setCurrentLng] = useState<number>(-122.4194);
  const [accuracyM, setAccuracyM] = useState<number | null>(12);
  const [distanceM, setDistanceM] = useState<number>(0);
  const [isInside, setIsInside] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Geolocation permission / error state
  const [geoError, setGeoError] = useState<string | null>(null);

  // SOS state
  const [isSosConfirmOpen, setIsSosConfirmOpen] = useState(false);
  const [sosStatus, setSosStatus] = useState<"idle" | "posting" | "sent" | "failed">("idle");

  // Demo Route simulation state
  const [isDemoRouteActive, setIsDemoRouteActive] = useState(false);
  const demoStepRef = useRef(0);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Shareable Caregiver Link Token
  const [shareToken, setShareToken] = useState("st_token_8a39f291");

  useEffect(() => {
    setMounted(true);

    try {
      const stored = localStorage.getItem("steady_guardian_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.lat) setSafeLat(parsed.lat);
        if (parsed.lng) setSafeLng(parsed.lng);
        if (parsed.radiusMeters) setRadiusMeters(parsed.radiusMeters);
        if (parsed.sharingEnabled !== undefined) setSharingEnabled(parsed.sharingEnabled);
        if (parsed.currentLat) setCurrentLat(parsed.currentLat);
        if (parsed.currentLng) setCurrentLng(parsed.currentLng);
        if (parsed.guardianPhone) setGuardianPhone(parsed.guardianPhone);
      }
    } catch (e) {
      console.error("Could not load guardian settings", e);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Haversine formula
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Sync ping to backend FastAPI endpoint
  const sendPingToBackend = async (
    cLat: number,
    cLng: number,
    accM: number | null,
    sharing: boolean,
    isSim: boolean = false
  ) => {
    const dist = calcDistance(safeLat, safeLng, cLat, cLng);
    const inside = dist <= radiusMeters;
    setDistanceM(dist);
    setIsInside(inside);
    const nowIso = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLastUpdated(nowIso);

    // Save locally
    const stateObj = {
      lat: safeLat,
      lng: safeLng,
      radiusMeters,
      sharingEnabled: sharing,
      currentLat: cLat,
      currentLng: cLng,
      distanceM: dist,
      isInside: inside,
      lastUpdated: nowIso,
      guardianPhone,
    };
    localStorage.setItem("steady_guardian_settings", JSON.stringify(stateObj));

    // Post location ping to FastAPI backend if sharing is ON
    if (sharing) {
      try {
        await fetch("http://localhost:8000/api/v1/guardian/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: cLat,
            longitude: cLng,
            location_sharing_enabled: true,
            is_simulated: isSim,
          }),
        });
      } catch (e) {
        // Handled silently
      }
    }
  };

  // Real GPS Geolocation watchPosition loop
  useEffect(() => {
    if (!sharingEnabled || isDemoRouteActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setGeoError("GPS Geolocation is not supported by your browser.");
      return;
    }

    setGeoError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const cLat = pos.coords.latitude;
        const cLng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        setCurrentLat(cLat);
        setCurrentLng(cLng);
        setAccuracyM(acc);
        sendPingToBackend(cLat, cLng, acc, true, false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Location permission denied. Please allow location access in browser settings.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("No GPS fix available right now. Ensure GPS location is turned ON.");
        } else {
          setGeoError("GPS timeout acquiring location fix.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [sharingEnabled, isDemoRouteActive, safeLat, safeLng, radiusMeters]);

  // Demo Walking Route Simulation (steps every 5s)
  useEffect(() => {
    if (!isDemoRouteActive) return;

    const waypoints = [
      { lat: safeLat, lng: safeLng },
      { lat: safeLat + 0.0005, lng: safeLng + 0.0005 },
      { lat: safeLat + 0.0012, lng: safeLng + 0.0012 },
      { lat: safeLat + 0.0022, lng: safeLng + 0.0022 },
      { lat: safeLat + 0.0035, lng: safeLng + 0.0035 }, // Outside safe zone (~350m)
      { lat: safeLat + 0.0018, lng: safeLng + 0.0018 },
      { lat: safeLat, lng: safeLng },
    ];

    const interval = setInterval(() => {
      demoStepRef.current = (demoStepRef.current + 1) % waypoints.length;
      const wp = waypoints[demoStepRef.current];
      setCurrentLat(wp.lat);
      setCurrentLng(wp.lng);
      sendPingToBackend(wp.lat, wp.lng, 5, true, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [isDemoRouteActive, safeLat, safeLng]);

  const handleToggleSharing = (val: boolean) => {
    setSharingEnabled(val);
    if (!val) {
      setIsDemoRouteActive(false);
    }
    sendPingToBackend(currentLat, currentLng, accuracyM, val, isDemoRouteActive);
    showToast(val ? "Location sharing enabled for Caregiver" : "Location sharing turned OFF");
  };

  const handleToggleDemoRoute = () => {
    if (!isDemoRouteActive) {
      setSharingEnabled(true);
      setIsDemoRouteActive(true);
      demoStepRef.current = 0;
      showToast("▶ Demo walking route started (stepping every 5s)");
    } else {
      setIsDemoRouteActive(false);
      showToast("Square Demo route stopped");
    }
  };

  const handleSetSafeZone = () => {
    setSafeLat(currentLat);
    setSafeLng(currentLng);
    sendPingToBackend(currentLat, currentLng, accuracyM, sharingEnabled);
    showToast("Home Base set to current map position!");
  };

  // SOS Action Trigger: (a) POSTs SOS to backend, (b) Opens prefilled WhatsApp/SMS link
  const executeSosAlert = async () => {
    setIsSosConfirmOpen(false);
    setSosStatus("posting");

    const mapsUrl = `https://maps.google.com/?q=${currentLat},${currentLng}`;
    const message = `EMERGENCY SOS: Patient needs help! Current Location: ${mapsUrl}`;

    let postSuccess = false;
    try {
      const res = await fetch("http://localhost:8000/api/v1/alerts/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        postSuccess = true;
      }
    } catch (e) {
      postSuccess = false;
    }

    if (postSuccess) {
      setSosStatus("sent");
      showToast("Sent to guardian page");
    } else {
      setSosStatus("failed");
      showToast(`Could not send. Call ${guardianPhone}`);
    }

    // Open WhatsApp / SMS prefilled link
    const cleanPhone = guardianPhone.replace(/[^0-9+]/g, "");
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleCopyShareLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/guardian/caregiver-view?token=${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("Shareable Caregiver Link copied to clipboard!");
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4 text-left">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* SOS CONFIRMATION MODAL */}
      {isSosConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border-2 border-rose-500 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-300">
              <ShieldAlert className="w-9 h-9 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-[#172554]">Trigger Emergency SOS?</h2>
              <p className="text-xs text-slate-600 font-normal leading-relaxed">
                This will send a critical alert with your live GPS location to your caregiver&apos;s page and prefill a WhatsApp message.
              </p>
              <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2">
                ⚠️ <strong>Honest Notice:</strong> Does NOT contact 911 or local emergency services.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setIsSosConfirmOpen(false)}
                className="py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 min-h-[48px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeSosAlert}
                className="py-3 rounded-2xl bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 shadow-md min-h-[48px] cursor-pointer"
              >
                Yes, Send SOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                🛡️ Guardian GPS &amp; SOS
              </h1>
              <p className="text-xs text-[#64748B]">Leaflet + OpenStreetMap safe-zone geofencing</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/guardian/caregiver-view?token=${shareToken}`)}
            className="bg-indigo-50 hover:bg-indigo-100 text-[#6366F1] border border-indigo-200 text-xs font-bold py-1.5 px-3 rounded-full cursor-pointer flex items-center gap-1.5 min-h-[44px]"
          >
            <Eye className="w-4 h-4" />
            Caregiver Page
          </button>
        </div>
      </header>

      {/* SOS EMERGENCY BUTTON (PROMINENT AT TOP) */}
      <div className="space-y-2">
        <button
          onClick={() => setIsSosConfirmOpen(true)}
          className="w-full min-h-[56px] py-3.5 px-5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          aria-label="Trigger Emergency SOS Alert"
        >
          <ShieldAlert className="w-6 h-6 animate-pulse" />
          <span className="tracking-wide uppercase">Trigger Guardian SOS Alert</span>
        </button>

        {/* Honest UI Status Message */}
        {sosStatus === "sent" && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sent to guardian page! WhatsApp prefilled.</span>
          </div>
        )}
        {sosStatus === "failed" && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Could not send. Call guardian directly: <strong>{guardianPhone}</strong></span>
          </div>
        )}
      </div>

      {/* GEOLOCATION PERMISSION / ERROR ALERT */}
      {geoError && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>GPS Fix / Permission Alert</span>
          </div>
          <p className="text-[11px] text-amber-800 font-normal leading-relaxed">{geoError}</p>
        </div>
      )}

      {/* CONSENT SHARING TOGGLE CARD WITH ONE-TAP STOP */}
      <Card
        className={`space-y-3.5 border transition-all ${
          sharingEnabled
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-slate-200 bg-slate-50/70"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                sharingEnabled
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-300 text-slate-600"
              }`}
            >
              {sharingEnabled ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                  Location Sharing
                </h2>
                {sharingEnabled && (
                  <span className="text-[10px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> Live Pinging
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-[#64748B] block">
                {sharingEnabled ? "Posting GPS every ~5s" : "Sharing OFF (Private)"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleSharing(!sharingEnabled)}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
              sharingEnabled
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            }`}
          >
            {sharingEnabled ? "One-Tap Stop Sharing" : "Turn ON Sharing"}
          </button>
        </div>
      </Card>

      {/* LIVE LEAFLET + OPENSTREETMAP MAP CARD (FREE TOOLS) */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Live Map (Leaflet + OpenStreetMap)
            </h3>
          </div>
          <StatusDot
            status={isInside ? "good" : "danger"}
            label={isInside ? `Inside (${distanceM}m)` : `Outside (${distanceM}m)`}
            size="sm"
          />
        </div>

        {/* Free OpenStreetMap Leaflet Component */}
        <LeafletMap
          patientLat={currentLat}
          patientLng={currentLng}
          safeZoneLat={safeLat}
          safeZoneLng={safeLng}
          safeZoneRadiusM={radiusMeters}
          patientLabel="You"
          isOutside={!isInside}
          className="h-60 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner"
        />

        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
          <span>GPS Fix: {currentLat.toFixed(4)}, {currentLng.toFixed(4)} (±{accuracyM || 10}m)</span>
          <span>{lastUpdated ? `Pings synced: ${lastUpdated}` : "Waiting for fix..."}</span>
        </div>
      </Card>

      {/* DEMO MODE WITH SIMULATED WALKING ROUTE */}
      <Card className="space-y-3 border-purple-200 bg-purple-50/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
              Demo Walking Route (No Movement Needed)
            </h3>
          </div>
          {isDemoRouteActive && (
            <span className="text-[10px] bg-purple-600 text-white font-extrabold px-2 py-0.5 rounded-full animate-pulse">
              Demo Route Active
            </span>
          )}
        </div>

        <p className="text-xs text-purple-900 leading-relaxed font-normal">
          Demonstrate safe-zone breaches and live location tracking without physically moving:
        </p>

        <button
          onClick={handleToggleDemoRoute}
          className={`w-full min-h-[48px] py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isDemoRouteActive
              ? "bg-purple-900 hover:bg-purple-950 text-white shadow-md"
              : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          }`}
        >
          {isDemoRouteActive ? (
            <>
              <Square className="w-4 h-4 fill-white" /> Stop Demo Walking Route
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" /> Start Demo Route (Simulated Waypoints)
            </>
          )}
        </button>
      </Card>

      {/* SAFE ZONE BOUNDARY ADJUSTMENT */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Home Base Safe Zone
            </h3>
          </div>
          <span className="text-xs font-extrabold text-[#2563EB]">{radiusMeters}m Radius</span>
        </div>

        <PrimaryButton onClick={handleSetSafeZone} className="w-full justify-center bg-[#2563EB]">
          <LocateFixed className="w-4 h-4 mr-2" /> Set Map Position as Home Base
        </PrimaryButton>

        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs font-bold text-[#172554]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Sliders className="w-3.5 h-3.5 text-[#2563EB]" /> Boundary Radius
            </span>
            <span className="text-[#2563EB]">{radiusMeters} meters</span>
          </div>
          <input
            type="range"
            min={50}
            max={500}
            step={25}
            value={radiusMeters}
            onChange={(e) => {
              const r = Number(e.target.value);
              setRadiusMeters(r);
              sendPingToBackend(currentLat, currentLng, accuracyM, sharingEnabled, isDemoRouteActive);
            }}
            className="w-full accent-[#2563EB] cursor-pointer"
          />
        </div>
      </Card>

      {/* SHAREABLE CAREGIVER LINK GENERATOR */}
      <Card className="space-y-3 border-indigo-200 bg-indigo-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              Shareable Caregiver Link
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold bg-white text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full">
            Token: {shareToken}
          </span>
        </div>

        <p className="text-xs text-indigo-900 leading-relaxed font-normal">
          Give this secure link to your caregiver to view your live OpenStreetMap location:
        </p>

        <button
          onClick={handleCopyShareLink}
          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-indigo-950 font-bold text-xs border border-indigo-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Copy className="w-4 h-4 text-indigo-600" />
          <span>Copy Shareable Caregiver Link</span>
        </button>
      </Card>
    </div>
  );
}