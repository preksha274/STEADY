"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Download,
  Users,
  Activity,
  History,
  FileText,
  FlaskConical,
  Gauge,
  Clock,
  Zap,
  TrendingUp,
  Info,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Filter,
  BarChart3,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  CalendarRange,
  Layers,
  Sparkles,
  Award,
} from "lucide-react";
import { WearableSubNav } from "@/components/WearableSubNav";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { DISCLAIMER_TEXT, TREMOR_RMS_G, Person, Session } from "@/config/wearableConfig";
import {
  fetchPeople,
  fetchSessions,
  fetchPersonBaseline,
  fetchSessionTimeline,
  fetchAlerts,
  fetchReportSummary,
} from "@/lib/wearableClient";

function ReportContent() {
  const searchParams = useSearchParams();
  const initialPersonId = searchParams.get("person_id") || "";
  const initialSessionId = searchParams.get("session_id") || "";

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>(initialPersonId);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId);
  const [reportRange, setReportRange] = useState<string>("7d");
  const [endingOnDate, setEndingOnDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [customFrom, setCustomFrom] = useState<string>("");

  const [sessions, setSessions] = useState<any[]>([]);
  const [baseline, setBaseline] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [multiDayReport, setMultiDayReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Load People List
  useEffect(() => {
    async function loadPeople() {
      const list = await fetchPeople(true);
      setPeople(list);
      if (!selectedPersonId && list.length > 0) {
        setSelectedPersonId(list[0].id);
      }
    }
    loadPeople();
  }, []);

  // 2. Load Sessions, Baseline & Multi-day Report when Person, Range or Ending Date Changes
  useEffect(() => {
    if (!selectedPersonId) return;
    let mounted = true;
    setIsLoading(true);

    async function loadPersonData() {
      const [sessList, baseData, summaryData] = await Promise.all([
        fetchSessions(selectedPersonId, true),
        fetchPersonBaseline(selectedPersonId),
        fetchReportSummary(
          selectedPersonId,
          reportRange,
          customFrom || undefined,
          endingOnDate || undefined
        ),
      ]);

      if (mounted) {
        setSessions(sessList);
        setBaseline(baseData);
        setMultiDayReport(summaryData);

        if (selectedSessionId) {
          const match = sessList.find((s) => s.id === selectedSessionId);
          if (!match && sessList.length > 0) {
            setSelectedSessionId(sessList[0].id);
          }
        }
        setIsLoading(false);
      }
    }

    loadPersonData();
    return () => {
      mounted = false;
    };
  }, [selectedPersonId, reportRange, endingOnDate, customFrom]);

  // 3. Load Session Detail & Timeline when Session Changes
  useEffect(() => {
    if (!selectedSessionId) {
      setSessionData(null);
      return;
    }

    let mounted = true;
    async function loadTimeline() {
      const data = await fetchSessionTimeline(selectedSessionId);
      if (mounted && data) {
        setSessionData(data);
      }
    }
    loadTimeline();
    return () => {
      mounted = false;
    };
  }, [selectedSessionId]);

  const selectedPerson = people.find((p) => p.id === selectedPersonId);
  const isSample = selectedPerson?.is_sample || multiDayReport?.is_sample || false;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  const dailyTrends = multiDayReport?.daily_trends || [];
  const weeklySummary = multiDayReport?.weekly_summary || [];
  const timeOfDayData = multiDayReport?.time_of_day || [];
  const riskIncidents = multiDayReport?.risk_incidents || [];
  const notableEvents = multiDayReport?.notable_events || { alert_days: [], highest_share_days: [] };
  const restVsActive = multiDayReport?.rest_vs_active || { rest_pct: 0, active_pct: 0 };

  return (
    <main className="min-h-screen bg-[#F0FDFA] print:bg-white text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* TOP SUB-NAVIGATION (Hidden on Print) */}
        <div className="print:hidden">
          <WearableSubNav
            activeTab="report"
            title="Telemetry Summary Report"
            subtitle="Longitudinal tremor metrics, 7-day moving averages, baseline comparisons & flare analysis"
            badge="7 / 30 / 90-Day Engine"
          />
        </div>

        {/* CONTROLS & ACTION BAR (Hidden on Print) */}
        <section className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-[#99F6E4] shadow-xs flex flex-col space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Participant</label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => {
                    setSelectedPersonId(e.target.value);
                    setSelectedSessionId("");
                  }}
                  className="bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} {p.display_name ? `(${p.display_name})` : ""} {p.is_sample ? "★ [SAMPLE]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Report Mode</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Multi-Day Period Summary (7d / 30d / 90d / Custom)</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Single Session: {new Date(s.started_at).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                      {new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {s.type} ({Math.round(s.duration_s || 0)}s)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-xs transition-all flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print or save as PDF</span>
              </button>
              {selectedSessionId ? (
                <a
                  href={`http://127.0.0.1:8000/api/sessions/${selectedSessionId}/export.csv`}
                  download
                  className="py-2 px-3.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Session CSV</span>
                </a>
              ) : (
                <a
                  href={`http://127.0.0.1:8000/api/people/${selectedPersonId}/export.csv`}
                  download
                  className="py-2 px-3.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download summary CSV</span>
                </a>
              )}
            </div>
          </div>

          {/* Time Range Filter & Ending Date for Multi-Day Reports */}
          {!selectedSessionId && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-teal-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-teal-600" />
                  <span>Period:</span>
                </span>
                <div className="inline-flex rounded-xl bg-teal-50/80 p-1 border border-teal-200 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("1d");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "1d" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("7d");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "7d" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    Last 7 days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("week");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "week" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("30d");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "30d" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("month");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "month" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("90d");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "90d" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    Last 90 days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportRange("all");
                      setCustomFrom("");
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportRange === "all" && !customFrom
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-teal-800 hover:bg-teal-100/60"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-bold">Ending on:</span>
                  <input
                    type="date"
                    value={endingOnDate}
                    onChange={(e) => setEndingOnDate(e.target.value)}
                    className="bg-teal-50/50 border border-teal-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-slate-500">
                  <span>Custom Start:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-teal-50/50 border border-teal-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* PRINTABLE REPORT DOCUMENT CONTAINER */}
        <article className="bg-white p-6 sm:p-8 rounded-3xl border border-teal-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
          
          {/* REPORT HEADER */}
          <div className="border-b-2 border-teal-600 pb-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black tracking-widest uppercase text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                    Steady Movement Telemetry
                  </span>
                  {isSample && (
                    <span className="text-xs font-black tracking-wider uppercase text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                      SAMPLE DATA (synthetic)
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    Report ID: {selectedSessionId || `REP_${selectedPerson?.code || "AGG"}_${reportRange.toUpperCase()}`}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mt-2">
                  {selectedSessionId
                    ? "Single Session Telemetry Summary"
                    : reportRange === "1d"
                    ? "Single Day Movement Telemetry Report"
                    : reportRange === "7d"
                    ? "Last 7 Days Movement Telemetry Report"
                    : reportRange === "week"
                    ? "Weekly Movement Telemetry Report"
                    : reportRange === "30d"
                    ? "Last 30 Days Movement Telemetry Report"
                    : reportRange === "month"
                    ? "Monthly Movement Telemetry Report"
                    : reportRange === "90d"
                    ? "Last 90 Days Movement Telemetry Report"
                    : "Comprehensive Multi-Day Telemetry Report"}
                </h2>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                <div>Date: {new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</div>
                <div>Time: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                {endingOnDate && <div>Period End: {endingOnDate}</div>}
              </div>
            </div>

            {/* MANDATORY COMPLIANCE & SAMPLE BANNER */}
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-teal-950 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-700 shrink-0" />
                <span>
                  <strong>Decision Support Notice:</strong> {DISCLAIMER_TEXT}
                </span>
              </div>

              {isSample && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong># SAMPLE DATA:</strong> synthetic, generated for demonstration. Not from a real patient or live band.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PARTICIPANT & SUMMARY METADATA BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-teal-50/30 border border-teal-100 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Participant Code</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-black text-slate-900 font-mono">
                  {selectedPerson?.code || "—"}
                </span>
                {selectedPerson?.is_sample && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    SAMPLE
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Pseudonym / Name</span>
              <span className="text-sm font-bold text-slate-700 block mt-0.5">
                {selectedPerson?.display_name || "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Personal Baseline</span>
              <span className="text-sm font-black text-[#0F766E] block mt-0.5">
                {baseline?.tremor_share !== null && baseline?.tremor_share !== undefined
                  ? `${baseline.tremor_share}% (${baseline.sessions_used} sessions)`
                  : "Not established"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Monitored Span</span>
              <span className="text-sm font-bold text-slate-700 block mt-0.5">
                {multiDayReport
                  ? `${multiDayReport.days_with_data || 0} days (${multiDayReport.total_monitored_minutes || 0}m)`
                  : `${sessions.length} sessions`}
              </span>
            </div>
          </div>

          {/* MODE A: SINGLE SESSION REPORT */}
          {selectedSessionId && sessionData ? (
            <div className="space-y-6">
              {/* Session Meta Highlights */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-teal-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 font-semibold">
                    Started: <strong className="text-slate-900 font-mono">{new Date(sessionData.session.started_at).toLocaleString()}</strong>
                  </span>
                  <span className="text-slate-600 font-semibold">
                    Type: <strong className="uppercase text-[#0F766E]">{sessionData.session.type}</strong>
                  </span>
                  <span className="text-slate-600 font-semibold">
                    Activity: <strong className="capitalize text-slate-900">{sessionData.session.label || "None"}</strong>
                  </span>
                </div>
                {sessionData.session.note && (
                  <div className="text-slate-500 italic">
                    Note: &ldquo;{sessionData.session.note}&rdquo;
                  </div>
                )}
              </div>

              {/* METRIC HIGHLIGHTS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Duration</span>
                  <div className="text-xl font-black text-slate-900">
                    {Math.round(sessionData.metrics.duration_s || 0)}s
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {sessionData.metrics.valid_seconds}s valid data
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Share</span>
                  <div className="text-xl font-black text-[#0F766E]">
                    {sessionData.metrics.tremor_share !== null ? `${sessionData.metrics.tremor_share}%` : "—"}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {sessionData.metrics.tremor_samples_count} tremor samples
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">vs. Baseline</span>
                  <div className="text-xl font-black">
                    {sessionData.change_from_baseline ? (
                      <span
                        className={
                          sessionData.change_from_baseline.value > 0
                            ? "text-amber-800"
                            : "text-emerald-800"
                        }
                      >
                        {sessionData.change_from_baseline.formatted}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm italic">No baseline</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Personal median benchmark
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Strength</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {sessionData.metrics.tremor_strength ?? 0}g
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Signal strength average
                  </span>
                </div>
              </div>

              {/* TIMELINE RMS CHART */}
              <div className="p-4 sm:p-5 rounded-2xl border border-teal-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Session Movement Strength (RMS) Timeline
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Threshold: {TREMOR_RMS_G} g
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sessionData.timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CCFBF1" vertical={false} />
                      <XAxis
                        dataKey="t_s"
                        stroke="#0D9488"
                        fontSize={10}
                        tickFormatter={(val) => `${val}s`}
                      />
                      <YAxis stroke="#0D9488" fontSize={10} domain={[0, "auto"]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F766E",
                          color: "#fff",
                          borderRadius: "12px",
                          border: "none",
                          fontSize: "11px",
                        }}
                        formatter={(value: any) => [`${value} g`, "RMS Strength"]}
                        labelFormatter={(label) => `Time: ${label}s`}
                      />
                      <ReferenceLine
                        y={TREMOR_RMS_G}
                        stroke="#F43F5E"
                        strokeDasharray="4 4"
                        label={{ value: "Tremor Threshold (0.04g)", fill: "#E11D48", fontSize: 9, position: "insideTopRight" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rms"
                        stroke="#0F766E"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* SESSION ALERTS TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-teal-100 pb-1.5">
                  <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                    Session Alerts ({sessionData.alerts.length})
                  </h3>
                  <span className="text-[10px] text-slate-400">Recorded during this session</span>
                </div>

                {sessionData.alerts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-teal-50/30 border border-teal-100 text-xs text-slate-500 text-center">
                    No hardware alerts or rule triggers occurred during this session.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sessionData.alerts.map((a: any) => (
                      <div
                        key={a.id}
                        className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              a.source === "band"
                                ? "bg-amber-200 text-amber-900"
                                : a.source === "rule"
                                ? "bg-indigo-200 text-indigo-900"
                                : "bg-slate-200 text-slate-800"
                            }`}
                          >
                            {a.source}
                          </span>
                          <span className="font-semibold text-slate-900">{a.reason}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(a.ts).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* MODE B: 7 / 30 / 90-DAY AGGREGATED REPORT */
            <div className="space-y-8">
              
              {/* 6 SUMMARY CARDS: Tremor Share, Tremor Strength, Rest vs Active, Monitored Minutes, Days with Data, Alerts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {/* 1. Tremor Share */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Share</span>
                  <div className="text-xl font-black text-[#0F766E]">
                    {multiDayReport?.overall_avg_tremor_share ?? 0}%
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Base: {baseline?.tremor_share !== null && baseline?.tremor_share !== undefined ? `${baseline.tremor_share}%` : "—"}
                  </span>
                </div>

                {/* 2. Tremor Strength */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Tremor Strength</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {multiDayReport?.overall_avg_tremor_strength ?? 0}g
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Avg RMS signal
                  </span>
                </div>

                {/* 3. Rest vs Active */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Rest vs Active</span>
                  <div className="text-xl font-black text-slate-900">
                    {restVsActive.rest_pct}% <span className="text-xs text-slate-400 font-normal">/ {restVsActive.active_pct}%</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Still vs active tasks
                  </span>
                </div>

                {/* 4. Monitored Minutes */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Monitored Mins</span>
                  <div className="text-xl font-black text-slate-900">
                    {multiDayReport?.total_monitored_minutes ?? 0}m
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Across {multiDayReport?.total_sessions ?? 0} sessions
                  </span>
                </div>

                {/* 5. Days with Data */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Days with Data</span>
                  <div className="text-xl font-black text-slate-900">
                    {multiDayReport?.days_with_data ?? 0} <span className="text-xs text-slate-400 font-normal">days</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Band worn coverage
                  </span>
                </div>

                {/* 6. Alerts */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Alerts</span>
                  <div className={`text-xl font-black ${(multiDayReport?.total_alerts || 0) > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                    {multiDayReport?.total_alerts ?? 0}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Rule triggers
                  </span>
                </div>
              </div>

              {/* DAILY CHART OF TREMOR SHARE WITH BASELINE (DASHED) AND 7-DAY MOVING AVERAGE */}
              <div className="p-5 rounded-2xl border border-teal-200 bg-white space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Daily Tremor Share (%) & 7-Day Moving Average vs. Baseline
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    {baseline?.tremor_share !== null && baseline?.tremor_share !== undefined && (
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                        Baseline: {baseline.tremor_share}%
                      </span>
                    )}
                    <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                      7-Day MA (Trend)
                    </span>
                  </div>
                </div>

                {dailyTrends.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No multi-day telemetry recorded within this timeframe.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="tremorFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CCFBF1" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#0D9488"
                          fontSize={10}
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            return d.toLocaleDateString([], { month: "short", day: "numeric" });
                          }}
                        />
                        <YAxis stroke="#0D9488" fontSize={10} unit="%" domain={[0, "auto"]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0F766E",
                            color: "#fff",
                            borderRadius: "12px",
                            border: "none",
                            fontSize: "11px",
                          }}
                          formatter={(val: any, name?: any) => [
                            `${val}%`,
                            name === "moving_avg_7d"
                              ? "7-Day Moving Avg"
                              : name === "avg_tremor_share"
                              ? "Daily Tremor Share"
                              : String(name || ""),
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                          formatter={(value) =>
                            value === "avg_tremor_share"
                              ? "Daily Tremor Share (%)"
                              : value === "moving_avg_7d"
                              ? "7-Day Moving Average"
                              : value
                          }
                        />
                        {baseline?.tremor_share !== null && baseline?.tremor_share !== undefined && (
                          <ReferenceLine
                            y={baseline.tremor_share}
                            stroke="#E11D48"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                              value: `Baseline (${baseline.tremor_share}%)`,
                              fill: "#BE123C",
                              fontSize: 9,
                              position: "insideTopRight",
                            }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="avg_tremor_share"
                          name="avg_tremor_share"
                          stroke="#0F766E"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#tremorFill)"
                          dot={{ r: 3, fill: "#0F766E" }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="moving_avg_7d"
                          name="moving_avg_7d"
                          stroke="#6366F1"
                          strokeWidth={2.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 italic">
                  Teal points: daily computed tremor share. Purple line: 7-day smoothing filter. Red dashed line: personal benchmark.
                </p>
              </div>

              {/* MONITORED MINUTES PER DAY BAR CHART (Coverage / Gaps) */}
              <div className="p-5 rounded-2xl border border-teal-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Daily Monitored Duration (Minutes) & Coverage Tracking
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Low or empty bars represent unworn / low-coverage days
                  </span>
                </div>

                {dailyTrends.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No data</div>
                ) : (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CCFBF1" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#0D9488"
                          fontSize={9}
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            return d.toLocaleDateString([], { month: "numeric", day: "numeric" });
                          }}
                        />
                        <YAxis stroke="#0D9488" fontSize={9} unit="m" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0F766E",
                            color: "#fff",
                            borderRadius: "10px",
                            border: "none",
                            fontSize: "10px",
                          }}
                          formatter={(val: any) => [`${val} mins`, "Monitored Duration"]}
                        />
                        <Bar dataKey="monitored_minutes" fill="#14B8A6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* WEEKLY SUMMARY TABLE (Especially for 90 Days Report) */}
              {weeklySummary.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-teal-200 pb-1.5">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="w-4 h-4 text-[#0F766E]" />
                      <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                        Weekly Progression Summary (90-Day Longitudinal Trajectory)
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {weeklySummary.length} weekly blocks analyzed
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-teal-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-teal-50/80 text-[#0F766E] uppercase tracking-wider text-[10px] border-b border-teal-200">
                          <th className="py-2.5 px-3">Week</th>
                          <th className="py-2.5 px-3">Date Span</th>
                          <th className="py-2.5 px-3">Sessions</th>
                          <th className="py-2.5 px-3">Monitored Duration</th>
                          <th className="py-2.5 px-3">Tremor Share (%)</th>
                          <th className="py-2.5 px-3">Change vs Baseline</th>
                          <th className="py-2.5 px-3">Alerts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-teal-100 bg-white">
                        {weeklySummary.map((w: any) => (
                          <tr key={w.week_label} className="hover:bg-teal-50/40">
                            <td className="py-2.5 px-3 font-bold text-[#0F766E] whitespace-nowrap">
                              {w.week_label}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {w.start_date} &rarr; {w.end_date}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-semibold">
                              {w.sessions_count}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {w.monitored_minutes} mins
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {w.avg_tremor_share}%
                            </td>
                            <td className="py-2.5 px-3">
                              {w.baseline_delta !== null ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    w.baseline_delta > 15
                                      ? "bg-rose-100 text-rose-800"
                                      : w.baseline_delta > 5
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-emerald-100 text-emerald-900"
                                  }`}
                                >
                                  {w.baseline_delta > 0 ? `+${w.baseline_delta}%` : `${w.baseline_delta}%`}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {w.alert_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* NOTABLE EVENTS: ALERT DAYS & HIGHEST-SHARE DAYS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Notable Alert Days */}
                <div className="p-5 rounded-2xl border border-teal-200 bg-white space-y-3">
                  <div className="flex items-center gap-2 border-b border-teal-100 pb-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Notable Alert Days ({notableEvents.alert_days?.length || 0})
                    </h3>
                  </div>

                  {!notableEvents.alert_days || notableEvents.alert_days.length === 0 ? (
                    <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-800">
                      No alert days recorded in this window.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notableEvents.alert_days.slice(0, 6).map((ad: any) => (
                        <div
                          key={ad.date}
                          className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{ad.date}</span>
                            <span className="text-[10px] text-slate-500">{ad.note}</span>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 block">
                              {ad.alert_count} alerts
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              {ad.avg_tremor_share}% share
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Highest Tremor Share Days */}
                <div className="p-5 rounded-2xl border border-teal-200 bg-white space-y-3">
                  <div className="flex items-center gap-2 border-b border-teal-100 pb-2">
                    <Award className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Highest Tremor Share Days
                    </h3>
                  </div>

                  {!notableEvents.highest_share_days || notableEvents.highest_share_days.length === 0 ? (
                    <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-slate-500">
                      No daily records found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notableEvents.highest_share_days.slice(0, 6).map((hd: any, idx: number) => (
                        <div
                          key={hd.date}
                          className="p-2.5 rounded-xl bg-teal-50/40 border border-teal-100 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-teal-200 text-[#0F766E] font-bold text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block">{hd.date}</span>
                              <span className="text-[10px] text-slate-500">
                                {hd.monitored_minutes}m monitored &bull; {hd.alert_count} alerts
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-[#0F766E] block">
                              {hd.avg_tremor_share}%
                            </span>
                            <span className="text-[9px] uppercase font-bold text-slate-400">
                              Peak {hd.peak_tremor_share}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* DEDICATED RISK & ALERT INCIDENTS TABLE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Elevated Risk Episodes & Alert Incidents ({riskIncidents.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Detailed log with dates, exact timestamps, and clinical trigger notes
                  </span>
                </div>

                {riskIncidents.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No elevated risk episodes or alerts detected during this reporting period.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-teal-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-teal-50/80 text-[#0F766E] uppercase tracking-wider text-[10px] border-b border-teal-200">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Exact Time</th>
                          <th className="py-2.5 px-3">Incident Type</th>
                          <th className="py-2.5 px-3">Severity</th>
                          <th className="py-2.5 px-3">Duration</th>
                          <th className="py-2.5 px-3">Tremor Metric</th>
                          <th className="py-2.5 px-3">Trigger Reason / Observations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-teal-100 bg-white">
                        {riskIncidents.map((inc: any) => (
                          <tr key={inc.id} className="hover:bg-teal-50/40 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                              {new Date(inc.ts).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                              {new Date(inc.ts).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {inc.type}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  inc.severity === "High"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : inc.severity === "Elevated"
                                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                                    : "bg-teal-100 text-teal-900 border border-teal-200"
                                }`}
                              >
                                {inc.severity}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-mono">
                              {inc.duration_seconds ? `${Math.round(inc.duration_seconds)}s` : "—"}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {inc.tremor_share !== null && inc.tremor_share !== undefined ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-[#0F766E]">{inc.tremor_share}%</span>
                                  {inc.baseline_delta !== null && (
                                    <span className="text-[10px] text-amber-700 block font-semibold">
                                      ({inc.baseline_delta > 0 ? `+${inc.baseline_delta}%` : `${inc.baseline_delta}%`} vs base)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <div className="font-medium text-[11px] text-slate-900">{inc.reason}</div>
                              {inc.tremor_strength && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  RMS: {inc.tremor_strength}g @ {inc.dominant_frequency || "—"} Hz ({inc.label})
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* REPORT FOOTER WITH DISCLAIMER & SAMPLE NOTICE */}
          <div className="border-t border-teal-200 pt-4 text-center text-xs text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-700">{DISCLAIMER_TEXT}</p>
            {isSample && (
              <p className="text-amber-800 font-bold bg-amber-50 py-1 px-3 rounded-lg border border-amber-200 inline-block">
                SAMPLE DATA: synthetic, generated for demonstration
              </p>
            )}
            <p className="text-[10px] text-slate-400">
              Generated by Steady Movement Telemetry System &bull; Decision Support Engine &bull; SQLite Storage
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}

export default function WearableReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0FDFA] p-8 text-center text-xs text-slate-500">Loading telemetry report...</div>}>
      <ReportContent />
    </Suspense>
  );
}
