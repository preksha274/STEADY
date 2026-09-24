import React from "react";
import { ConfidenceBadge, ConfidenceLevel } from "./ConfidenceBadge";

interface MetricRowProps {
  label: string;
  value: string | number;
  unit?: string;
  comparison?: string;
  confidenceLevel?: ConfidenceLevel;
  confidenceReason?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const MetricRow: React.FC<MetricRowProps> = ({
  label,
  value,
  unit,
  comparison,
  confidenceLevel = "high",
  confidenceReason,
  icon,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-[#E2E8F0] gap-2 sm:gap-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="p-2 rounded-lg bg-white border border-slate-200 text-[#2563EB]">{icon}</div>}
        <div>
          <div className="text-sm font-semibold text-[#172554]">{label}</div>
          {comparison && (
            <div className="text-xs text-[#64748B] mt-0.5">
              {comparison} <span className="italic">(compared to your usual)</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 mt-1 sm:mt-0">
        <div className="text-right">
          <span className="text-lg sm:text-xl font-bold text-[#172554]">{value}</span>
          {unit && <span className="text-xs sm:text-sm text-[#64748B] ml-1 font-medium">{unit}</span>}
        </div>
        {confidenceLevel && (
          <ConfidenceBadge level={confidenceLevel} reason={confidenceReason} />
        )}
      </div>
    </div>
  );
};
