"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Info, Sparkles } from "lucide-react";
import { voiceGuide } from "@/lib/voiceGuide";

export interface TellMeMoreCardProps {
  /** Metric category badge, e.g. "Tremor", "Gait", "Bradykinesia", "Severity", "Confidence" */
  badge?: string;
  /** Icon element representing the metric */
  icon?: React.ReactNode;
  /** Primary headline in plain language (shown FIRST & LARGEST as default) */
  headline: string;
  /** Short, plain-language explanation of WHY (shown on "Tell me more" tap) */
  explanation: string;
  /** Optional secondary technical details (collapsible raw numbers) */
  technicalDetail?: string;
  /** Status color theme */
  status?: "good" | "warning" | "danger" | "info";
  /** Optional container class overrides */
  className?: string;
}

export const TellMeMoreCard: React.FC<TellMeMoreCardProps> = ({
  badge,
  icon,
  headline,
  explanation,
  technicalDetail,
  status = "good",
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const statusStyles = {
    good: {
      bg: "bg-emerald-50/60 border-emerald-200/80",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      iconBg: "bg-emerald-100 text-emerald-700",
      btnText: "text-emerald-700 hover:text-emerald-900",
    },
    warning: {
      bg: "bg-amber-50/60 border-amber-200/80",
      badge: "bg-amber-100 text-amber-900 border-amber-300",
      iconBg: "bg-amber-100 text-amber-700",
      btnText: "text-amber-800 hover:text-amber-950",
    },
    danger: {
      bg: "bg-rose-50/60 border-rose-200/80",
      badge: "bg-rose-100 text-rose-900 border-rose-300",
      iconBg: "bg-rose-100 text-rose-700",
      btnText: "text-rose-800 hover:text-rose-950",
    },
    info: {
      bg: "bg-blue-50/60 border-blue-200/80",
      badge: "bg-blue-100 text-blue-900 border-blue-300",
      iconBg: "bg-blue-100 text-blue-700",
      btnText: "text-blue-700 hover:text-blue-900",
    },
  }[status];

  const handleReadAloud = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      voiceGuide.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const textToSpeak = isExpanded ? `${headline}. ${explanation}` : headline;
      voiceGuide.speak(textToSpeak, () => setIsSpeaking(false));
    }
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl border shadow-sm transition-all text-left space-y-3 ${statusStyles.bg} ${className}`}
    >
      {/* Top Badge & Read Aloud Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && (
            <div className={`p-1.5 rounded-xl ${statusStyles.iconBg} shrink-0`}>
              {icon}
            </div>
          )}
          {badge && (
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusStyles.badge}`}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Read Aloud Button (SpeechSynthesisUtterance) */}
        <button
          type="button"
          onClick={handleReadAloud}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer min-h-[44px] sm:min-h-[36px] ${
            isSpeaking
              ? "bg-blue-600 text-white shadow-xs animate-pulse"
              : "bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-xs"
          }`}
          aria-label={isSpeaking ? "Stop reading aloud" : "Read headline aloud"}
          title="Read aloud for easy listening"
        >
          {isSpeaking ? (
            <>
              <VolumeX className="w-4 h-4 text-white" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span className="text-[11px] font-semibold">Listen</span>
            </>
          )}
        </button>
      </div>

      {/* Primary Headline (FIRST and LARGEST by default) */}
      <div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug tracking-tight">
          {headline}
        </h3>
      </div>

      {/* Tappable "Tell me more" / "What does this mean?" Target */}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer py-1 transition-all min-h-[44px] ${statusStyles.btnText}`}
          aria-expanded={isExpanded}
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>{isExpanded ? "Show less" : "What does this mean?"}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" />
          )}
        </button>

        {/* Expanded Plain-Language Explanation of WHY */}
        {isExpanded && (
          <div className="mt-2 p-3.5 bg-white/90 backdrop-blur-xs rounded-2xl border border-slate-200 shadow-sm space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-0.5">
                  Why you see this:
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {explanation}
                </p>
              </div>
            </div>

            {/* Optional Collapsible Secondary Technical Details */}
            {technicalDetail && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTechnical(!showTechnical)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition cursor-pointer py-0.5 min-h-[36px]"
                >
                  <Info className="w-3 h-3 text-slate-400" />
                  <span>{showTechnical ? "Hide technical data" : "Show raw technical data"}</span>
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
};
