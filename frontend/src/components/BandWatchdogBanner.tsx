"use client";

import React, { useState, useEffect } from "react";
import { sensorSourceManager, ConnectionHealth } from "@/lib/sensorSource";
import { steadyBandAdapter } from "@/lib/steadyBandAdapter";
import { AlertTriangle, Battery, BatteryCharging, WifiOff } from "lucide-react";

export function BandWatchdogBanner() {
  const [health, setHealth] = useState<ConnectionHealth>({
    status: "healthy",
    pps: 100,
    lastSampleAgeMs: 0,
    actualSampleRateHz: 100,
    source: "phone",
    label: "Phone IMU",
  });

  const [batteryPct, setBatteryPct] = useState<number>(85);
  const [audioAlertPlayed, setAudioAlertPlayed] = useState(false);

  useEffect(() => {
    const unsub = sensorSourceManager.onHealth((h) => {
      setHealth(h);
      if (h.source === "band") {
        const telem = steadyBandAdapter.getTelemetry();
        setBatteryPct(telem.batteryPct);
      }
    });

    return () => unsub();
  }, []);

  const isBandActive = health.source === "band";
  const isDisconnected = isBandActive && (health.status === "disconnected" || health.lastSampleAgeMs > 5000);
  const isLowBattery = isBandActive && batteryPct < 20;

  useEffect(() => {
    if (isDisconnected && !audioAlertPlayed) {
      setAudioAlertPlayed(true);
      // Trigger phone vibration & audio tone on watchdog disconnect
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([300, 100, 300, 100, 300]);
        } catch (e) {}
      }
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (e) {}
    } else if (!isDisconnected) {
      setAudioAlertPlayed(false);
    }
  }, [isDisconnected, audioAlertPlayed]);

  if (!isBandActive && !isLowBattery) return null;

  return (
    <div className="w-full space-y-1.5 px-4 pt-2">
      {/* WATCHDOG DISCONNECT BANNER */}
      {isDisconnected && (
        <div className="bg-amber-100 border border-amber-300 text-amber-950 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Band not connected: Freeze Assist is OFF</span>
          </div>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-mono">
            {Math.round(health.lastSampleAgeMs / 1000)}s silent
          </span>
        </div>
      )}

      {/* LOW BATTERY WARNING BANNER */}
      {isLowBattery && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Low Band Battery ({batteryPct}%). Please charge Steady Band soon.</span>
          </div>
        </div>
      )}
    </div>
  );
}
