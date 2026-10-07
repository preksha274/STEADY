"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Info, Volume2, VolumeX, Sparkles } from "lucide-react";
import { voiceGuide } from "@/lib/voiceGuide";

interface TechnicalDetailsExpandProps {
  /** The plain-language sentence shown FIRST and LARGEST */
  primaryText: string;
  /** Short plain-language explanation of WHY (shown when "Tell me more" is tapped) */
  explanation?: string;
  /** The technical detail shown only when explicitly expanded */
  technicalDetail?: string;
  /** Optional status color theme */
  status?: "good" | "warning" | "danger" | "info";
  /** Optional container CSS overrides */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional badge label */
  badge?: string;
}

export function TechnicalDetailsExpand({
  primaryText,
  explanation,
  technicalDetail,
  status = "info",
  className = "",
  size = "md",
  badge,
}: TechnicalDetailsExpandProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const textSizeClass =
    size === "lg"
      ? "text-lg font-bold"
      : size === "sm"
      ? "text-xs font-semibold"
      : "text-sm font-semibold";

  const handleReadAloud = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      voiceGuide.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const textToSpeak = explanation ? `${primaryText}. ${explanation}` : primaryText;
      voiceGuide.speak(textToSpeak, () => setIsSpeaking(false));
    }
  };

  const defaultExplanation =
    explanation ||
    "This summary compares your latest movement signals to your established baseline. Tap below for raw technical metrics.";

  return (
    <div className={`space-y-2 text-left ${className}`}>
      {/* Top row with optional badge & Voice Readout button */}
      <div className="flex items-center justify-between gap-2">
        {badge ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
            {badge}
          </span>
        ) : (
          <div />
        )}

        {/* Accessibility Voice Readout Button (SpeechSynthesisUtterance) */}
        <button
          type="button"
          onClick={handleReadAloud}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer min-h-[36px] ${
            isSpeaking
              ? "bg-blue-600 text-white shadow-xs animate-pulse"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
          }`}
          aria-label={isSpeaking ? "Stop reading aloud" : "Read text aloud"}
          title="Read plain language aloud"
        >
          {isSpeaking ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-white" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Listen</span>
            </>
          )}
        </button>
      </div>

      {/* Primary Plain Language Headline (FIRST and LARGEST) */}
      <div className={`${textSizeClass} text-[#172554] leading-snug tracking-tight`}>
        {primaryText}
      </div>

      {/* Tappable "What does this mean?" / "Tell me more" Target */}
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline cursor-pointer min-h-[36px] py-0.5 transition-colors"
          aria-expanded={isOpen}
          aria-label="What does this mean?"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          <span>{isOpen ? "Show less" : "What does this mean?"}</span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          )}
        </button>

        {/* Collapsible Plain Language Explanation + Technical Detail Box */}
        {isOpen && (
          <div className="mt-1.5 p-3 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 animate-in fade-in duration-150 space-y-2 shadow-xs">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Why you see this:
                </span>
                <p className="leading-relaxed text-slate-600">{defaultExplanation}</p>
              </div>
            </div>

            {technicalDetail && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTechnical(!showTechnical)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer min-h-[32px]"
                >
                  <Info className="w-3 h-3 text-slate-400" />
                  <span>{showTechnical ? "Hide raw numbers" : "Show raw numbers"}</span>
                </button>

                {showTechnical && (
                  <div className="mt-1 p-2 bg-slate-100/90 rounded-xl text-[11px] font-mono text-slate-800 border border-slate-200 leading-normal">
                    {technicalDetail}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
