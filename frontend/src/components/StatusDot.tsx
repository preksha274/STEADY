import React from "react";

export type StatusVariant =
  | "success"
  | "good"
  | "warning"
  | "moderate"
  | "variable"
  | "danger"
  | "difficult"
  | "baseline"
  | "motion"
  | "primary";

interface StatusDotProps {
  status: StatusVariant;
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig: Record<
  StatusVariant,
  { dotBg: string; textClass: string; badgeBg: string }
> = {
  success: {
    dotBg: "bg-[#10B981]",
    textClass: "text-[#065F46]",
    badgeBg: "bg-[#ECFDF5] border-[#A7F3D0]",
  },
  good: {
    dotBg: "bg-[#10B981]",
    textClass: "text-[#065F46]",
    badgeBg: "bg-[#ECFDF5] border-[#A7F3D0]",
  },
  warning: {
    dotBg: "bg-[#F59E0B]",
    textClass: "text-[#92400E]",
    badgeBg: "bg-[#FFFBEB] border-[#FDE68A]",
  },
  moderate: {
    dotBg: "bg-[#F59E0B]",
    textClass: "text-[#92400E]",
    badgeBg: "bg-[#FFFBEB] border-[#FDE68A]",
  },
  variable: {
    dotBg: "bg-[#F59E0B]",
    textClass: "text-[#92400E]",
    badgeBg: "bg-[#FFFBEB] border-[#FDE68A]",
  },
  danger: {
    dotBg: "bg-[#EF4444]",
    textClass: "text-[#991B1B]",
    badgeBg: "bg-[#FEF2F2] border-[#FECACA]",
  },
  difficult: {
    dotBg: "bg-[#EF4444]",
    textClass: "text-[#991B1B]",
    badgeBg: "bg-[#FEF2F2] border-[#FECACA]",
  },
  baseline: {
    dotBg: "bg-[#8B5CF6]",
    textClass: "text-[#5B21B6]",
    badgeBg: "bg-[#F5F3FF] border-[#DDD6FE]",
  },
  motion: {
    dotBg: "bg-[#06B6D4]",
    textClass: "text-[#155E75]",
    badgeBg: "bg-[#ECFEFF] border-[#A5F3FC]",
  },
  primary: {
    dotBg: "bg-[#2563EB]",
    textClass: "text-[#1E40AF]",
    badgeBg: "bg-[#EFF6FF] border-[#BFDBFE]",
  },
};

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  sublabel,
  size = "md",
  className = "",
}) => {
  const config = statusConfig[status] || statusConfig.good;

  const sizeClasses = {
    sm: "text-xs gap-1.5 px-2 py-0.5",
    md: "text-xs sm:text-sm gap-2 px-2.5 py-1",
    lg: "text-sm sm:text-base gap-2.5 px-3 py-1.5",
  };

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border-[0.5px] font-medium transition-colors ${config.badgeBg} ${config.textClass} ${sizeClasses[size]} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`rounded-full shrink-0 ${dotSizes[size]} ${config.dotBg}`}
      />
      <span>{label}</span>
      {sublabel && (
        <span className="text-slate-500 font-normal">({sublabel})</span>
      )}
    </span>
  );
};
