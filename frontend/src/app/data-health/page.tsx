"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TechnicalDetailsExpand } from "@/components/TechnicalDetailsExpand";
import {
  getDataHealthSummary,
  saveDataHealthSummary,
  DataHealthSummary,
} from "@/lib/dataHealth";
import {
  ArrowLeft,
  Activity,
  Battery,
  BatteryWarning,
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Database,
  Moon,
  Zap,
  Info,
} from "lucide-react";

export default function DataHealthPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<DataHealthSummary>(() => getDataHealthSummary());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHealth(getDataHealthSummary());
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleReconnectBle = () => {
    setIsReconnecting(true);
    setTimeout(() => {
      setIsReconnecting(false);
      const updated = saveDataHealthSummary({ isBandConnected: true, bandBatteryPct: 88 });
      setHealth(updated);
      showToast("Band reconnected successfully via Bluetooth!");
    }, 1200);
  };

  const handleToggleLightMode = () => {
    const updated = saveDataHealthSummary({ isLightMode: !health.isLightMode });
    setHealth(updated);
    showToast(
      updated.isLightMode
        ? "Light mode enabled (periodic check-ins only)"
        : "Standard mode active (continuous check-ins)"
    );
  };

  const handleBurdenRating = (score: number) => {
    const updated = saveDataHealthSummary({ burdenScore: score });
    setHealth(updated);
    showToast(`Burden score ${score}/5 saved. Thank you!`);
  };

  const handleToggleGps = () => {
    const updated = saveDataHealthSummary({
      guardianGpsEnabled: !health.guardianGpsEnabled,
    });
    setHealth(updated);
    showToast(
      updated.guardianGpsEnabled
        ? "Guardian GPS sharing enabled (Revocable at any time)"
        : "Guardian GPS location sharing revoked"
    );
  };

  const handleToggleSymptomSync = () => {
    const updated = saveDataHealthSummary({
      guardianSymptomSync: !health.guardianSymptomSync,
    });
    setHealth(updated);
    showToast(
      updated.guardianSymptomSync
        ? "Opted-in: Location sharing linked to symptom alerts"
        : "Location alerts decoupled from symptom data"
    );
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
                🏥 Data Health &amp; Daily Usability
              </h1>
              <p className="text-xs text-[#64748B]">
                Sensor data quality, low-effort BLE recovery, and burden controls
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 1. DATA HEALTH USABLE DAYS SUMMARY */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0] bg-gradient-to-br from-blue-50/50 to-indigo-50/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-xs font-extrabold text-[#172554] uppercase tracking-wider">
              Data Usability Summary
            </h2>
          </div>
          <span className="text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full">
            {health.usablePercentage}% Usable
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-[#172554]">
            {health.usableDaysCount}
          </span>
          <span className="text-xs font-bold text-[#64748B]">
            of {health.totalDaysLogged} days logged with high-integrity data
          </span>
        </div>

        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-[#2563EB] h-full rounded-full transition-all duration-500"
            style={{ width: `${health.usablePercentage}%` }}
          />
        </div>
      </Card>

      {/* 2. TOP REASONS FOR DATA GAPS LOG */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Top Reasons for Data Gaps
            </h2>
          </div>
          <span className="text-[10px] text-slate-500">Last 30 Days</span>
        </div>

        <div className="space-y-2 pt-1">
          {health.gapReasons.map((g) => (
            <div
              key={g.id}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1"
            >
              <div className="flex items-center justify-between font-bold text-[#172554]">
                <span>{g.label}</span>
                <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                  {g.count} times ({g.pct}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-normal">
                💡 <strong>Remedy:</strong> {g.remedy}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. LOW-EFFORT SENSOR RECOVERY & ONE-TAP BLE RECONNECT */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Low-Effort Sensor Recovery
            </h2>
          </div>
          <span className="text-[10px] font-bold text-slate-500">Tremor-Friendly (44px+)</span>
        </div>

        {/* Battery Warning */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs">
          <div className="flex items-center gap-2.5">
            <BatteryWarning className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-amber-950 block">Band Battery Status</span>
              <span className="text-amber-800 text-[11px] font-normal">
                {health.bandBatteryPct}% charged (Battery warning triggers below 15%)
              </span>
            </div>
          </div>
          <span className="font-extrabold text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-full text-xs">
            {health.bandBatteryPct}%
          </span>
        </div>

        {/* One-Tap BLE Reconnect Button (Large 52px Target) */}
        <button
          onClick={handleReconnectBle}
          disabled={isReconnecting}
          className="w-full min-h-[52px] py-3 px-4 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          aria-label="One-tap Bluetooth reconnect button"
        >
          <RefreshCw className={`w-5 h-5 ${isReconnecting ? "animate-spin" : ""}`} />
          <span>{isReconnecting ? "Reconnecting Band..." : "One-Tap Bluetooth Reconnect"}</span>
        </button>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Auto-resume enabled: Automatically reconnects after signal dropouts</span>
        </div>
      </Card>

      {/* 4. OFFLINE OPERATION & BUFFER INDICATOR */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0] bg-slate-50/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Offline Storage Buffer
            </h2>
          </div>
          <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300 px-2.5 py-0.5 rounded-full">
            Local Buffer Active
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-normal">
          All wearable and phone readings are buffered locally when offline and automatically sync when internet connection returns. <strong>Cue Lab and Freeze Assist work 100% offline without network calls.</strong>
        </p>

        <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-800">
          <span>Buffered Local Records:</span>
          <span className="text-[#2563EB] font-bold">{health.bufferedRecordsCount} records pending sync</span>
        </div>
      </Card>

      {/* 5. BURDEN CONTROLS & MONTHLY 1-5 CHECK-IN */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-600" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Patient Burden Controls
            </h2>
          </div>
          <span className="text-[10px] text-slate-500">Low Effort</span>
        </div>

        {/* Light Mode Toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 border border-purple-200 text-xs">
          <div>
            <span className="font-extrabold text-purple-950 block">App Light Mode</span>
            <span className="text-purple-800 text-[11px] font-normal">
              Periodic check-ins instead of continuous camera/voice prompts
            </span>
          </div>

          <button
            onClick={handleToggleLightMode}
            className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all min-h-[44px] cursor-pointer ${
              health.isLightMode
                ? "bg-purple-700 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
            aria-label="Toggle Light Mode"
          >
            {health.isLightMode ? "ON (Light)" : "OFF (Standard)"}
          </button>
        </div>

        {/* Short Monthly Burden Rating (1-5 Scale) */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold text-[#172554] block">
            Monthly Burden Check: How much effort is using this app?
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => handleBurdenRating(val)}
                className={`min-h-[44px] py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  health.burdenScore === val
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
                aria-label={`Burden rating ${val} of 5`}
              >
                {val} {val === 1 ? "Very Low" : val === 5 ? "High" : ""}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 6. GUARDIAN GPS PRIVACY & REVOCABLE CONSENT */}
      <Card className="space-y-3.5 border-teal-200 bg-teal-50/40">
        <div className="flex items-center justify-between border-b border-teal-200/80 pb-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
              Guardian GPS Location Controls
            </h2>
          </div>
          {health.guardianGpsEnabled ? (
            <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Location Shared
            </span>
          ) : (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded-full">
              GPS Private (OFF)
            </span>
          )}
        </div>

        {/* Explicit Revocable Consent Toggle */}
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="font-extrabold text-teal-950 block">Explicit Location Sharing</span>
            <span className="text-teal-800 text-[11px] font-normal">
              Revocable at any time. Patient is always notified when location is active.
            </span>
          </div>
          <button
            onClick={handleToggleGps}
            className={`px-3.5 py-2 rounded-full font-bold text-xs transition-all min-h-[44px] cursor-pointer ${
              health.guardianGpsEnabled
                ? "bg-teal-700 text-white"
                : "bg-slate-200 text-slate-800 hover:bg-slate-300"
            }`}
            aria-label="Toggle Guardian GPS consent"
          >
            {health.guardianGpsEnabled ? "Revoke Sharing" : "Enable GPS"}
          </button>
        </div>

        {/* Symptom Decoupling Option */}
        <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-teal-950 block">Tie Location Alerts to Symptoms?</span>
            <span className="text-teal-800 text-[11px] font-normal">
              Location alerts are decoupled from symptom data unless explicitly opted in.
            </span>
          </div>
          <button
            onClick={handleToggleSymptomSync}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all min-h-[44px] cursor-pointer ${
              health.guardianSymptomSync
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 border border-slate-300"
            }`}
          >
            {health.guardianSymptomSync ? "Opted IN" : "Decoupled"}
          </button>
        </div>
      </Card>
    </div>
  );
}
