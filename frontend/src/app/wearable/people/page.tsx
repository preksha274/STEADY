"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Activity,
  History,
  FileText,
  FlaskConical,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Trash2,
  Loader2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { WearableSubNav } from "@/components/WearableSubNav";
import { DISCLAIMER_TEXT, Person } from "@/config/wearableConfig";
import {
  fetchPeople,
  createPerson,
  loadSamplePerson,
  removeSamplePerson,
  fetchSamplePersonStatus,
} from "@/lib/wearableClient";

export default function WearablePeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [code, setCode] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sample person state
  const [sampleStatus, setSampleStatus] = useState<{
    exists: boolean;
    person?: Person | null;
    sessions_count?: number;
    readings_count?: number;
    alerts_count?: number;
  }>({ exists: false });
  const [sampleLoading, setSampleLoading] = useState<boolean>(false);
  const [sampleProgress, setSampleProgress] = useState<string>("");
  const [sampleSummaryMsg, setSampleSummaryMsg] = useState<string>("");
  const [showConfirmRemove, setShowConfirmRemove] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    const [list, status] = await Promise.all([
      fetchPeople(true),
      fetchSamplePersonStatus(),
    ]);
    setPeople(list);
    setSampleStatus(status);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 2 || cleanCode.length > 12) {
      setError("Code must be between 2 and 12 characters (e.g. P01, TEST02).");
      return;
    }

    const res = await createPerson(cleanCode, displayName.trim() || undefined);
    if (res.success && res.person) {
      setSuccessMsg(`Person '${res.person.code}' created successfully.`);
      setCode("");
      setDisplayName("");
      loadData();
      setTimeout(() => setSuccessMsg(""), 3500);
    } else {
      setError(res.error || "Failed to create person.");
    }
  };

  const handleLoadSample = async () => {
    setError("");
    setSuccessMsg("");
    setSampleSummaryMsg("");
    setSampleLoading(true);
    setSampleProgress("Synthesizing 90 days of 10Hz wearable readings & rule alerts (DEMO01)...");

    try {
      const res = await loadSamplePerson();
      if (res.success && res.summary) {
        setSampleSummaryMsg(
          `Sample person DEMO01 (${res.summary.person_name}) generated successfully: ${res.summary.sessions_created} sessions, ${res.summary.readings_created.toLocaleString()} readings, and ${res.summary.alerts_created} alerts over ${res.summary.days_span} days.`
        );
        await loadData();
      } else {
        setError(res.error || "Failed to load sample person.");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred while generating sample person.");
    } finally {
      setSampleLoading(false);
      setSampleProgress("");
    }
  };

  const handleRemoveSample = async () => {
    setError("");
    setSuccessMsg("");
    setSampleSummaryMsg("");
    setSampleLoading(true);
    setSampleProgress("Removing synthetic sample data (real records remain untouched)...");
    setShowConfirmRemove(false);

    try {
      const res = await removeSamplePerson();
      if (res.success && res.summary) {
        setSampleSummaryMsg(
          `Sample data removed: deleted ${res.summary.deleted_sessions} sessions, ${res.summary.deleted_readings.toLocaleString()} readings, and ${res.summary.deleted_alerts} alerts.`
        );
        await loadData();
      } else {
        setError(res.error || "Failed to remove sample person.");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred while removing sample person.");
    } finally {
      setSampleLoading(false);
      setSampleProgress("");
    }
  };

  return (
    <main className="min-h-screen bg-[#F0FDFA] text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TOP SUB-NAVIGATION */}
        <WearableSubNav
          activeTab="people"
          title="Participant Directory"
          subtitle="Manage participant identifiers for personalized baseline tracking"
          badge="People"
        />

        {/* SAMPLE PERSON DEMO BAR */}
        <section className="bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-indigo-500/10 backdrop-blur-md p-5 rounded-3xl border border-amber-300/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
                SYNTHETIC DEMO
              </span>
              <h2 className="text-sm font-bold text-slate-800">
                Sample Person Generator (90-Day Longitudinal History)
              </h2>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl">
              Generates a clearly labelled sample patient (<strong className="text-slate-800">DEMO01 &bull; Meera Nair</strong>) with 90 days of 10Hz synthetic tremor data, baseline comparison, and a clinical flare trajectory to test 7, 30, and 90-day reports instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleLoadSample}
              disabled={sampleLoading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sampleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Working...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{sampleStatus.exists ? "Reload sample person" : "Load sample person"}</span>
                </>
              )}
            </button>

            {sampleStatus.exists && (
              <button
                onClick={() => setShowConfirmRemove(true)}
                disabled={sampleLoading}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove sample person</span>
              </button>
            )}
          </div>
        </section>

        {/* PROGRESS OR FEEDBACK MESSAGES */}
        {sampleLoading && sampleProgress && (
          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-[#0F766E] shrink-0" />
            <span>{sampleProgress}</span>
          </div>
        )}

        {sampleSummaryMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sampleSummaryMsg}</span>
          </div>
        )}

        {/* CONFIRM REMOVE MODAL */}
        {showConfirmRemove && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-200 shadow-xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-800">
                  Confirm Sample Removal
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove sample person <strong className="text-slate-800">DEMO01 (Meera Nair)</strong>? This will delete only records with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-rose-700">is_sample = true</code>. Real participant data will remain untouched.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmRemove(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveSample}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Delete Sample Records</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN SECTION: FORM + TABLE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Add Person Form */}
          <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-teal-100 pb-3">
              <UserPlus className="w-4 h-4 text-[#0F766E]" />
              <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wider">
                Add Participant
              </h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Person Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. P01, SARAH_01"
                  maxLength={12}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-teal-50/40 border border-teal-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
                  required
                />
                <span className="text-[10px] text-slate-400 block">
                  Unique code (2 to 12 characters).
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Subject Alpha"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-teal-50/40 border border-teal-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 font-medium space-y-0.5">
                <span className="font-bold block">Privacy Note:</span>
                <p>Use a code instead of real names where possible. Respect participant privacy.</p>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Person</span>
              </button>
            </form>
          </div>

          {/* People List Table */}
          <div className="lg:col-span-2 bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-teal-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wider">
                  Registered People ({people.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Select a participant to view sessions, reports or baseline status
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading directory...</div>
            ) : people.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                <Users className="w-8 h-8 text-teal-400 mx-auto" />
                <div className="font-bold text-slate-700">No people registered yet</div>
                <div className="text-[11px] text-slate-400">Add a code above or load the sample person.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-teal-100 text-[#0F766E] uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Display Name</th>
                      <th className="py-2.5 px-3">Sessions</th>
                      <th className="py-2.5 px-3">Last Recorded</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {people.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-teal-50/40 transition-colors ${
                          p.is_sample ? "bg-amber-50/30" : ""
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-[#0F766E]">
                          <div className="flex items-center gap-2">
                            <span>{p.code}</span>
                            {p.is_sample && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                                SAMPLE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            <span>{p.display_name || <span className="text-slate-400 italic">None</span>}</span>
                            {p.is_sample && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                SAMPLE DATA (synthetic)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {p.session_count ?? 0}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {p.last_session_at ? (
                            new Date(p.last_session_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          ) : (
                            <span className="text-slate-400 italic">Never</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <Link
                            href={`/wearable/history?person_id=${p.id}`}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] border border-teal-200 transition-all inline-block"
                          >
                            History
                          </Link>
                          <Link
                            href={`/wearable/report?person_id=${p.id}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 transition-all inline-block"
                          >
                            Report
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="text-center text-xs text-slate-500 space-y-1 pt-4 pb-6 border-t border-teal-200">
          <p className="font-semibold text-slate-700">{DISCLAIMER_TEXT}</p>
        </footer>
      </div>
    </main>
  );
}
