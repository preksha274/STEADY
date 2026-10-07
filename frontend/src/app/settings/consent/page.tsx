"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  ConsentToggles,
  CaregiverPermissions,
  ConsentLanguage,
  getConsentToggles,
  saveConsentToggles,
  getCaregiverPermissions,
  saveCaregiverPermissions,
  isLocationSharingActive,
  pauseLocationSharing,
  resumeLocationSharing,
  getCaregiverAccessLogs,
  CaregiverAccessLog,
  CONSENT_NOTICES,
  LEGAL_DISCLAIMER_TEXT,
  ETHICS_REVIEW_NOTICE,
  REVOCATION_DATA_EXPLANATION,
  isNoLocationModeActive,
} from "@/lib/consent";

import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  PauseCircle,
  PlayCircle,
  Users,
  Eye,
  FileText,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe,
} from "lucide-react";

export default function ConsentManagerPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [toggles, setToggles] = useState<ConsentToggles>(getConsentToggles());
  const [caregiverPerms, setCaregiverPerms] = useState<CaregiverPermissions>(getCaregiverPermissions());
  const [language, setLanguage] = useState<ConsentLanguage>("en");
  const [locActive, setLocActive] = useState<boolean>(false);
  const [accessLogs, setAccessLogs] = useState<CaregiverAccessLog[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setToggles(getConsentToggles());
    setCaregiverPerms(getCaregiverPermissions());
    setLocActive(isLocationSharingActive());
    setAccessLogs(getCaregiverAccessLogs());
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleToggleConsent = (key: keyof ConsentToggles) => {
    const updated = { ...toggles, [key]: !toggles[key] };
    setToggles(updated);
    saveConsentToggles(updated);
    setLocActive(isLocationSharingActive());
    showToast(`${CONSENT_NOTICES[key][language].title} updated`);
  };

  const handleToggleCaregiverPerm = (key: keyof CaregiverPermissions) => {
    const updated = { ...caregiverPerms, [key]: !caregiverPerms[key] };
    setCaregiverPerms(updated);
    saveCaregiverPermissions(updated);
    showToast(`Caregiver permission for ${key} updated`);
  };

  const handleToggleLocationPause = () => {
    if (locActive) {
      pauseLocationSharing();
      setLocActive(false);
      showToast("Location sharing paused immediately");
    } else {
      resumeLocationSharing();
      setLocActive(isLocationSharingActive());
      showToast(toggles.gpsLocation ? "Location sharing resumed" : "Enable GPS Location toggle first");
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const keys: (keyof ConsentToggles)[] = [
    "movementMonitoring",
    "voiceRecording",
    "gpsLocation",
    "caregiverSharing",
    "researchReuse",
    "cloudStorage",
  ];

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
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
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                🛡️ Granular Consent &amp; Privacy
              </h1>
              <p className="text-xs text-[#64748B]">
                Explicit consent controls &amp; patient audit logging
              </p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* LANGUAGE SELECTOR */}
      <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-2xl p-2 px-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#172554]">
          <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Notice Language:</span>
        </div>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as ConsentLanguage)}
          className="bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी (Hindi)</option>
          <option value="ta">தமிழ் (Tamil)</option>
          <option value="te">తెలుగు (Telugu)</option>
          <option value="kn">ಕನ್ನಡ (Kannada)</option>
        </select>
      </div>

      {/* LOCATION SHARING STATUS & 1-TAP PAUSE */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${locActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                Live GPS Indicator
              </h2>
              <span className={`text-xs font-extrabold ${locActive ? "text-emerald-600" : "text-slate-500"}`}>
                {locActive ? "● Active Location Sharing" : "○ Location Sharing Off / Paused"}
              </span>
            </div>
          </div>
          <Button
            onClick={handleToggleLocationPause}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
              locActive ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200" : "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
            }`}
          >
            {locActive ? (
              <>
                <PauseCircle className="w-4 h-4 text-amber-700" />
                1-Tap Pause
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 text-emerald-700" />
                Resume
              </>
            )}
          </Button>
        </div>

        {/* NO-LOCATION MODE BANNER */}
        {isNoLocationModeActive() && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">No-Location Mode Active</span>
              <span className="text-[11px]">
                Tremor monitoring, gait analysis, and cueing remain 100% operational without GPS coordinates.
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* 6 GRANULAR CONSENT TOGGLES */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
            Granular Permission Toggles (All OFF by Default)
          </h2>
          <span className="text-[10px] font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
            Explicit Opt-In
          </span>
        </div>

        <div className="space-y-4 divide-y divide-slate-100">
          {keys.map((key) => {
            const notice = CONSENT_NOTICES[key][language];
            const isOn = toggles[key];

            return (
              <div key={key} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#172554]">{notice.title}</h3>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggleConsent(key)}
                    className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isOn ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                    role="switch"
                    aria-checked={isOn}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                        isOn ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Plain-Language Notice Details */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 space-y-1">
                  <p><strong>What:</strong> {notice.what}</p>
                  <p><strong>Who:</strong> {notice.who}</p>
                  <p><strong>Why:</strong> {notice.why}</p>
                  <p><strong>Retention:</strong> {notice.howLong}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* REVOCATION DATA HANDLING EXPLANATION */}
      <Card className="space-y-2 border-[0.5px] border-[#E2E8F0] bg-slate-50">
        <div className="flex items-center gap-2 text-xs font-bold text-[#172554]">
          <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>What Happens Upon Revocation?</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {REVOCATION_DATA_EXPLANATION}
        </p>
      </Card>

      {/* ROLE-BASED CAREGIVER PERMISSIONS */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Caregiver Access Roles &amp; Permissions
            </h2>
          </div>
        </div>

        <div className="space-y-2.5">
          {[
            { key: "sosAlerts", label: "SOS Emergency Alerts", desc: "Receive immediate SOS push & location" },
            { key: "liveLocation", label: "Live Location Coordinates", desc: "View real-time map pin & accuracy" },
            { key: "locationHistory", label: "30-Day Location History", desc: "View past safe-zone travel logs" },
            { key: "symptomSummaries", label: "Symptom & Gait Summaries", desc: "View weekly tremor & cadence trends" },
            { key: "rawData", label: "Raw Sensor Recordings", desc: "Export raw 100Hz IMU CSV files" },
          ].map((item) => {
            const pKey = item.key as keyof CaregiverPermissions;
            const permOn = caregiverPerms[pKey];

            return (
              <div key={pKey} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-[#172554] block">{item.label}</span>
                  <span className="text-[10px] text-slate-500">{item.desc}</span>
                </div>
                <button
                  onClick={() => handleToggleCaregiverPerm(pKey)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    permOn ? "bg-indigo-600" : "bg-slate-300"
                  }`}
                  role="switch"
                  aria-checked={permOn}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${
                      permOn ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* PATIENT-FACING CAREGIVER ACCESS AUDIT LOG */}
      <Card className="space-y-3 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Caregiver Access Audit Log (Patient View)
            </h2>
          </div>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            {accessLogs.length} Events Logged
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {accessLogs.map((log) => (
            <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-[#172554]">{log.caregiverName} ({log.role})</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider ${
                  log.status === "granted" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {log.status === "granted" ? "Granted" : "Denied"}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>Accessed: <strong>{log.resourceAccessed}</strong></span>
                <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="text-[10px] text-slate-600 italic">Purpose: {log.purpose}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* MANDATORY LEGAL & MEDICAL DISCLAIMERS */}
      <Card className="space-y-3 border-[0.5px] border-amber-300 bg-amber-50/60">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Plain-Language Disclaimers &amp; Ethics Notice</span>
        </div>

        <p className="text-xs font-extrabold text-amber-900 leading-relaxed">
          {LEGAL_DISCLAIMER_TEXT}
        </p>

        <p className="text-[11px] text-amber-800 italic leading-relaxed">
          {ETHICS_REVIEW_NOTICE}
        </p>
      </Card>
    </div>
  );
}
