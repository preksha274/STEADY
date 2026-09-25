"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  reason?: string;
  className?: string;
  showText?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  level,
  reason,
  className = "",
  showText = true,
}) => {
  const [showPopover, setShowPopover] = useState(false);

  const config = {
    high: {
      bg: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] hover:bg-[#D1FAE5]",
      dot: "bg-[#10B981]",
      icon: CheckCircle2,
      label: "High confidence",
      defaultReason: "Sufficient duration & steady signal baseline",
    },
    medium: {
      bg: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] hover:bg-[#FEF3C7]",
      dot: "bg-[#F59E0B]",
      icon: AlertTriangle,
      label: "Moderate confidence",
      defaultReason: "Slight variation or short recording session",
    },
    low: {
      bg: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] hover:bg-[#FEF3C7]",
      dot: "bg-[#F59E0B]",
      icon: AlertCircle,
      label: "Caution — low confidence",
      defaultReason: "Signal noise or brief sample window",
    },
  };

  const current = config[level] || config.high;
  const Icon = current.icon;
  const displayReason = reason || current.defaultReason;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border-[0.5px] transition-all cursor-pointer ${current.bg} ${className}`}
        aria-label={`${current.label}: ${displayReason}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${current.dot}`} />
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {showText && <span>{current.label}</span>}
      </button>

      {/* Popover / Tooltip */}
      {showPopover && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-56 p-3 bg-[#172554] text-white text-xs rounded-2xl shadow-xl border border-slate-700 animate-in fade-in duration-150 pointer-events-none text-left">
          <div className="font-semibold flex items-center gap-1.5 mb-1 text-blue-200">
            <Info className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
            <span>{current.label}</span>
          </div>
          <div className="text-slate-300 font-normal leading-normal">{displayReason}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#172554]" />
        </div>
      )}
    </div>
  );
};
