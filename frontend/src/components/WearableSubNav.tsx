"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Users,
  History,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Zap,
} from "lucide-react";

interface Props {
  activeTab: "live" | "people" | "history" | "report" | "validation";
  title: string;
  subtitle?: string;
  badge?: string;
}

export function WearableSubNav({ activeTab, title, subtitle, badge }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/today");
    }
  };

  return (
    <header className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-[#99F6E4] shadow-xs flex flex-col gap-4">
      {/* Top Bar: Back button, Title & Destination Quick Links */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 transition-all border border-teal-200 cursor-pointer shrink-0"
            title="Go back or return to dashboard"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-[#0F766E] tracking-tight">
                {title}
              </h1>
              {badge && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-[#0F766E] border border-teal-200">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Global Destination Buttons: Analyze Movement (Page B) & Main Dashboard (Page A) */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
          <Link
            href="/analyze"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 text-xs font-bold transition-all shadow-2xs"
            title="Open Movement Studio / Analyze Movement"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Analyze Movement</span>
          </Link>
          <Link
            href="/today"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs"
            title="Return to Main Steady Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Main Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Sub-page Navigation Tabs */}
      <nav className="flex items-center gap-1.5 bg-teal-50/80 p-1.5 rounded-2xl border border-teal-200 overflow-x-auto w-full">
        <Link
          href="/wearable"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === "live"
              ? "bg-[#0F766E] text-white shadow-xs"
              : "text-teal-800 hover:bg-teal-100/70"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Live</span>
        </Link>
        <Link
          href="/wearable/people"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === "people"
              ? "bg-[#0F766E] text-white shadow-xs"
              : "text-teal-800 hover:bg-teal-100/70"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>People</span>
        </Link>
        <Link
          href="/wearable/history"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === "history"
              ? "bg-[#0F766E] text-white shadow-xs"
              : "text-teal-800 hover:bg-teal-100/70"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </Link>
        <Link
          href="/wearable/report"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === "report"
              ? "bg-[#0F766E] text-white shadow-xs"
              : "text-teal-800 hover:bg-teal-100/70"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Report</span>
        </Link>
        <Link
          href="/wearable/validation"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === "validation"
              ? "bg-[#0F766E] text-white shadow-xs"
              : "text-teal-800 hover:bg-teal-100/70"
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Validation</span>
        </Link>
      </nav>
    </header>
  );
}
