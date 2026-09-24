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
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      dot: "bg-[#10B981]",
      icon: CheckCircle2,
      label: "High confidence",
      defaultReason: "Sufficient duration & steady signal baseline",
    },
    medium: {
      bg: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
      dot: "bg-[#F59E0B]",
      icon: AlertTriangle,
      label: "Moderate confidence",
      defaultReason: "Slight variation or short recording",
    },
    low: {
      bg: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
      dot: "bg-[#EF4444]",
      icon: AlertCircle,
      label: "Low confidence",
      defaultReason: "Signal noise or poor landmark visibility",
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs ${current.bg} ${className}`}
        aria-label={`${current.label}: ${displayReason}`}
      >
        <span className={`w-2 h-2 rounded-full ${current.dot}`} />
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {showText && <span>{current.label}</span>}
      </button>

      {/* Interactive Popover / Tooltip */}
      {showPopover && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-52 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-slate-700 animate-in fade-in duration-150 pointer-events-none text-left">
          <div className="font-bold flex items-center gap-1.5 mb-1 text-slate-200">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{current.label}</span>
          </div>
          <div className="text-slate-300 leading-normal">{displayReason}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
