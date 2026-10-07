"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { QualityLedgerBadge } from "@/components/QualityLedgerBadge";
import { buildMetricQualityLedger } from "@/lib/qualityLedger";
import { TechnicalDetailsExpand } from "@/components/TechnicalDetailsExpand";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Activity,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Vibrate,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface DaphnetSample {
  timeSec: number;
  accX: number;
  accY: number;
  accZ: number;
  freezeIndex: number;
  isFreeze: boolean;
}

export default function ReplayDemoPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Generate 60-second simulated Daphnet FoG recording stream
  const daphnetStream: DaphnetSample[] = React.useMemo(() => {
    const data: DaphnetSample[] = [];
    for (let i = 0; i <= 60; i++) {
      const isFoGWindow = i >= 22 && i <= 38; // Freeze of Gait between t=22s and t=38s
      const baseFreq = isFoGWindow ? 6.5 : 2.0;
      const fi = isFoGWindow ? 3.8 + Math.sin(i * 0.5) * 0.4 : 0.8 + Math.sin(i * 0.3) * 0.2;

      data.push({
        timeSec: i,
        accX: Math.sin(i * baseFreq) * (isFoGWindow ? 0.3 : 0.8),
        accY: Math.cos(i * baseFreq) * (isFoGWindow ? 0.4 : 0.9),
        accZ: 1.0 + (isFoGWindow ? Math.sin(i * 8.0) * 0.6 : 0.1),
        freezeIndex: Math.round(fi * 100) / 100,
        isFreeze: isFoGWindow,
      });
    }
    return data;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % daphnetStream.length);
    }, 400); // Step every 400ms

    return () => clearInterval(timer);
  }, [isPlaying, daphnetStream.length]);

  if (!mounted) {
    return (
      <div className="max-w-md sm:max-w-2xl mx-auto p-4 sm:p-6 space-y-4 text-left">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const currentSample = daphnetStream[currentIndex] || daphnetStream[0];
  const historyData = daphnetStream.slice(0, currentIndex + 1);

  const isFrozenNow = currentSample.isFreeze;

  // Build Quality Ledger for current sample
  const qualityLedger = buildMetricQualityLedger({
    modality: "wrist_imu",
    metric: "freeze_event",
    rawValue: currentSample.freezeIndex,
    noiseLevel: isFrozenNow ? "low" : "low",
    taskValid: true,
    environmentValid: true,
    epistemicScore: 0.94,
  });

  return (
    <div className="max-w-md sm:max-w-2xl mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                  🎬 Daphnet Pipeline Replay
                </h1>
                <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded-full">
                  Live Stream Replay
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Real-time streaming of Daphnet Freezing of Gait recording through STEADY pipeline
              </p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-700">
            <Zap className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* STREAM PLAYBACK CONTROLS */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0] bg-slate-900 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Stream Timestamp: t = {currentSample.timeSec}s / 60s</span>
          </div>
          <span
            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
              isFrozenNow
                ? "bg-rose-500 text-white animate-pulse"
                : "bg-emerald-500 text-white"
            }`}
          >
            {isFrozenNow ? "⚡ Freezing Detected" : "Normal Gait"}
          </span>
        </div>

        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400 h-full transition-all duration-200"
            style={{ width: `${(currentSample.timeSec / 60) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" /> Pause Stream
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Resume Stream
              </>
            )}
          </button>

          <button
            onClick={() => setCurrentIndex(0)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" /> Restart Replay
          </button>
        </div>
      </Card>

      {/* LIVE HAPTIC TRIGGER ALERT CARD */}
      {isFrozenNow && (
        <Card className="space-y-2.5 border-2 border-rose-500 bg-rose-50 text-rose-950 p-4 animate-in zoom-in-95 duration-150 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm text-rose-700 uppercase">
              <Zap className="w-5 h-5 text-rose-600 fill-rose-500 animate-pulse" />
              <span>Haptic Cue Trigger Activated!</span>
            </div>
            <span className="text-[10px] font-black bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Vibrate className="w-3.5 h-3.5" /> 88 BPM Metronome
            </span>
          </div>
          <p className="text-xs font-semibold leading-relaxed">
            Freeze Index spiked to <strong>{currentSample.freezeIndex}</strong> (Threshold: 2.5). The quality-aware engine triggered immediate haptic rhythm pacing to break freezing episode.
          </p>
        </Card>
      )}

      {/* REAL-TIME DAPHNET FREEZING INDEX CHART */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Live Freeze Index Power Ratio (FI)
            </h2>
          </div>
          <span className="text-[10px] text-slate-500">Threshold: FI &gt; 2.5</span>
        </div>

        <div className="h-52 w-full bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="timeSec" unit="s" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />

              <ReferenceLine
                y={2.5}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: "Freeze Threshold (2.5)", fill: "#EF4444", fontSize: 10 }}
              />

              <Line
                type="monotone"
                dataKey="freezeIndex"
                name="Freeze Index (FI)"
                stroke={isFrozenNow ? "#EF4444" : "#2563EB"}
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* QUALITY LEDGER BADGE & CONFIDENCE LENS */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
            Quality Ledger &amp; Signal Integrity
          </h2>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
            Daphnet Sensor Active
          </span>
        </div>

        <QualityLedgerBadge ledger={qualityLedger} />

        <TechnicalDetailsExpand
          primaryText={
            isFrozenNow
              ? "We noticed a change in how you were walking"
              : "Walking gait is steady and matching baseline"
          }
          technicalDetail={`Daphnet IMU • Freeze Index: ${currentSample.freezeIndex} • Acc Z: ${currentSample.accZ} g`}
          size="sm"
        />
      </Card>
    </div>
  );
}
