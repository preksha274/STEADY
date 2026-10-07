"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Activity,
  WifiOff,
  EyeOff,
  MicOff,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { MetricQualityLedger, markActionablePromptShown } from "@/lib/qualityLedger";

interface QualityLedgerBadgeProps {
  ledger: MetricQualityLedger;
  showExpandToggle?: boolean;
  className?: string;
}

export const QualityLedgerBadge: React.FC<QualityLedgerBadgeProps> = ({
  ledger,
  showExpandToggle = true,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { status, primary_issue, actionable_prompt, signal_integrity, context_validity, model_uncertainty, freshness } = ledger;

  const isReliable = status === "reliable";
  const isLowConfidence = status === "low_confidence";
  const isUnreliable = status === "no_reliable_estimate";

  const handleActionableDismiss = () => {
    markActionablePromptShown();
  };

  return (
    <div className={`space-y-2 text-left ${className}`}>
      {/* Primary Badge Display */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isReliable && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Reliable Estimate</span>
            </span>
          )}

          {isLowConfidence && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Low Confidence: {primary_issue || "Check quality"}</span>
            </span>
          )}

          {isUnreliable && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300">
              <XCircle className="w-3.5 h-3.5 text-slate-600" />
              <span>No Reliable Estimate Today</span>
            </span>
          )}
        </div>

        {showExpandToggle && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition min-h-[36px] cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>{isOpen ? "Hide Quality Ledger" : "View Quality Ledger"}</span>
          </button>
        )}
      </div>

      {/* Actionable Fix Prompt (Max 1 per session) */}
      {actionable_prompt && (isLowConfidence || isUnreliable) && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">Suggested Fix: {actionable_prompt}</span>
          </div>
          <button
            type="button"
            onClick={handleActionableDismiss}
            className="text-[10px] font-semibold text-amber-800 hover:underline shrink-0"
          >
            Got it
          </button>
        </div>
      )}

      {/* Expanded 4-Field Quality Ledger Breakdown */}
      {isOpen && (
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2.5 shadow-sm animate-in fade-in duration-150">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center justify-between">
            <span className="uppercase tracking-wider text-[10px] text-slate-500">
              Per-Modality Quality Ledger ({ledger.metric})
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              Score: {Math.round(signal_integrity.score * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Field 1: Signal Integrity */}
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">1. Signal Integrity</span>
              <div className="text-slate-600 space-y-0.5 text-[10px]">
                <div>Dropout: {signal_integrity.dropout ? "⚠️ Yes" : "Clean"}</div>
                <div>Clipping: {signal_integrity.clipping_saturation ? "⚠️ Yes" : "No"}</div>
                <div>Noise Level: {signal_integrity.noise_level}</div>
                <div>Placement Shift: {signal_integrity.placement_shift ? "⚠️ Band moved" : "Aligned"}</div>
              </div>
            </div>

            {/* Field 2: Context Validity */}
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">2. Context Validity</span>
              <div className="text-slate-600 space-y-0.5 text-[10px]">
                <div>Task Valid: {context_validity.task_valid ? "Yes" : "❌ Invalid context"}</div>
                <div>Environment: {context_validity.environment_valid ? "Valid" : "⚠️ Occluded/Noisy"}</div>
                <div>Score: {Math.round(context_validity.score * 100)}%</div>
              </div>
            </div>

            {/* Field 3: Model Uncertainty */}
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">3. Model Uncertainty</span>
              <div className="text-slate-600 space-y-0.5 text-[10px]">
                <div>Level: {model_uncertainty.uncertainty_level.toUpperCase()}</div>
                <div>Baseline Var: {model_uncertainty.baseline_variance.toFixed(2)}</div>
                <div>Epistemic Score: {model_uncertainty.epistemic_score.toFixed(2)}</div>
              </div>
            </div>

            {/* Field 4: Freshness */}
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">4. Freshness &amp; Coverage</span>
              <div className="text-slate-600 space-y-0.5 text-[10px]">
                <div>Age: {freshness.age_seconds}s ago</div>
                <div>Coverage: {freshness.coverage_minutes} mins</div>
                <div>Fresh: {freshness.is_fresh ? "Yes" : "Stale"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
