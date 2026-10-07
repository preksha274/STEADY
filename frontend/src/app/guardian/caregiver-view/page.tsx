"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Lock,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Clock,
  ExternalLink,
  Navigation,
  RefreshCw,
} from "lucide-react";

interface AlertRecord {
  id: string;
  type: string;
  priority: string;
  message: string;
  created_at: string;
  resolved: boolean;
}

export default function CaregiverViewPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Status state from backend / storage
  const [sharingEnabled, setSharingEnabled] = useState<boolean>(false);
  const [isInside, setIsInside] = useState<boolean>(true);
  const [distanceM, setDistanceM] = useState<number>(0);
  const [radiusMeters, setRadiusMeters] = useState<number>(150);
  const [lat, setLat] = useState<number>(37.7749);
  const [lng, setLng] = useState<number>(-122.4194);
  const [currentLat, setCurrentLat] = useState<number>(37.7749);
  const [currentLng, setCurrentLng] = useState<number>(-122.4194);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      // 1. Try local storage sync
      const stored = localStorage.getItem("steady_guardian_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSharingEnabled(parsed.sharingEnabled ?? false);
        setIsInside(parsed.isInside ?? true);
        setDistanceM(parsed.distanceM ?? 0);
        setRadiusMeters(parsed.radiusMeters ?? 150);
        setLat(parsed.lat ?? 37.7749);
        setLng(parsed.lng ?? -122.4194);
        setCurrentLat(parsed.currentLat ?? 37.7749);
        setCurrentLng(parsed.currentLng ?? -122.4194);
        setLastUpdated(parsed.lastUpdated ?? null);
      }

      // 2. Fetch API status
      const res = await fetch("http://localhost:8000/api/v1/guardian/status");
      if (res.ok) {
        const data = await res.json();
        setSharingEnabled(data.sharing_enabled);
        if (data.sharing_enabled && data.latest_location) {
          setCurrentLat(data.latest_location.latitude);
          setCurrentLng(data.latest_location.longitude);
        }
        if (data.safe_zone) {
          setLat(data.safe_zone.latitude);
          setLng(data.safe_zone.longitude);
          setRadiusMeters(data.safe_zone.radius_m);
        }
        if (data.inside !== undefined && data.inside !== null) {
          setIsInside(data.inside);
        }
        if (data.distance_m !== undefined && data.distance_m !== null) {
          setDistanceM(data.distance_m);
        }
        if (data.alerts) {
          setAlerts(data.alerts);
        }
      }
    } catch (e) {
      // Fallback to local storage state
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSimulateLeave = async () => {
    const offsetLat = lat + 0.0032;
    const offsetLng = lng + 0.0032;

    const stateObj = {
      lat,
      lng,
      radiusMeters,
      sharingEnabled: true,
      currentLat: offsetLat,
      currentLng: offsetLng,
      distanceM: 350,
      isInside: false,
      lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    localStorage.setItem("steady_guardian_settings", JSON.stringify(stateObj));

    try {
      await fetch("http://localhost:8000/api/v1/guardian/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: offsetLat,
          longitude: offsetLng,
          location_sharing_enabled: true,
          is_simulated: true,
        }),
      });
    } catch (e) {}

    fetchStatus();
    showToast("🧪 Simulated safe zone breach (350m away)");
  };

  const handleSimulateReturn = async () => {
    const stateObj = {
      lat,
      lng,
      radiusMeters,
      sharingEnabled: true,
      currentLat: lat,
      currentLng: lng,
      distanceM: 0,
      isInside: true,
      lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    localStorage.setItem("steady_guardian_settings", JSON.stringify(stateObj));

    try {
      await fetch("http://localhost:8000/api/v1/guardian/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          location_sharing_enabled: true,
          is_simulated: false,
        }),
      });
    } catch (e) {}

    fetchStatus();
    showToast("🏠 Patient returned to safe zone");
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push("/guardian")}
              className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Back to Patient View"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                👁️ Caregiver Dashboard
              </h1>
              <p className="text-xs text-[#64748B]">Live GPS safe zone monitoring</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100"
            title="Refresh Status"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CONSENT GATE CHECK */}
      {!sharingEnabled ? (
        <Card className="space-y-4 border-slate-300 bg-slate-50 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#172554]">Location Sharing is Currently OFF</h2>
            <p className="text-xs text-[#64748B] max-w-[280px] mx-auto leading-relaxed">
              The patient has disabled location sharing on their device. Live GPS coordinates and safe zone status are unavailable until consent is turned ON.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed font-medium">
            <strong>Consent Guarantee:</strong> STEADY never displays stale or unconsented location data to caregivers.
          </div>
          <Button
            onClick={() => router.push("/guardian")}
            className="w-full justify-center bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
          >
            Go to Patient Device View (Enable Sharing)
          </Button>
        </Card>
      ) : (
        <>
          {/* SAFE ZONE STATUS BANNER */}
          <Card
            className={`space-y-3.5 border transition-all ${
              isInside
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-rose-300 bg-rose-50/80 animate-in fade-in duration-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-2xl shrink-0 ${
                    isInside ? "bg-emerald-500 text-white" : "bg-rose-600 text-white animate-pulse"
                  }`}
                >
                  {isInside ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isInside
                        ? "bg-emerald-200/80 text-emerald-900"
                        : "bg-rose-200 text-rose-900"
                    }`}
                  >
                    {isInside ? "Inside Safe Zone" : "OUTSIDE SAFE ZONE — ALERT"}
                  </span>
                  <h2 className="text-lg font-extrabold text-[#172554] mt-1">
                    {isInside ? "Patient is Safe & At Home" : "Safe Zone Breach Detected"}
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    {isInside
                      ? `Within ${radiusMeters}m safe boundary (${distanceM}m from center)`
                      : `Currently ${distanceM}m away from Home Base (Radius: ${radiusMeters}m)`}
                  </p>
                </div>
              </div>
            </div>

            {/* BREACH ALERT CARD */}
            {!isInside && (
              <div className="bg-rose-100/90 border border-rose-300 rounded-xl p-3.5 space-y-2 text-xs text-rose-950">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Patient has left the safe zone. Live location is available.</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-rose-200/80 text-[11px]">
                  <span>Last Ping: {lastUpdated || "Just now"}</span>
                  <Button
                    onClick={() => {
                      showToast("Opening Live GPS Map view...");
                    }}
                    className="bg-rose-600 text-white hover:bg-rose-700 text-[11px] py-1 px-2.5 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Open Live Map
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* CAREGIVER MAP */}
          <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                  Caregiver Live Map View
                </h3>
              </div>
              <span className="text-[10px] text-[#64748B]">Live GPS Tracking</span>
            </div>

            {/* Map Render */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative min-h-[200px] flex flex-col items-center justify-center overflow-hidden">
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    "radial-gradient(#38BDF8 1px, transparent 1px), radial-gradient(#38BDF8 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 10px 10px",
                }}
              />

              {/* Safe Zone Circle */}
              <div
                className={`absolute rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
                  isInside
                    ? "border-emerald-400/70 bg-emerald-500/10"
                    : "border-rose-500/70 bg-rose-500/10 animate-pulse"
                }`}
                style={{
                  width: `${Math.min(170, Math.max(100, (radiusMeters / 500) * 170))}px`,
                  height: `${Math.min(170, Math.max(100, (radiusMeters / 500) * 170))}px`,
                }}
              >
                <span className="text-[9px] font-bold text-emerald-300 bg-slate-900/80 px-1.5 py-0.5 rounded-full">
                  {radiusMeters}m Zone
                </span>
              </div>

              {/* Home Base */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white">
                  🏠
                </div>
                <span className="text-[10px] font-bold text-white mt-1 bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-700">
                  Patient Home Base
                </span>
              </div>

              {/* Patient Pin */}
              <div
                className={`absolute z-20 flex flex-col items-center transition-all duration-500 ${
                  isInside ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-3 ml-3" : "top-6 right-6"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-xl border-2 border-white animate-bounce ${
                    isInside ? "bg-emerald-500" : "bg-rose-600"
                  }`}
                >
                  📍
                </div>
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full text-white ${
                    isInside ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                >
                  {isInside ? "Patient (Home)" : "Patient (Outside)"}
                </span>
              </div>
            </div>

            {/* Dev Demo Controls */}
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#64748B]">Demo Controls:</span>
              <div className="flex gap-2">
                <button
                  onClick={handleSimulateLeave}
                  className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Simulate Exit
                </button>
                <button
                  onClick={handleSimulateReturn}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Simulate Return
                </button>
              </div>
            </div>
          </Card>

          {/* ALERT LOG LIST */}
          <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                  Caregiver Alert Log
                </h3>
              </div>
              <span className="text-[10px] text-[#64748B]">Recent Geofence Events</span>
            </div>

            <div className="space-y-2">
              {!isInside && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between font-bold">
                      <span>SAFE ZONE BREACH</span>
                      <span className="text-[10px] font-normal text-rose-700">{lastUpdated || "Active"}</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Patient exited {radiusMeters}m boundary (current distance: {distanceM}m).
                    </p>
                  </div>
                </div>
              )}

              {alerts.length > 0 ? (
                alerts.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl flex items-start gap-2 text-xs text-[#172554]"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{a.type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-[#64748B]">
                          {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B]">{a.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-center text-xs text-[#64748B]">
                  No prior breaches logged today. Patient has stayed within home safe zone.
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
