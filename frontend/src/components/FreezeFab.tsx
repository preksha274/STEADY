"use client";

import React from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { ShieldAlert, Zap } from "lucide-react";

export const FreezeFab: React.FC = () => {
  const { openFreezeModal } = useAnalysis();

  return (
    <div className="fixed bottom-20 right-4 sm:right-6 z-40 flex flex-col items-end gap-2">
      {/* Dev-Only Freeze Simulation Button */}
      <button
        onClick={() => openFreezeModal("auto-detected", { freezeIndex: 3.2 })}
        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-full shadow-md flex items-center gap-1.5 transition-all border border-amber-300 cursor-pointer active:scale-95"
        title="Dev Tool: Manually trigger an auto-detected freeze episode for demo purposes"
      >
        <Zap className="w-3.5 h-3.5 fill-slate-950" />
        <span>Simulate Freeze (Dev)</span>
      </button>

      {/* Manual "I'm Frozen" Floating Button */}
      <button
        onClick={() => openFreezeModal("manual")}
        className="flex items-center gap-2 px-4 py-3 bg-[#EF4444] hover:bg-red-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 border-2 border-white ring-4 ring-red-100 cursor-pointer"
        aria-label="I'm Frozen emergency assistance"
      >
        <ShieldAlert className="w-5 h-5 animate-pulse" />
        <span className="text-sm tracking-wide">I&apos;m Frozen</span>
      </button>
    </div>
  );
};
