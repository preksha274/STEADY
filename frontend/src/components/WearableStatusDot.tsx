"use client";

import React from "react";
import { useWearableStatus } from "@/hooks/useWearableStatus";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function WearableStatusDot({ className = "", size = "sm" }: Props) {
  const { status, isConnected, hasError } = useWearableStatus(10000);

  if (hasError || !status) {
    return null;
  }

  const sizeClass = size === "lg" ? "w-3 h-3" : size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";

  return (
    <span
      className={`inline-block rounded-full shrink-0 transition-colors ${sizeClass} ${
        isConnected ? "bg-emerald-500 shadow-xs shadow-emerald-500/50" : "bg-slate-400"
      } ${className}`}
      title={isConnected ? `Steady Band Connected (${status.port})` : "Steady Band Disconnected"}
    />
  );
}
