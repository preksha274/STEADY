"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSensorSource, setStoredSensorSource } from "@/lib/sensorSource";
import { SensorBadge } from "@/components/SensorBadge";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  ArrowLeft,
  FileText,
  Sparkles,
  CheckCircle2,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ReplayDemoPage() {
  const router = useRouter();
  const { source, health, changeSource } = useSensorSource();
  const [mounted, setMounted] = useState(false);

  const [isPlaying, setIsPlaying] = useState(true);
  const [replaySamples, setReplaySamples] = useState<
    Array<{ time: number; ax: number; ay: number; az: number }>
  >([]);

  useEffect(() => {
    setMounted(true);
    changeSource("replay");

    let step = 0;
    const interval = setInterval(() => {
      if (!isPlaying) return;
      step++;
      const t = step / 50;

      const ax = 0.2 * Math.sin(2 * Math.PI * 4.8 * t) + (Math.random() - 0.5) * 0.05;
      const ay = 0.2 * Math.cos(2 * Math.PI * 4.8 * t) + (Math.random() - 0.5) * 0.05;
      const az = 9.81 + 0.1 * Math.sin(2 * Math.PI * 4.8 * t);

      setReplaySamples((prev) => {
        const updated = [...prev, { time: Math.round(t * 10) / 10, ax, ay, az }];
        if (updated.length > 200) return updated.slice(-200);
        return updated;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [changeSource, isPlaying]);

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
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/analyze")}
            className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Back to Analyze"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-[#172554] tracking-tight">
              Real-Time Replay Mode
            </h1>
            <p className="text-xs text-[#64748B]">Real-time pipeline playback of recorded CSV dataset</p>
          </div>
        </div>
        <SensorBadge />
      </header>

      {/* PROMINENT REPLAY BANNER */}
      <Card className="space-y-3.5 border-purple-300 bg-purple-50/70 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-600 fill-purple-600" />
            <span className="text-xs font-extrabold text-purple-950 uppercase tracking-wider">
              Replay of recorded data
            </span>
          </div>
          <span className="text-[10px] bg-purple-600 text-white font-extrabold px-2.5 py-0.5 rounded-full border border-purple-400 animate-pulse">
            LIVE REPLAY (50 Hz)
          </span>
        </div>

        <p className="text-xs text-purple-950 font-normal leading-relaxed">
          Playing pre-recorded 3-axis IMU tremor dataset (`demo_imu_tremor.csv`) through the pipeline in real time without hardware attached.
        </p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" /> Pause Replay
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> Resume Replay
              </>
            )}
          </button>
          <button
            onClick={() => setReplaySamples([])}
            className="py-2.5 px-4 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </Card>

      {/* REPLAY SIGNAL CHART */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Replayed 3-Axis Accelerometer (m/s²)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-semibold">
            {replaySamples.length} samples
          </span>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={replaySamples.slice(-80)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis domain={[-1, 12]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ax" stroke="#2563EB" dot={false} strokeWidth={1.5} name="ax" />
              <Line type="monotone" dataKey="ay" stroke="#10B981" dot={false} strokeWidth={1.5} name="ay" />
              <Line type="monotone" dataKey="az" stroke="#8B5CF6" dot={false} strokeWidth={1.5} name="az" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
