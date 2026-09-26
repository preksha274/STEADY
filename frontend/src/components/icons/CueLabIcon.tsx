"use client";

import React from "react";
import { AudioWaveform } from "lucide-react";

interface CueLabIconProps {
  className?: string;
  isPlaying?: boolean;
  size?: number;
  color?: string;
}

/**
 * Canonical icon for Live Cue Designer / Cue Lab.
 * Single source of truth across the application.
 * Default color: Indigo #6366F1
 * Playing/active state: Brand #2563EB with animated pulse effect
 */
export const CueLabIcon: React.FC<CueLabIconProps> = ({
  className = "",
  isPlaying = false,
  size = 20,
  color,
}) => {
  const activeColorClass = isPlaying
    ? "text-[#2563EB] animate-pulse stroke-[2.25]"
    : color
    ? ""
    : "text-[#6366F1] stroke-[2]";

  return (
    <AudioWaveform
      size={size}
      style={color && !isPlaying ? { color } : undefined}
      className={`shrink-0 transition-colors duration-200 ${activeColorClass} ${className}`}
      aria-hidden="true"
    />
  );
};
