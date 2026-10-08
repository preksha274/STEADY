"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Activity,
  History,
  FileText,
  FlaskConical,
  Download,
  Calendar,
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  Sliders,
} from "lucide-react";
import { WearableSubNav } from "@/components/WearableSubNav";
import { DISCLAIMER_TEXT, Person, Session } from "@/config/wearableConfig";
import {
  fetchPeople,
  fetchSessions,
  fetchPersonBaseline,
  fetchAlerts,
} from "@/lib/wearableClient";

function HistoryContent() {
  const searchParams = useSearchParams();
  const initialPersonId = searchParams.get("person_id") || "";

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>(initialPersonId);
  const [sessions, setSessions] = useState<any[]>([]);
  const [baseline, setBaseline] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);


  // 1. Initial Load: Fetch People List
  useEffect(() => {
    async function loadPeopleList() {
      const list = await fetchPeople(true);
      setPeople(list);
      if (!selectedPersonId && list.length > 0) {
        setSelectedPersonId(list[0].id);
      }
    }
    loadPeopleList();
  }, []);

  // 2. Load History Data whenever selectedPersonId changes
  useEffect(() => {
    if (!selectedPersonId) return;

    let mounted = true;
    setIsLoading(true);

    async function loadData() {
      const [sessList, baseData, alertList] = await Promise.all([
        fetchSessions(selectedPersonId, true),
        fetchPersonBaseline(selectedPersonId),
        fetchAlerts(selectedPersonId),
      ]);

      if (mounted) {
        setSessions(sessList);
        setBaseline(baseData);
        setAlerts(alertList);
        setIsLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedPersonId]);

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  // All data CSV URL
  const allDataCsvUrl = selectedPersonId
    ? `http://127.0.0.1:8000/api/people/${selectedPersonId}/export.csv${
        fromDate || toDate
          ? `?${fromDate ? `from=${fromDate}&` : ""}${toDate ? `to=${toDate}` : ""}`.replace(/&$/, "")
          : ""
      }`
    : "#";

  return (
    <main className="min-h-screen bg-[#F0FDFA] text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TOP SUB-NAVIGATION */}
        <WearableSubNav
          activeTab="history"
          title="Session History & Baselines"
          subtitle="Review recorded sessions, baseline calibration, and download full telemetry CSVs"
          badge="History"
        />

        {/* CONTROLS: PERSON SELECTOR & DATE RANGE EXPORT */}
        <section className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-[#99F6E4] shadow-xs flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="space-y-1 w-full md:w-64">
            <label className="text-xs font-bold text-slate-700 block">Select Participant</label>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {people.length === 0 ? (
                <option value="">No participants registered</option>
              ) : (
                people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.display_name ? `(${p.display_name})` : ""} {p.is_sample ? "★ [SAMPLE]" : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date Range Inputs & Download All CSV Button */}
          <div className="flex flex-wrap items-end gap-2 w-full md:w-auto">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-teal-50/50 border border-teal-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-teal-50/50 border border-teal-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
              />
            </div>

            <a
              href={allDataCsvUrl}
              download
              className="py-2 px-4 rounded-xl text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download All Data (CSV)</span>
            </a>
          </div>
        </section>

        {/* BASELINE SUMMARY CARD */}
        <section className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#0F766E]" />
              <h2 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                Personal Baseline ({selectedPerson?.code || "—"})
              </h2>
              {selectedPerson?.is_sample && (
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                  SAMPLE
                </span>
              )}
            </div>
            {baseline?.sessions_used > 0 && (
              <span className="text-[11px] text-slate-500">
                Calibrated from {baseline.sessions_used} baseline session(s)
              </span>
            )}
          </div>

          {baseline?.tremor_share !== null && baseline?.tremor_share !== undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Baseline Tremor Share
                </span>
                <span className="text-2xl font-black text-[#0F766E]">
                  {baseline.tremor_share}%
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Median resting tremor ratio
                </span>
              </div>

              <div className="bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Baseline Strength (RMS)
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {baseline.tremor_strength ?? 0} <span className="text-xs font-normal text-slate-500">g</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Median signal power
                </span>
              </div>

              <div className="bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Last Calibrated
                </span>
                <span className="text-sm font-black text-slate-700 block mt-1">
                  {baseline.recorded_at ? new Date(baseline.recorded_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Valid resting benchmark
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>No baseline yet.</strong> Record a 60-second resting baseline session on the Live page to enable change tracking.
                </span>
              </div>
              <Link
                href="/wearable"
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-[11px] shadow-xs hover:bg-amber-700 transition-all shrink-0 ml-2"
              >
                Record Now
              </Link>
            </div>
          )}
        </section>

        {/* SESSIONS TABLE */}
        <section className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-teal-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wider">
                Recorded Sessions ({sessions.length})
              </h2>
              <p className="text-xs text-slate-500">
                All sessions for {selectedPerson?.code || "selected person"}, sorted newest first
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading session history...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-1">
              <History className="w-8 h-8 text-teal-400 mx-auto" />
              <div className="font-bold text-slate-700">No data yet</div>
              <div className="text-[11px] text-slate-400">
                Start a session on the Live page to begin recording telemetry.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-teal-100 text-[#0F766E] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Label</th>
                    <th className="py-2.5 px-3">Valid Secs</th>
                    <th className="py-2.5 px-3">Tremor Share</th>
                    <th className="py-2.5 px-3">Strength (RMS)</th>
                    <th className="py-2.5 px-3">vs. Baseline</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {sessions.map((s) => {
                    const d = new Date(s.started_at);
                    const change = s.change_from_baseline;
                    return (
                      <tr key={s.id} className="hover:bg-teal-50/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {d.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                          <span className="text-slate-400 font-mono">
                            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {s.duration_s ? `${Math.round(s.duration_s)}s` : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                s.type === "baseline"
                                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                                  : "bg-teal-100 text-teal-900 border border-teal-200"
                              }`}
                            >
                              {s.type}
                            </span>
                            {s.is_sample && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                SAMPLE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 capitalize">
                          {s.label || <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {s.valid_seconds ?? 0}s
                        </td>
                        <td className="py-3 px-3 font-black text-[#0F766E]">
                          {s.tremor_share !== null ? `${s.tremor_share}%` : "—"}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {s.tremor_strength !== null ? `${s.tremor_strength}g` : "—"}
                        </td>
                        <td className="py-3 px-3">
                          {change ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                change.value > 0
                                  ? "text-amber-800 bg-amber-50"
                                  : "text-emerald-800 bg-emerald-50"
                              }`}
                            >
                              {change.formatted}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <Link
                            href={`/wearable/report?person_id=${selectedPersonId}&session_id=${s.id}`}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] border border-teal-200 transition-all inline-block"
                          >
                            Report
                          </Link>
                          <a
                            href={`http://127.0.0.1:8000/api/sessions/${s.id}/export.csv`}
                            download
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-300 transition-all inline-block"
                          >
                            CSV
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ALERTS LIST FOR PERSON */}
        <section className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#99F6E4] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0F766E]" />
              <h2 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                Telemetry Alerts ({alerts.length})
              </h2>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No alerts recorded for this participant.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-950">{a.reason}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                        {a.source}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(a.ts).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="text-center text-xs text-slate-500 space-y-1 pt-4 pb-6 border-t border-teal-200">
          <p className="font-semibold text-slate-700">{DISCLAIMER_TEXT}</p>
        </footer>
      </div>
    </main>
  );
}

export default function WearableHistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0FDFA] p-8 text-center text-xs text-slate-500">Loading history...</div>}>
      <HistoryContent />
    </Suspense>
  );
}

