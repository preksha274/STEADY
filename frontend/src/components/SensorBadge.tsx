"use client";

import React, { useState } from "react";
import { useSensorSource, checkVibrationSupport } from "@/lib/sensorSource";
import { steadyBandAdapter } from "@/lib/steadyBandAdapter";
import {
  Smartphone,
  Activity,
  Play,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  X,
  Volume2,
} from "lucide-react";

export function SensorBadge() {
  const { source, health, changeSource, requestPermission } = useSensorSource();
  const [isOpen, setIsOpen] = useState(false);
  const vibration = checkVibrationSupport();

  const handlePhoneSelect = async () => {
    const granted = await requestPermission();
    changeSource("phone");
    setIsOpen(false);
  };

  const getBadgeStyle = () => {
    if (source === "band") {
      return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
    }
    if (source === "phone") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
    }
    return "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100";
  };

  const getIcon = () => {
    if (source === "band") return <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    if (source === "phone") return <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    return <Play className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
  };

  return (
    <>
      {/* VISIBLE BADGE ON SCREEN */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${getBadgeStyle()}`}
        title="Click to view sensor health and switch sensor source"
      >
        {getIcon()}
        <span>{health.label}</span>
        {health.status === "disconnected" && (
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        )}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* SENSOR HEALTH & SOURCE SELECTOR MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full text-left space-y-4 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#2563EB]" />
                <h3 className="text-sm font-extrabold text-[#172554]">Sensor Source &amp; Connection</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BAND DISCONNECT ALERT WITH ONE-TAP SWITCH */}
            {source === "band" && health.status === "disconnected" && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-rose-900 font-bold">
                  <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Steady Band Disconnected</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                  Hardware signal lost. One-tap switch to phone IMU mode to resume tracking on your wrist:
                </p>
                <button
                  onClick={handlePhoneSelect}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>One-Tap Switch to Phone Mode</span>
                </button>
              </div>
            )}

            {/* LIVE HEALTH METRICS & BAND TELEMETRY */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Active Source:</span>
                <span className="font-bold text-[#172554] uppercase">{health.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Packets / Sec:</span>
                <span className="font-bold text-blue-600">{health.pps} pps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Sample Rate:</span>
                <span className="font-bold text-slate-800">{health.actualSampleRateHz} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Sample Age:</span>
                <span className="font-bold text-slate-800">{health.lastSampleAgeMs} ms</span>
              </div>

              {source === "band" && (
                <>
                  <div className="border-t border-slate-200 my-1 pt-1 flex justify-between">
                    <span className="text-slate-500">Battery Level:</span>
                    <span className="font-bold text-emerald-600">
                      {steadyBandAdapter.getTelemetry().batteryPct}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Firmware:</span>
                    <span className="font-bold text-slate-700">
                      {steadyBandAdapter.getTelemetry().firmwareVersion}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Packet Loss / Drop:</span>
                    <span className="font-bold text-amber-600">
                      {steadyBandAdapter.getTelemetry().packetLossCount} dropped
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Out-Of-Order:</span>
                    <span className="font-bold text-purple-600">
                      {steadyBandAdapter.getTelemetry().outOfOrderCount} pkts
                    </span>
                  </div>
                </>
              )}
            </div>

            {source === "band" && (
              <div className="flex gap-2">
                <button
                  onClick={() => steadyBandAdapter.connectBLE()}
                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Connect BLE Band
                </button>
                <button
                  onClick={() => steadyBandAdapter.startMockBand()}
                  className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Start Mock Band
                </button>
              </div>
            )}

            {/* VIBRATION SUPPORT STATUS */}
            {!vibration.isSupported && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{vibration.message}</span>
              </div>
            )}

            {/* SOURCE SELECTOR */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-[#172554] uppercase tracking-wider block">
                Select Sensor Source
              </span>

              <button
                onClick={() => {
                  changeSource("band");
                  setIsOpen(false);
                }}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  source === "band"
                    ? "border-blue-500 bg-blue-50/70"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold text-[#172554]">Steady Band</div>
                    <div className="text-[10px] text-slate-500">BLE or WebSocket hardware stream</div>
                  </div>
                </div>
                {source === "band" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>

              <button
                onClick={handlePhoneSelect}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  source === "phone"
                    ? "border-emerald-500 bg-emerald-50/70"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-[#172554]">Phone IMU (Wrist-Strapped)</div>
                    <div className="text-[10px] text-slate-500">DeviceMotion sensors (iOS &amp; Android)</div>
                  </div>
                </div>
                {source === "phone" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

              <button
                onClick={() => {
                  changeSource("replay");
                  setIsOpen(false);
                }}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  source === "replay"
                    ? "border-purple-500 bg-purple-50/70"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Play className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-xs font-bold text-[#172554]">Replay Recording</div>
                    <div className="text-[10px] text-slate-500">Replay of recorded CSV dataset</div>
                  </div>
                </div>
                {source === "replay" && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
