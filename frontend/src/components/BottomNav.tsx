"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  Home,
  Fingerprint,
  Activity,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsMoreSheetOpen, isMoreSheetOpen } = useAnalysis();

  const navItems = [
    { label: "Home", href: "/today", icon: Home, aliases: ["/today", "/"] },
    { label: "Fingerprint", href: "/fingerprint", icon: Fingerprint, aliases: ["/fingerprint"] },
    { label: "Coach", href: "/move", icon: Activity, aliases: ["/move"] },
    { label: "Diary", href: "/diary", icon: BookOpen, aliases: ["/diary"] },
  ];

  const isMoreActive =
    isMoreSheetOpen ||
    ["/games", "/games/session", "/games/progress", "/cue-lab", "/forecast", "/clinical-scores", "/settings"].some((p) =>
      pathname.startsWith(p)
    );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t-[0.5px] border-[#E2E8F0] shadow-sm px-3"
      aria-label="Bottom navigation"
    >
      <div className="max-w-md mx-auto h-full flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.aliases && item.aliases.includes(pathname));

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[48px] px-3.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                  : "text-[#64748B] hover:text-[#172554] hover:bg-slate-50 font-normal"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? "text-[#2563EB] stroke-[2.25]" : "text-[#64748B] stroke-[1.75]"
                }`}
              />
              <span
                className={`text-[11px] leading-none ${
                  isActive ? "text-[#2563EB] font-medium" : "text-[#64748B] font-normal"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreSheetOpen(!isMoreSheetOpen)}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] px-3.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer ${
            isMoreActive
              ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
              : "text-[#64748B] hover:text-[#172554] hover:bg-slate-50 font-normal"
          }`}
          aria-label="More navigation menu"
        >
          <MoreHorizontal
            className={`w-5 h-5 ${
              isMoreActive ? "text-[#2563EB] stroke-[2.25]" : "text-[#64748B] stroke-[1.75]"
            }`}
          />
          <span
            className={`text-[11px] leading-none ${
              isMoreActive ? "text-[#2563EB] font-medium" : "text-[#64748B] font-normal"
            }`}
          >
            More
          </span>
        </button>
      </div>
    </nav>
  );
};
