"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import {
  ArrowLeft,
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Info,
  LineChart as LineChartIcon,
  Sparkles,
  TrendingUp,
  Stethoscope,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import validationData from "@/lib/validationData.json";

import { ClinicianZoneBanner } from "@/components/ClinicianZoneBanner";

interface ScatterPoint {
  x: number;
  y: number;
}

interface ComparisonItem {
  id: string;
  title: string;
  feature_name: string;
  target_name: string;
  dataset_name: string;
  patient_count: number;
  sample_count: number;
  correlation_r: number;
  p_value: string;
  direction: "positive" | "negative";
  interpretation: string;
  scatter_points: ScatterPoint[];
}

export default function ValidationEvidencePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="max-w-md sm:max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const comparisons: ComparisonItem[] = (validationData as any).comparisons || [];

  return (
    <div className="space-y-4 pb-24 text-left">
      <ClinicianZoneBanner
        title="Validation Evidence & Analytical Biomarkers"
        subtitle="Public dataset correlation analyses (Pearson r, p-values) and V3 Framework compliance."
        backHref="/today"
      />
      <div className="max-w-md sm:max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
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
                  📊 Validation Evidence
                </h1>
                <p className="text-xs text-[#64748B]">
                  Empirical digital biomarker performance vs. gold-standard clinical severity
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#6366F1]">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </header>

      {/* OVERVIEW INTRO CARD */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0] bg-blue-50/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
            Analytical Pipeline Validation
          </h2>
        </div>
        <p className="text-xs text-[#1E3A8A] leading-relaxed">
          We tested our analysis pipeline against real Parkinson&apos;s Disease patients from public clinical datasets, comparing our extracted digital biomarker outputs to real clinician-assigned severity scores.
        </p>
      </Card>

      {/* QUICK LINKS: DATA HEALTH, PILOT MODE, REPLAY DEMO */}
      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/data-health" className="block">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-xs transition-all text-center flex flex-col items-center justify-center gap-1 min-h-[84px]">
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-[#172554]">Data Health</span>
            <span className="text-[9px] text-slate-500">Gaps &amp; Recovery</span>
          </div>
        </Link>

        <Link href="/pilot" className="block">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-xs transition-all text-center flex flex-col items-center justify-center gap-1 min-h-[84px]">
            <Stethoscope className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-bold text-[#172554]">Pilot Mode</span>
            <span className="text-[9px] text-slate-500">Planned Status</span>
          </div>
        </Link>

        <Link href="/replay-demo" className="block">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-purple-500 hover:shadow-xs transition-all text-center flex flex-col items-center justify-center gap-1 min-h-[84px]">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-bold text-[#172554]">Replay Demo</span>
            <span className="text-[9px] text-slate-500">Daphnet Stream</span>
          </div>
        </Link>
      </div>

      {/* V3 FRAMEWORK CITATION & PILOT PLANNED STATUS NOTE */}
      <Card className="space-y-3 border-amber-200 bg-amber-50/60 text-amber-950 p-4">
        <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-700 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Clinical Pilot Status: Planned
            </h3>
          </div>
          <span className="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded-full">
            Planned
          </span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">
          <strong>Analytical Validation Complete</strong> — confirming our algorithm extracts clinically meaningful signal from real patient recordings. <strong>Clinical Pilot Status</strong>: <em>Planned: protocol (<code className="bg-amber-100 px-1 rounded">/pilot/PROTOCOL.md</code>) and consent prepared (<code className="bg-amber-100 px-1 rounded">/pilot/CONSENT_FORM.md</code>)</em>.
        </p>
      </Card>

      {/* PLAIN-LANGUAGE LIMITATIONS NOTE */}
      <Card className="space-y-2 border-slate-300 bg-slate-100/80 text-slate-800 p-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-600 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Calibration &amp; Evaluation Limitations Notice
          </h3>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Calibration, selective risk trade-offs, and Brier score metrics were tested on public, unpaired clinical datasets (UCI Telemonitoring, PhysioNet Gait PD, Daphnet FoG), not on real prospective users in live longitudinal trials yet.
        </p>
      </Card>

      {/* 4 CLINICAL COMPARISON CARDS WITH RECHARTS SCATTER PLOTS */}
      <div className="space-y-6">
        {comparisons.map((item, idx) => {
          const isPos = item.direction === "positive";
          const strokeColor = isPos ? "#2563EB" : "#059669";
          const fillColor = isPos ? "#3B82F6" : "#10B981";

          return (
            <Card key={item.id} className="space-y-4 border-[0.5px] border-[#E2E8F0]">
              {/* Card Header & Dataset Badge */}
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#172554] leading-snug">
                    {idx + 1}. {item.title}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0 border border-slate-200 flex items-center gap-1">
                    <Database className="w-3 h-3 text-slate-500" />
                    <span>{item.dataset_name}</span>
                  </span>
                </div>

                <div className="text-[11px] text-[#64748B] flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-700">
                    Dataset: {item.dataset_name}, {item.patient_count} real PD patients ({item.sample_count.toLocaleString()} recordings)
                  </span>
                </div>
              </div>

              {/* Statistical Metrics Badges */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2 space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-[#64748B] block">
                    Pearson r
                  </span>
                  <span
                    className={`text-base font-extrabold block ${
                      item.correlation_r > 0 ? "text-[#2563EB]" : "text-emerald-700"
                    }`}
                  >
                    {item.correlation_r > 0 ? `+${item.correlation_r}` : item.correlation_r}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2 space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-[#64748B] block">
                    p-value
                  </span>
                  <span className="text-base font-extrabold text-[#172554] block">
                    {item.p_value}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2 space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-[#64748B] block">
                    Patient N
                  </span>
                  <span className="text-base font-extrabold text-[#172554] block">
                    N = {item.patient_count}
                  </span>
                </div>
              </div>

              {/* Recharts Scatter Plot */}
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3 pt-4 space-y-2">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 25, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name={item.feature_name}
                        unit=""
                        tick={{ fontSize: 10, fill: "#64748B" }}
                        label={{
                          value: `${item.feature_name} (STEADY Pipeline)`,
                          position: "insideBottom",
                          offset: -15,
                          fontSize: 10,
                          fontWeight: "bold",
                          fill: "#475569",
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={item.target_name}
                        unit=""
                        tick={{ fontSize: 10, fill: "#64748B" }}
                        label={{
                          value: item.target_name,
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          fontSize: 10,
                          fontWeight: "bold",
                          fill: "#475569",
                        }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#172554] text-white text-[11px] p-2 rounded-lg shadow-md border border-slate-700">
                                <div><strong>{item.feature_name}:</strong> {data.x}</div>
                                <div><strong>{item.target_name}:</strong> {data.y}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter
                        name={item.title}
                        data={item.scatter_points}
                        fill={fillColor}
                        opacity={0.7}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Clinical Interpretation Note */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-[#64748B] flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Clinical Significance:</strong> {item.interpretation}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  </div>
);
}
