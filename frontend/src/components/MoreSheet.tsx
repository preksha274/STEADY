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
} from "lucide-react";

export const MoreSheet: React.FC = () => {
  const { isMoreSheetOpen, setIsMoreSheetOpen } = useAnalysis();
  const router = useRouter();

  if (!isMoreSheetOpen) return null;

  const menuItems = [
    {
      label: "Daily Brain & Movement",
      description: "Focus & Rhythm daily micro-games",
      href: "/games",
      icon: Brain,
      isNew: true,
      badge: "Games",
      color: "bg-purple-100 text-purple-700 border-purple-200",
    },
    {
      label: "Cue Lab",
      description: "Auditory rhythm & tempo testing",
      href: "/cue-lab",
      icon: Sliders,
      isNew: false,
      color: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      label: "Motor Forecast",
      description: "Predictive symptom & medication window",
      href: "/forecast",
      icon: TrendingUp,
      isNew: false,
      color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    },
    {
      label: "Clinical Scores",
      description: "MDS-UPDRS III digital assessment log",
      href: "/clinical-scores",
      icon: FileText,
      isNew: false,
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    {
      label: "Settings & Setup",
      description: "Mode toggles, demo data & app config",
      href: "/settings",
      icon: Settings,
      isNew: false,
      color: "bg-slate-100 text-slate-700 border-slate-200",
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

      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden p-6 z-10 animate-in slide-in-from-bottom duration-300">
        {/* Handlebar */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              More Tools & Modules
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Explore specialized modules and configuration
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

        {/* List of items */}
        <div className="space-y-3 mb-4 max-h-[60vh] overflow-y-auto pr-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => handleNavigate(item.href)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border ${item.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition">
                        {item.label}
                      </span>
                      {item.isNew && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs">
                          <Sparkles className="w-2.5 h-2.5" />
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-normal">
                      {item.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
