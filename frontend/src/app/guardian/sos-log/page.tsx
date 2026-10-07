"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  ArrowLeft,
  RefreshCw,
  Eye,
  AlertCircle,
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

export default function SosLogPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchLog = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/sos");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.warn("Could not load SOS log from backend", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchLog();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleTriggerSimulatedSos = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: "p_demo_1",
          token: "st_token_8a39f291",
          latitude: 37.7749 + (Math.random() - 0.5) * 0.005,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.005,
          accuracy_m: 5.0,
          is_simulated: true,
        }),
      });

      if (res.ok) {
        showToast("▶ Triggered simulated SOS event (Demo location)");
        await fetchLog();
      }
    } catch (e) {
      showToast("Error triggering simulated SOS event.");
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
              aria-label="Back to Guardian Page"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                📜 SOS Event Log
              </h1>
              <p className="text-xs text-[#64748B]">Verifiable event status history</p>
            </div>
          </div>
          <button
            onClick={fetchLog}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100"
            title="Refresh Log"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* DEMO MODE TRIGGER CARD */}
      <Card className="space-y-3 border-purple-200 bg-purple-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
              Demo Mode Simulation
            </h3>
          </div>
          <span className="text-[10px] bg-purple-600 text-white font-extrabold px-2 py-0.5 rounded-full">
            Demo location
          </span>
        </div>
        <p className="text-xs text-purple-900 leading-relaxed font-normal">
          Simulate an emergency SOS event with a fake location to test verifiable status progression without an actual emergency:
        </p>
        <button
          onClick={handleTriggerSimulatedSos}
          className="w-full min-h-[44px] py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Trigger Simulated SOS Event (Demo Location)</span>
        </button>
      </Card>

      {/* SOS EVENTS LIST */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-[#172554]">
          <span>Historical Events ({events.length})</span>
          <span className="text-slate-500 font-normal">Stored in JSON DB</span>
        </div>

        {events.length === 0 ? (
          <Card className="p-6 text-center space-y-2 border-slate-200 bg-slate-50">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">No SOS Events Logged</h3>
            <p className="text-xs text-slate-500">Trigger an SOS event from the patient view or click the Demo button above.</p>
          </Card>
        ) : (
          events.map((ev) => (
            <Card key={ev.id} className="p-4 space-y-2.5 border-[0.5px] border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className={`w-5 h-5 ${
                      ev.status === "acknowledged" ? "text-emerald-600" : "text-rose-600 animate-pulse"
                    }`}
                  />
                  <span className="text-xs font-extrabold text-[#172554] font-mono">{ev.id}</span>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    ev.status === "acknowledged"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : ev.status === "seen by guardian"
                      ? "bg-blue-50 text-blue-800 border-blue-300"
                      : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}
                >
                  {ev.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>Time: {new Date(ev.timestamp).toLocaleTimeString()}</div>
                <div>Lat: {ev.latitude.toFixed(4)}</div>
                <div>Lng: {ev.longitude.toFixed(4)}</div>
                <div>Accuracy: ±{ev.accuracy_m}m</div>
              </div>

              {ev.is_simulated && (
                <div className="text-[10px] text-purple-900 font-bold bg-purple-50 p-1.5 rounded-lg border border-purple-200">
                  📍 Simulated location labeled: &quot;Demo location&quot;
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
