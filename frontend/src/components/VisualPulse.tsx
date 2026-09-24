"use client";

import React, { useEffect, useState } from "react";

interface VisualPulseProps {
  beatCount?: number;
  beatInBar?: number;
  isPlaying?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const VisualPulse: React.FC<VisualPulseProps> = ({
  beatCount = 0,
  beatInBar = 1,
  isPlaying = false,
  size = "md",
  className = "",
}) => {
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (beatCount > 0 && isPlaying) {
      setPulsing(true);
      const timer = setTimeout(() => {
        setPulsing(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [beatCount, isPlaying]);

  const sizeClasses = {
    sm: "w-20 h-20 text-sm",
    md: "w-36 h-36 text-lg",
    lg: "w-52 h-52 text-2xl",
  };

  const isFirstBeat = beatInBar === 1;

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer Pulse Glow Halo */}
      <div
        className={`absolute rounded-full transition-all duration-150 ease-out pointer-events-none ${
          sizeClasses[size]
        } ${
          pulsing && isPlaying
            ? isFirstBeat
              ? "scale-150 bg-cyan-400/40 blur-xl opacity-100"
              : "scale-135 bg-indigo-400/35 blur-lg opacity-90"
            : "scale-100 bg-indigo-200/20 blur-sm opacity-0"
        }`}
      />

      {/* Main Gradient Circle */}
      <div
        className={`relative z-10 rounded-full bg-brand-gradient text-white font-extrabold flex flex-col items-center justify-center shadow-xl transition-all duration-150 ease-out ${
          sizeClasses[size]
        } ${
          pulsing && isPlaying
            ? isFirstBeat
              ? "scale-110 shadow-2xl ring-4 ring-cyan-300 shadow-cyan-400/50"
              : "scale-105 shadow-xl ring-2 ring-indigo-300 shadow-indigo-400/40"
            : "scale-100 ring-1 ring-white/20"
        }`}
      >
        {isPlaying ? (
          <>
            <span className="text-3xl font-black">{beatInBar}</span>
            <span className="text-[10px] uppercase tracking-wider text-blue-100 opacity-90 mt-0.5">
              Beat {beatCount}
            </span>
          </>
        ) : (
          <span className="text-xs uppercase tracking-wider text-blue-100 opacity-80">
            Ready
          </span>
        )}
      </div>
    </div>
  );
};
