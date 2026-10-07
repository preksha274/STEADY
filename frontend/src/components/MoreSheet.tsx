"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  Brain,
  Sliders,
  TrendingUp,
  FileText,
  Settings,
  X,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  MapPin,
  Award,
  Stethoscope,
  Activity,
  Calendar,
} from "lucide-react";

export const MoreSheet: React.FC = () => {
  const { isMoreSheetOpen, setIsMoreSheetOpen } = useAnalysis();
  const router = useRouter();

  if (!isMoreSheetOpen) return null;

  const patientTools = [
    {
      label: "Daily Brain & Movement",
      description: "Focus & Rhythm daily micro-games",
      href: "/games",
      icon: Brain,
      color: "bg-purple-100 text-purple-700 border-purple-200",
    },
    {
      label: "Cue Lab Pacing",
      description: "Auditory rhythm & tempo calibration",
      href: "/cue-lab",
      icon: Sliders,
      color: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      label: "Motor Forecast",
      description: "Predictive symptom & medication window",
      href: "/forecast",
      icon: TrendingUp,
      color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    },
    {
      label: "Safety & Safe Zones",
      description: "Pairing, SOS, location sharing & safe zones",
      href: "/safety",
      icon: MapPin,
      color: "bg-sky-100 text-sky-700 border-sky-200",
    },
    {
      label: "Settings & Preferences",
      description: "App configuration, audio cues & profile",
      href: "/settings",
      icon: Settings,
      color: "bg-slate-100 text-slate-700 border-slate-200",
    },
  ];

  const clinicianTools = [
    {
      label: "Validation Evidence",
      description: "Dataset correlations (Pearson r, p-values) & V3 compliance",
      href: "/validation",
      icon: Award,
      badge: "Clinical Research",
      color: "bg-slate-800 text-indigo-300 border-slate-700",
    },
    {
      label: "Clinical Scores (MDS-UPDRS)",
      description: "Doctor-assessed clinical rating scale logs",
      href: "/clinical-scores",
      icon: FileText,
      badge: "Doctor Log",
      color: "bg-slate-800 text-indigo-300 border-slate-700",
    },
    {
      label: "Cue Prescription Report",
      description: "Printable pacing report & freeze detection breakdown",
      href: "/cue-lab/prescription",
      icon: Stethoscope,
      badge: "Clinician Report",
      color: "bg-slate-800 text-indigo-300 border-slate-700",
    },
  ];

  const handleNavigate = (href: string) => {
    setIsMoreSheetOpen(false);
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div
        className="absolute inset-0"
        onClick={() => setIsMoreSheetOpen(false)}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden p-5 z-10 animate-in slide-in-from-bottom duration-300">
        {/* Handlebar */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              All Modules & Tools
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Separated into Patient Tools and Clinician Evidence
            </p>
          </div>
          <button
            onClick={() => setIsMoreSheetOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable container */}
        <div className="space-y-5 mb-2 max-h-[65vh] overflow-y-auto pr-1">
          {/* SECTION 1: PATIENT ZONE */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              <span>Patient Tools</span>
            </div>
            {patientTools.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavigate(item.href)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all text-left group min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${item.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition block">
                        {item.label}
                      </span>
                      <p className="text-xs text-slate-500 font-normal line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              );
            })}
          </div>

          {/* SECTION 2: CLINICIAN & EVIDENCE ZONE */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                Clinician & Evidence Zone
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Technical Data
              </span>
            </div>
            {clinicianTools.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavigate(item.href)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all text-left group min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-slate-900 text-indigo-300 border-slate-800 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition">
                          {item.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-normal line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
