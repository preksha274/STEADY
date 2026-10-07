"use client";

import React from "react";
import Link from "next/link";
import { Stethoscope, ShieldAlert, ArrowLeft } from "lucide-react";

interface ClinicianZoneBannerProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}

export const ClinicianZoneBanner: React.FC<ClinicianZoneBannerProps> = ({
  title = "Clinician & Research Zone",
  subtitle = "Full technical detail, raw signal metrics, correlation coefficients, and clinical scales for healthcare providers.",
  backHref = "/today",
  backLabel = "Patient View",
}) => {
  return (
    <aside
      aria-label="Clinician and Research Zone Indicator"
      className="bg-slate-900 text-slate-100 border-b-2 border-indigo-500/80 px-4 py-3 sm:px-6 shadow-md"
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/30 shrink-0 mt-0.5 sm:mt-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/60">
                Evidence Mode
              </span>
              <h2 className="text-sm font-extrabold text-white tracking-tight">
                {title}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-normal max-w-xl">
              {subtitle}
            </p>
          </div>
        </div>

        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 shrink-0 min-h-[44px] sm:min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>
        )}
      </div>
    </aside>
  );
};
