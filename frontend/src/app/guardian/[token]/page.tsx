"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { LeafletMap } from "@/components/LeafletMap";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ArrowLeft,
  Eye,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface SosEvent {
  id: string;
  patient_id: string;
  token: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  status: "received by server" | "seen by guardian" | "acknowledged";
  is_simulated?: boolean;
  seen_at?: string | null;
  acknowledged_at?: string | null;
}

export default function GuardianTokenPage() {
  const router = useRouter();
  const params = useParams();
  const token = (params?.token as string) || "st_token_8a39f291";

  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [latestSos, setLatestSos] = useState<SosEvent | null>(null);
  const [isAcking, setIsAcking] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchSosEvents = async () => {
    try {
      // Poll GET /sos/{token} or /api/v1/sos/{token}
      const res = await fetch(`http://localhost:8000/api/v1/sos/${token}`);
      if (res.ok) {
        const data = await res.json();
        const evList: SosEvent[] = data.events || [];
        setEvents(evList);
        if (evList.length > 0) {
          setLatestSos(evList[0]);
        }
      }
    } catch (e) {
      console.warn("Could not fetch SOS events from backend", e);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchSosEvents();
    // Poll every 3 seconds
    const interval = setInterval(fetchSosEvents, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleAcknowledge = async (eventId: string) => {
    setIsAcking(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/sos/${eventId}/ack`, {
        method: "POST",
      });
      if (res.ok) {
        showToast("SOS Alert Acknowledged! Patient notified.");
        await fetchSosEvents();
      } else {
        showToast("Failed to acknowledge SOS alert.");
      }
    } catch (e) {
      showToast("Error connecting to server to acknowledge.");
    } finally {
      setIsAcking(false);
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const defaultLat = latestSos ? latestSos.latitude : 37.7749;
  const defaultLng = latestSos ? latestSos.longitude : -122.4194;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in duration-200">
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
                👁️ Caregiver SOS View
              </h1>
              <p className="text-xs text-[#64748B]">Live GPS &amp; Verifiable SOS Stream</p>
            </div>
          </div>
          <button
            onClick={fetchSosEvents}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* LATEST SOS ALERT BANNER */}
      {latestSos ? (
        <Card
          className={`space-y-3.5 border-2 transition-all ${
            latestSos.status === "acknowledged"
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-rose-500 bg-rose-50/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl ${
                  latestSos.status === "acknowledged"
                    ? "bg-emerald-600 text-white"
                    : "bg-rose-600 text-white animate-pulse"
                }`}
              >
                {latestSos.status === "acknowledged" ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                    {latestSos.status === "acknowledged" ? "SOS Acknowledged" : "EMERGENCY SOS ALERT"}
                  </h2>
                  {latestSos.is_simulated && (
                    <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                      Demo location
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-[#64748B] block">
                  Status: <strong className="capitalize">{latestSos.status}</strong>
                </span>
              </div>
            </div>

            <StatusDot
              status={latestSos.status === "acknowledged" ? "good" : "danger"}
              label={latestSos.status === "acknowledged" ? "Resolved" : "Active SOS"}
              size="sm"
            />
          </div>

          <div className="p-3 bg-white/90 rounded-2xl border border-slate-200 text-xs space-y-1 font-mono">
            <div className="flex justify-between text-slate-700">
              <span className="text-slate-500">Timestamp:</span>
              <span>{new Date(latestSos.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="text-slate-500">Coordinates:</span>
              <span>{latestSos.latitude.toFixed(4)}, {latestSos.longitude.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="text-slate-500">Accuracy:</span>
              <span>±{latestSos.accuracy_m}m</span>
            </div>
          </div>

          {latestSos.status !== "acknowledged" ? (
            <button
              onClick={() => handleAcknowledge(latestSos.id)}
              disabled={isAcking}
              className="w-full min-h-[48px] py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isAcking ? "Acknowledging..." : "Acknowledge SOS Alert"}</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Acknowledged by Guardian at {new Date(latestSos.acknowledged_at || "").toLocaleTimeString()}</span>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-5 text-center space-y-2 border-slate-200 bg-slate-50">
          <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">No Active SOS Alerts</h3>
          <p className="text-xs text-slate-500">Patient has not triggered an emergency SOS alert.</p>
        </Card>
      )}

      {/* LIVE MAP CARD (LEAFLET + OPENSTREETMAP) */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Patient Live Location (OpenStreetMap)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Polling every 3s</span>
        </div>

        <LeafletMap
          patientLat={defaultLat}
          patientLng={defaultLng}
          safeZoneLat={defaultLat}
          safeZoneLng={defaultLng}
          safeZoneRadiusM={150}
          patientLabel="Patient Location"
          className="h-60 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner"
        />


        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
          <span>Token: {token}</span>
          <span>{latestSos ? `Last SOS: ${new Date(latestSos.timestamp).toLocaleTimeString()}` : "Waiting..."}</span>
        </div>
      </Card>
    </div>
  );
}
