"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusDot } from "@/components/StatusDot";
import {
  AlertPriority,
  AlertType,
  DashboardPatient,
  GuardianAlert,
  GuardianDashboard,
  LinkStatus,
  LinkedPatient,
  getGuardianDashboard,
  getLinkStatus,
  getLinkedPatients,
  pairWithCode,
  resolveAlert,
  unlinkGuardian,
} from "@/lib/guardian";
import { formatCoordinates } from "@/lib/location";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Link2,
  MapPin,
  Moon,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";

function timeAgo(iso?: string | null): string {
  if (!iso) return "Never";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "Unknown";
  const mins = Math.floor((Date.now() - parsed) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ALERT_LABEL: Record<AlertType, string> = {
  SAFE_ZONE_BREACH: "Safe-zone exit",
  SAFE_ZONE_RETURN: "Safe-zone return",
  NIGHT_ACTIVITY: "Night activity",
  PROLONGED_INACTIVITY: "Prolonged inactivity",
  FREEZE_ASSIST: "Freeze assist",
  SOS: "SOS",
};

const PRIORITY_BADGE: Record<AlertPriority, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  IMPORTANT: "bg-amber-100 text-amber-700 border-amber-200",
  AWARENESS: "bg-blue-100 text-blue-700 border-blue-200",
  INFO: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function GuardianDashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [dashboard, setDashboard] = useState<GuardianDashboard | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairCode, setPairCode] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(null), 3200);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [nextStatus, nextDash, nextPatients] = await Promise.all([
      getLinkStatus(),
      getGuardianDashboard(),
      getLinkedPatients(),
    ]);
    setStatus(nextStatus);
    setDashboard(nextDash);
    setLinkedPatients(nextPatients);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handlePair = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = pairCode.trim().toUpperCase();
    if (code.length < 4) return;
    setPairBusy(true);
    const link = await pairWithCode(code);
    setPairBusy(false);
    if (link) {
      setPairCode("");
      showToast("Patient linked successfully.");
      void loadAll();
    } else {
      showToast("Could not use that code. Check it and try again.");
    }
  };

  const handleUnlink = async (linkId: string) => {
    const removed = await unlinkGuardian(linkId);
    showToast(removed ? "Link removed." : "Could not remove that link.");
    if (removed) void loadAll();
  };

  const handleResolve = async (alertId: string) => {
    const resolved = await resolveAlert(alertId, "Acknowledged in app");
    showToast(resolved ? "Alert marked as acknowledged." : "Could not update that alert.");
    if (resolved) void loadAll();
  };

  if (loading && !dashboard && !status) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const patients: DashboardPatient[] = dashboard?.patients ?? [];
  const hasPatients = patients.length > 0;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
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
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                Guardian Safety
              </h1>
              <p className="text-xs text-[#64748B]">Caregiver awareness for linked patients</p>
            </div>
          </div>
          <button
            onClick={() => void loadAll()}
            className="p-2.5 rounded-2xl bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Awareness disclaimer */}
      <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-100 border-[0.5px] border-[#E2E8F0]">
        <Bell className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
        <p className="text-[11px] leading-snug text-[#64748B]">
          Awareness only. STEADY does not contact emergency services or make medical
          determinations. Alerts show location, safe-zone and activity signals for the
          patients you are linked to.
        </p>
      </div>

      {/* Link status */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#172554]">
                {status
                  ? status.role === "guardian"
                    ? "Caregiver account"
                    : status.role === "both"
                      ? "Patient & caregiver"
                      : "Patient account"
                  : "Checking role…"}
              </div>
              <div className="text-xs text-[#64748B]">
                {linkedPatients.length} patient{linkedPatients.length === 1 ? "" : "s"} linked ·{" "}
                {(dashboard?.total_unresolved_alerts ?? 0)} unresolved alert
                {(dashboard?.total_unresolved_alerts ?? 0) === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <StatusDot
            status={hasPatients ? "success" : "warning"}
            label={hasPatients ? "Active" : "No links"}
            size="sm"
          />
        </div>
      </Card>

      {/* Pair a patient (guardian side) */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-[#2563EB]" />
          <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Link a patient
          </span>
        </div>
        <form onSubmit={handlePair} className="flex items-center gap-2">
          <input
            type="text"
            value={pairCode}
            onChange={(e) => setPairCode(e.target.value.toUpperCase())}
            placeholder="6-character code"
            maxLength={6}
            aria-label="Pairing code"
            className="flex-1 h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm uppercase tracking-[0.25em] text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
          <Button type="submit" variant="secondary" disabled={pairBusy || pairCode.trim().length < 4}>
            <Link2 className="w-4 h-4" />
            <span>{pairBusy ? "Linking…" : "Link"}</span>
          </Button>
        </form>
        <p className="text-[11px] text-[#64748B] mt-2">
          Ask the patient to generate the code under Safety &amp; Safe Zones. Codes are
          single-use and expire in a few minutes.
        </p>
      </Card>

      {/* Patient overview */}
      <div className="flex items-center justify-between pl-1">
        <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
          Linked patients
        </span>
        <span className="text-[11px] text-[#64748B]">{patients.length} shown</span>
      </div>

      {!hasPatients && (
        <Card>
          <div className="flex flex-col items-center text-center gap-2 py-4">
            <div className="p-3 rounded-2xl bg-slate-100 text-[#64748B]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-[#172554]">No patients linked yet</div>
            <p className="text-xs text-[#64748B] leading-snug">
              Enter the pairing code from a patient&apos;s device above. Once linked you will
              see their latest location, safe-zone status, activity and alerts here.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/safety")}>
              <MapPin className="w-4 h-4" />
              <span>Open patient safety setup</span>
            </Button>
          </div>
        </Card>
      )}

      {patients.map((patient) => {
        const zone = patient.safe_zone_status;
        const activity = patient.recent_activity;
        const loc = patient.latest_location;
        const night = patient.night_awareness_status;

        const zoneLabel =
          zone.zone_count === 0
            ? "No safe zones"
            : zone.inside === true
              ? "Inside safe zones"
              : zone.inside === false
                ? "Outside safe zones"
                : "Not evaluated";

        const zoneVariant =
          zone.zone_count === 0
            ? "baseline"
            : zone.inside === false
              ? "danger"
              : zone.inside === true
                ? "success"
                : "warning";

        const activityLabel =
          activity.status === "active"
            ? "Active"
            : activity.status === "quiet"
              ? "Quiet"
              : activity.status === "inactive"
                ? "Inactive"
                : "Unknown";

        const activityVariant =
          activity.status === "active"
            ? "success"
            : activity.status === "quiet"
              ? "warning"
              : activity.status === "inactive"
                ? "danger"
                : "baseline";

        return (
          <Card key={patient.patient_id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#172554] truncate">
                    {patient.patient_label}
                  </div>
                  <div className="text-[11px] text-[#64748B] font-mono truncate">
                    {formatCoordinates(loc?.latitude, loc?.longitude)}
                  </div>
                </div>
              </div>
              <StatusDot status={zoneVariant} label={zoneLabel} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-center gap-1 text-[10px] text-[#64748B] uppercase tracking-wider">
                  <Clock className="w-3 h-3" /> Last location
                </div>
                <div className="text-xs font-semibold text-[#172554] mt-0.5">
                  {timeAgo(loc?.captured_at || loc?.received_at)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-center gap-1 text-[10px] text-[#64748B] uppercase tracking-wider">
                  <Activity className="w-3 h-3" /> Activity
                </div>
                <div className="text-xs font-semibold text-[#172554] mt-0.5">
                  {activityLabel}
                  {activity.minutes_since !== null && ` · ${Math.round(activity.minutes_since)}m`}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-center gap-1 text-[10px] text-[#64748B] uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" /> Safe zones
                </div>
                <div className="text-xs font-semibold text-[#172554] mt-0.5">
                  {zone.zone_count} configured
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
                <div className="flex items-center gap-1 text-[10px] text-[#64748B] uppercase tracking-wider">
                  <Moon className="w-3 h-3" /> Night aware
                </div>
                <div className="text-xs font-semibold text-[#172554] mt-0.5">
                  {night.enabled ? "On" : "Off"}
                  {night.enabled && ` · ${night.start_time}–${night.end_time}`}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <StatusDot status={activityVariant} label={`${activityLabel} now`} size="sm" />
              <span className="text-[11px] text-[#64748B]">
                {patient.unresolved_alert_count} unresolved
              </span>
            </div>

            {/* Recent alerts */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="text-[10px] font-semibold text-[#172554] uppercase tracking-wider">
                  Recent alerts
                </span>
              </div>

              {patient.recent_alerts.length === 0 && (
                <p className="text-[11px] text-[#64748B]">No alerts yet for this patient.</p>
              )}

              {patient.recent_alerts.map((alert: GuardianAlert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-xl border-[0.5px] flex items-start justify-between gap-2 ${
                    alert.resolved
                      ? "bg-slate-50 border-slate-100 opacity-70"
                      : "bg-white border-[#E2E8F0]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          PRIORITY_BADGE[alert.priority] ?? PRIORITY_BADGE.INFO
                        }`}
                      >
                        {alert.priority}
                      </span>
                      <span className="text-xs font-semibold text-[#172554]">
                        {ALERT_LABEL[alert.type] ?? alert.type}
                      </span>
                      <span className="text-[10px] text-[#64748B]">
                        {timeAgo(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1 leading-snug">
                      {alert.message}
                    </p>
                  </div>
                  {!alert.resolved && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleResolve(alert.id)}
                      aria-label="Acknowledge alert"
                    >
                      Ack
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Manage links */}
      {linkedPatients.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-[#2563EB]" />
            <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Manage links
            </span>
          </div>
          <div className="space-y-2">
            {linkedPatients.map((link) => (
              <div
                key={link.link_id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172554] truncate">
                    {link.patient_label || link.patient_id}
                  </div>
                  <div className="text-[10px] text-[#64748B]">
                    Linked {timeAgo(link.linked_at)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleUnlink(link.link_id)}
                  aria-label="Unlink patient"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Unlink</span>
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}