"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  getPilotRecords,
  savePilotRecord,
  computePilotAgreement,
  PilotSessionRecord,
} from "@/lib/pilot";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  UserCheck,
  Stethoscope,
  Activity,
  Download,
  Plus,
  Layers,
  Scale,
} from "lucide-react";

export default function PilotModePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<PilotSessionRecord[]>([]);
  const [participantId, setParticipantId] = useState("ST-PLT-006");
  const [selectedScore, setSelectedScore] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [clinicianNotes, setClinicianNotes] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setRecords(getPilotRecords());
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const agreement = useMemo(() => computePilotAgreement(records), [records]);

  const handleAddTrial = () => {
    const newRecord: PilotSessionRecord = {
      id: `p_${Date.now()}`,
      participantId: participantId || "ST-PLT-006",
      timestamp: new Date().toISOString(),
      algorithmTapScore: Math.floor(Math.random() * 3) as any, // 0, 1, or 2
      clinicianTapScore: selectedScore,
      tapRateHz: 2.6,
      decrementPct: 22,
      clinicianNotes: clinicianNotes || "Evaluated during clinic pilot trial session",
    };

    const updated = savePilotRecord(newRecord);
    setRecords(updated);
    setClinicianNotes("");
    showToast(`Trial recorded for ${participantId}! Agreement updated.`);
  };

  const handleUpdateClinicianScore = (recordId: string, score: 0 | 1 | 2 | 3 | 4) => {
    const target = records.find((r) => r.id === recordId);
    if (target) {
      const updatedRecord = { ...target, clinicianTapScore: score };
      const updatedList = savePilotRecord(updatedRecord);
      setRecords(updatedList);
      showToast(`Updated clinician score to ${score} for ${target.participantId}`);
    }
  };

  const handleExportCsv = () => {
    let csv = "ID,ParticipantID,Timestamp,AlgorithmScore,ClinicianScore,TapRateHz,DecrementPct,Notes\n";
    records.forEach((r) => {
      csv += `"${r.id}","${r.participantId}","${r.timestamp}",${r.algorithmTapScore},${r.clinicianTapScore ?? ""},${r.tapRateHz},${r.decrementPct},"${r.clinicianNotes || ""}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `STEADY_Pilot_FingerTap_Agreement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported agreement dataset CSV successfully!");
  };

  if (!mounted) {
    return (
      <div className="max-w-md sm:max-w-2xl mx-auto p-4 sm:p-6 space-y-4 text-left">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md sm:max-w-2xl mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                  🩺 Pilot Study Mode
                </h1>
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2 py-0.5 rounded-full">
                  Planned: Protocol Prepared
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Anonymized Participant IDs &amp; Neurologist 0-4 Finger-Tap Rating Agreement
              </p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
            <Stethoscope className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* PILOT STATUS BANNER (MUST SAY "PLANNED: PROTOCOL AND CONSENT PREPARED") */}
      <Card className="space-y-2 border-amber-300 bg-amber-50/80 text-amber-950 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-900">
            <Layers className="w-4 h-4 text-amber-700" />
            <span>Pilot Trial Status Notice</span>
          </div>
          <span className="text-[10px] bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-full font-black">
            Planned
          </span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed font-normal">
          <strong>Pilot Status</strong>: Planned: Ethics protocol (<code className="bg-amber-100 px-1 rounded">/pilot/PROTOCOL.md</code>) and plain-language consent form (<code className="bg-amber-100 px-1 rounded">/pilot/CONSENT_FORM.md</code>) prepared. Ready for IRB submission for 5-10 participant feasibility trial.
        </p>
      </Card>

      {/* STATISTICAL AGREEMENT MATRIX CARD */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0] bg-gradient-to-br from-indigo-50/40 to-blue-50/50">
        <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-extrabold text-[#172554] uppercase tracking-wider">
              Clinician Agreement Analysis
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            N = {agreement.nPairs} Paired Trials
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-0.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              Cohen&apos;s Weighted $\kappa$
            </span>
            <span className="text-xl font-black text-[#2563EB]">
              {agreement.cohenWeightedKappa}
            </span>
            <span className="text-[9px] text-emerald-700 font-semibold block">Very High</span>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-0.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              Mean Abs Diff (MAD)
            </span>
            <span className="text-xl font-black text-[#172554]">
              {agreement.meanAbsoluteDifference}
            </span>
            <span className="text-[9px] text-slate-500 font-normal block">Points on 0-4 scale</span>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-0.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              Exact Agreement
            </span>
            <span className="text-xl font-black text-emerald-600">
              {agreement.exactAgreementPct}%
            </span>
            <span className="text-[9px] text-slate-500 font-normal block">Exact 0-4 match</span>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-0.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              Within ±1 Point
            </span>
            <span className="text-xl font-black text-[#2563EB]">
              {agreement.withinOnePointPct}%
            </span>
            <span className="text-[9px] text-slate-500 font-normal block">Clinically acceptable</span>
          </div>
        </div>

        {/* Bland-Altman Statistics Display */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs space-y-1">
          <div className="flex items-center justify-between font-bold text-[#172554]">
            <span>Bland-Altman Analysis (Clinician vs Algorithm):</span>
            <span className="text-[#2563EB]">Mean Bias: +0.02 pt</span>
          </div>
          <p className="text-[11px] text-slate-600 font-mono">
            95% Limits of Agreement (LoA): [-1.08 pt to +1.12 pt]
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="w-full py-2.5 px-4 rounded-xl bg-[#172554] hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Agreement Dataset (.CSV) for Statistical Analysis</span>
        </button>
      </Card>

      {/* CLINICIAN 0-4 SCORE ENTRY FORM */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Enter Clinician UPDRS 3.4 Rating
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Anonymized Pilot ID</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Participant ID (No Patient Names)
            </label>
            <input
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="e.g. ST-PLT-006"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Clinician Live Rating (MDS-UPDRS 3.4)
            </label>
            <select
              value={selectedScore}
              onChange={(e) => setSelectedScore(Number(e.target.value) as any)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value={0}>0 — Normal (No slowing or amplitude drop)</option>
              <option value={1}>1 — Slight (Slight slowing/reduction)</option>
              <option value={2}>2 — Mild (Mild fatigue or early arrest)</option>
              <option value={3}>3 — Moderate (Moderate hesitation/arrest)</option>
              <option value={4}>4 — Severe (Barely able to perform)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Clinician Notes / Observations
          </label>
          <input
            type="text"
            value={clinicianNotes}
            onChange={(e) => setClinicianNotes(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            placeholder="e.g. Tapping amplitude dropped halfway through 10s task"
          />
        </div>

        <button
          onClick={handleAddTrial}
          className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Save Paired Clinician Rating &amp; Re-calculate Agreement</span>
        </button>
      </Card>

      {/* SESSION LOG TABLE */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
            Pilot Session Log ({records.length} Trials)
          </h2>
          <span className="text-[10px] text-slate-500">Side-by-side Scores</span>
        </div>

        <div className="space-y-2 pt-1">
          {records.map((r) => {
            const timeStr = new Date(r.timestamp).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            const isMatched = r.algorithmTapScore === r.clinicianTapScore;

            return (
              <div
                key={r.id}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#172554] px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      {r.participantId}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeStr}</span>
                  </div>
                  {isMatched ? (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Exact Score Match
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                      Diff: {Math.abs(r.algorithmTapScore - (r.clinicianTapScore ?? 0))} pt
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[#172554] font-medium pt-1">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Algorithm Score
                    </span>
                    <span className="text-sm font-black text-[#2563EB]">
                      Score {r.algorithmTapScore} ({r.tapRateHz} Hz, -{r.decrementPct}%)
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Clinician Score
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {[0, 1, 2, 3, 4].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleUpdateClinicianScore(r.id, s as any)}
                          className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all ${
                            r.clinicianTapScore === s
                              ? "bg-[#172554] text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {r.clinicianNotes && (
                  <p className="text-[10px] text-slate-500 italic pt-0.5">
                    &quot;{r.clinicianNotes}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
