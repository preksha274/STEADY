"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getClinicalScores,
  addClinicalScore,
  ClinicalScore,
  MDS_UPDRS_PARTS,
} from "@/lib/clinicalScores";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  Stethoscope,
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Info,
  CheckCircle2,
  TrendingUp,
  Plus,
  ShieldCheck,
  Award,
  Hash,
} from "lucide-react";

export default function ClinicalScoresPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [scores, setScores] = useState<ClinicalScore[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [selectedPart, setSelectedPart] = useState<"I" | "II" | "III" | "IV">("III");
  const [scoreVal, setScoreVal] = useState<string>("");
  const [dateRecorded, setDateRecorded] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [clinicianName, setClinicianName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setScores(getClinicalScores());
  }, []);

  const currentPartMeta = MDS_UPDRS_PARTS.find((p) => p.part === selectedPart)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numScore = parseFloat(scoreVal);
    if (isNaN(numScore) || numScore < 0) {
      setFormError("Please enter a valid non-negative score.");
      return;
    }

    if (numScore > currentPartMeta.max_score) {
      setFormError(
        `Score cannot exceed the maximum of ${currentPartMeta.max_score} for Part ${selectedPart}.`
      );
      return;
    }

    const newEntry = await addClinicalScore({
      patient_id: "default_user",
      author_user_id: "default_user",
      author_role: "patient",
      scale: "MDS-UPDRS",
      part: selectedPart,
      score: numScore,
      max_score: currentPartMeta.max_score,
      clinician_name: clinicianName.trim() || undefined,
      date_recorded: dateRecorded,
      notes: notes.trim() || undefined,
    });

    setScores(getClinicalScores());
    setScoreVal("");
    setNotes("");
    setShowForm(false);
    setToastMsg("Doctor-reported clinical score recorded.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 flex items-center justify-center">
        <div className="text-[#64748B] text-sm">Loading Clinical Scores...</div>
      </div>
    );
  }

  // Group scores by part for the raw data plot
  const partIIIScores = scores
    .filter((s) => s.part === "III")
    .sort((a, b) => new Date(a.date_recorded).getTime() - new Date(b.date_recorded).getTime());

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172554] p-4 sm:p-6 max-w-lg mx-auto space-y-5 text-left pb-24">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-[#172554] tracking-tight flex items-center gap-2">
              <span>Clinical Scores</span>
              <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full">
                Dr
              </span>
            </h1>
            <p className="text-xs text-[#64748B]">
              Doctor-Reported MDS-UPDRS Record
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition-all cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? "Cancel" : "Log Score"}</span>
        </button>
      </header>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* MANDATORY STATIC EXPLAINER DISCLAIMER */}
      <div className="p-4 bg-slate-100 border border-slate-300 rounded-2xl flex items-start gap-3 text-slate-800 text-xs shadow-xs">
        <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg shrink-0 mt-0.5">
          <Stethoscope className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <span className="font-bold text-slate-900 block">
            Doctor-Reported Assessment Record
          </span>
          <p className="leading-relaxed text-slate-700">
            Enter a score your doctor or clinician has already assessed in an appointment.
            STEADY does not administer or interpret this scale itself. This data is not factored
            into the Day Forecast or Severity readings.
          </p>
        </div>
      </div>

      {/* LOG CLINICAL SCORE FORM (Distinct Doctor's Notes Styling) */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[24px] p-5 sm:p-6 border-2 border-slate-300 shadow-md space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-slate-800 text-white rounded text-[10px] font-bold">
                Dr
              </span>
              Log a Clinician Score
            </span>
            <span className="text-[11px] text-slate-500 font-medium">MDS-UPDRS</span>
          </div>

          {/* Part Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              MDS-UPDRS Part
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MDS_UPDRS_PARTS.map((p) => {
                const isSelected = selectedPart === p.part;
                return (
                  <button
                    key={p.part}
                    type="button"
                    onClick={() => setSelectedPart(p.part as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center justify-between">
                      <span>Part {p.part}</span>
                      <span
                        className={`text-[10px] px-1 rounded ${
                          isSelected ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        Max {p.max_score}
                      </span>
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Score Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Assessed Score (0 – {currentPartMeta.max_score})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Hash className="w-5 h-5" />
              </div>
              <input
                type="number"
                step="1"
                min="0"
                max={currentPartMeta.max_score}
                required
                value={scoreVal}
                onChange={(e) => setScoreVal(e.target.value)}
                placeholder={`e.g. 28 (out of ${currentPartMeta.max_score})`}
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Date Recorded Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Assessment Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-5 h-5" />
              </div>
              <input
                type="date"
                required
                value={dateRecorded}
                onChange={(e) => setDateRecorded(e.target.value)}
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Clinician Name (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Clinician / Neurologist Name (Optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={clinicianName}
                onChange={(e) => setClinicianName(e.target.value)}
                placeholder="e.g. Dr. Aris Thorne"
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Appointment Notes (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Appointment Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mild resting tremor right arm; gait stable on current dose."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition-all"
            />
          </div>

          {formError && (
            <div className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
              {formError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer min-h-[48px]"
          >
            Save Doctor-Reported Score
          </button>
        </form>
      )}

      {/* TIME-SERIES RAW PLOT (NO INTERPRETATION) */}
      {partIIIScores.length > 1 && (
        <div className="bg-white rounded-[24px] p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-slate-700" />
              MDS-UPDRS Part III Trajectory (Raw)
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Doctor-reported values only
            </span>
          </div>

          <div className="h-28 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200 pb-2">
            {partIIIScores.map((s, idx) => {
              const pct = (s.score / s.max_score) * 100;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900">
                    {s.score}
                  </span>
                  <div
                    className="w-full max-w-[36px] bg-slate-800 rounded-t-lg transition-all"
                    style={{ height: `${Math.max(16, Math.round(pct * 0.8))}px` }}
                  />
                  <span className="text-[9px] text-slate-500 font-mono">
                    {new Date(s.date_recorded).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-500 italic text-center">
            Raw doctor-entered scores over time. No clinical interpretation or progress status is generated by STEADY.
          </p>
        </div>
      )}

      {/* RECORDED CLINICAL SCORES LIST (Doctor's Notes Style Cards) */}
      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
          Logged Assessments ({scores.length})
        </span>

        {scores.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-slate-500 text-xs space-y-2">
            <Stethoscope className="w-8 h-8 mx-auto text-slate-400" />
            <p>No doctor-reported clinical scores entered yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-[#2563EB] font-bold hover:underline"
            >
              Log an assessment score
            </button>
          </div>
        ) : (
          scores.map((score) => (
            <div
              key={score.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-300 shadow-xs space-y-2.5 text-left"
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-800 text-white rounded text-[10px] font-extrabold tracking-wide">
                    Dr
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    MDS-UPDRS Part {score.part}
                  </span>
                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                    Doctor-reported
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {score.date_recorded}
                </span>
              </div>

              {/* Score Value Callout */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {score.score}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  / {score.max_score} points
                </span>
              </div>

              {/* Clinician and Notes */}
              {score.clinician_name && (
                <div className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Assessed by {score.clinician_name}</span>
                </div>
              )}

              {score.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed">
                  &ldquo;{score.notes}&rdquo;
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
