"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  CalendarDays,
  TrendingUp,
  BookOpen,
  Activity,
  MoreHorizontal,
  X,
  Sparkles,
  Video,
  Settings as SettingsIcon,
  Fingerprint,
  RotateCcw,
  Sun,
} from "lucide-react";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { resetDemoData, isDemoMode, setIsDemoMode } = useAnalysis();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainNavItems = [
    { label: "Today", href: "/today", icon: CalendarDays },
    { label: "Progress", href: "/progress", icon: TrendingUp },
    { label: "Diary", href: "/diary", icon: BookOpen },
    { label: "Move", href: "/move", icon: Activity },
  ];

  const moreMenuItems = [
    { label: "Day Forecast", href: "/forecast", icon: Sun, desc: "Hourly movement & ON/OFF forecast" },
    { label: "Cue Lab", href: "/cue-lab", icon: Sparkles, desc: "Rhythmic cues & pacing tools" },
    { label: "Analyze Movement", href: "/analyze", icon: Video, desc: "Pose estimation & gait analysis" },
    { label: "Fingerprint", href: "/fingerprint", icon: Fingerprint, desc: "Personal motor profile" },
    { label: "Settings", href: "/settings", icon: SettingsIcon, desc: "App & profile preferences" },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-lg px-2 sm:px-6 py-2">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-150 ${
                  isActive
                    ? "text-[#2563EB] font-bold"
                    : "text-[#64748B] hover:text-[#172554] font-medium"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                <span className="text-[11px] sm:text-xs">{item.label}</span>
              </button>
            );
          })}

          {/* More Menu Trigger */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-150 ${
              isMoreOpen || ["/forecast", "/cue-lab", "/analyze", "/fingerprint", "/settings"].includes(pathname)
                ? "text-[#2563EB] font-bold"
                : "text-[#64748B] hover:text-[#172554] font-medium"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[11px] sm:text-xs">More</span>
          </button>
        </div>
      </nav>

      {/* More Options Bottom Sheet */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-6 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-300 z-10">
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#172554]">More Tools</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-2 mb-4">
              {moreMenuItems.map((menu) => {
                const MenuIcon = menu.icon;
                return (
                  <button
                    key={menu.label}
                    onClick={() => {
                      setIsMoreOpen(false);
                      if (menu.href !== "#") {
                        router.push(menu.href);
                      }
                    }}
                    className="flex items-center gap-4 p-3.5 rounded-2xl hover:bg-slate-50 transition-colors text-left border border-transparent hover:border-slate-200"
                  >
                    <div className="p-2.5 rounded-xl bg-blue-50 text-[#2563EB]">
                      <MenuIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#172554]">{menu.label}</div>
                      <div className="text-xs text-[#64748B]">{menu.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
