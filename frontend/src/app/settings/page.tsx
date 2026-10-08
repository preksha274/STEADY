"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAnalysis } from "@/context/AnalysisContext";
import { useFreezeDetection, FOG_PROTOTYPE_DISCLAIMER } from "@/lib/freezeDetection";
import { useAmbientSampling, AMBIENT_SAMPLING_DISCLAIMER } from "@/lib/ambientSampling";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { FunctionalGoalsCard } from "@/components/FunctionalGoalsCard";
import { SensorBadge } from "@/components/SensorBadge";

import {
  User,
  Clock,
  Sliders,
  Sparkles,
  Info,
  LogOut,
  CheckCircle2,
  RotateCcw,
  Check,
  AlertTriangle,
  ArrowLeft,
  Sun,
  Eye,
  MapPin,
  Mic,
  Award,
  Activity,
  ShieldAlert,
  Zap,
} from "lucide-react";

const TRACKING_OPTIONS = [
  { id: "tremor", label: "Tremor", desc: "Resting and movement tremors" },
  { id: "walking", label: "Walking", desc: "Cadence, symmetry & stride" },
  { id: "balance", label: "Balance", desc: "Postural stability & turning" },
  { id: "slowness", label: "Slowness", desc: "Bradykinesia initiation times" },
  { id: "freezing", label: "Freezing", desc: "Hesitation episodes & cues" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { isDemoMode, setIsDemoMode, isSimpleMode, setIsSimpleMode, resetDemoData } = useAnalysis();

  // Automatic Freezing-of-Gait (FOG) Detection Hook
  const {
    isEnabled: isAutoFreezeEnabled,
    toggleEnabled: toggleAutoFreeze,
    freezeIndex,
    isFreezeDetected,
    confidence,
    sampleCount,
    sampleRateHz,
    label: freezeLabel,
  } = useFreezeDetection();

  // Passive Ambient Movement Sampling Hook
  const {
    isEnabled: isAmbientEnabled,
    toggleEnabled: toggleAmbientSampling,
  } = useAmbientSampling();

  // Profile Form State
  const [name, setName] = useState("Sarah Miller");
  const [trackedSymptoms, setTrackedSymptoms] = useState<string[]>([
    "tremor",
    "walking",
    "freezing",
  ]);
  const [medicationTime, setMedicationTime] = useState("08:00");

  // UI state
  const [mounted, setMounted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Load stored profile and preferences on mount
  useEffect(() => {
    setMounted(true);
    try {
      const storedProfile = localStorage.getItem("steady_user_profile") || localStorage.getItem("movepilot_user_profile");
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        if (parsed.name) setName(parsed.name);
        if (parsed.trackedSymptoms) setTrackedSymptoms(parsed.trackedSymptoms);
        if (parsed.medicationTimes && parsed.medicationTimes[0]) {
          setMedicationTime(parsed.medicationTimes[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load settings from localStorage", e);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const toggleSymptom = (id: string) => {
    if (trackedSymptoms.includes(id)) {
      setTrackedSymptoms(trackedSymptoms.filter((s) => s !== id));
    } else {
      setTrackedSymptoms([...trackedSymptoms, id]);
    }
  };

  const handleSaveProfile = () => {
    const existing = localStorage.getItem("steady_user_profile");
    const parsed = existing ? JSON.parse(existing) : {};

    const updatedProfile = {
      ...parsed,
      name: name.trim() || "Sarah Miller",
      trackedSymptoms,
      medicationTimes: [medicationTime],
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("steady_user_profile", JSON.stringify(updatedProfile));
      showToast("Profile settings saved");
    } catch (e) {
      console.error("Failed to save profile", e);
    }
  };

  const handleSaveMedication = () => {
    const existing = localStorage.getItem("steady_user_profile");
    const parsed = existing ? JSON.parse(existing) : {};

    const updatedProfile = {
      ...parsed,
      medicationTimes: [medicationTime],
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("steady_user_profile", JSON.stringify(updatedProfile));
      showToast("Medication schedule saved");
    } catch (e) {
      console.error("Failed to save medication time", e);
    }
  };

  const handleDisplayChange = (isSimple: boolean) => {
    setIsSimpleMode(isSimple);
    showToast(isSimple ? "Simple Mode enabled" : "Standard Mode enabled");
  };

  const handleConfirmResetDemo = () => {
    resetDemoData();
    setShowResetModal(false);
    showToast("Demo data reset to 18-day synthetic history");
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem("steady_user_profile");
      localStorage.removeItem("steady_user_session");
      localStorage.removeItem("steady_auth_token");
      localStorage.removeItem("movepilot_user_profile");
    } catch (e) {
      console.error("Failed to clear profile", e);
    }
    router.push("/login");
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4 text-left">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-[#2563EB] font-semibold flex items-center gap-1 mb-1 hover:underline cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
            Settings &amp; Preferences
          </h1>
          <p className="text-xs text-[#64748B]">Personal profile &amp; data controls</p>
        </div>
        <SensorBadge />
      </header>


      {/* SECTION: GRANULAR CONSENT & PRIVACY */}
      <Card className="space-y-3 border-[0.5px] border-indigo-200 bg-indigo-50/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#172554]">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172554]">Granular Consent &amp; Caregiver Audit</h2>
              <p className="text-[10px] text-slate-500">6 Revocable toggles, 1-tap pause, &amp; caregiver access log</p>
            </div>
          </div>
          <Link
            href="/settings/consent"
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
          >
            Manage
          </Link>
        </div>
      </Card>

      {/* SECTION 1: DISPLAY MODE PREFERENCES */}
      <Card className="space-y-3.5 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-purple-50 text-[#8B5CF6]">
            <Eye className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold">Display Mode</h2>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleDisplayChange(false)}
            className={`w-full p-3.5 rounded-2xl border-[0.5px] flex items-center justify-between cursor-pointer transition-all ${
              !isSimpleMode
                ? "bg-[#EFF6FF] border-[#2563EB]"
                : "bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-100"
            }`}
          >
            <div className="text-left">
              <div className="text-xs font-semibold text-[#172554]">Standard Mode</div>
              <div className="text-[10px] text-[#64748B]">Full multi-signal charts &amp; timeline analytics</div>
            </div>
            {!isSimpleMode && <Check className="w-4 h-4 text-[#2563EB] stroke-[3]" />}
          </button>

          <button
            type="button"
            onClick={() => {
              handleDisplayChange(true);
              router.push("/simple");
            }}
            className={`w-full p-3.5 rounded-2xl border-[0.5px] flex items-center justify-between cursor-pointer transition-all ${
              isSimpleMode
                ? "bg-[#EFF6FF] border-[#2563EB]"
                : "bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-100"
            }`}
          >
            <div className="text-left">
              <div className="text-xs font-semibold text-[#172554]">Simple Mode</div>
              <div className="text-[10px] text-[#64748B]">Oversized type &amp; high-contrast one-task prompts</div>
            </div>
            {isSimpleMode && <Check className="w-4 h-4 text-[#2563EB] stroke-[3]" />}
          </button>
        </div>
      </Card>

      {/* SECTION: AMBIENT MOVEMENT SAMPLING (BETA) */}
      <Card className="space-y-3.5 border-[0.5px] border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#172554]">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">Ambient Movement Sampling</h2>
                <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  Beta • Opt-in
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Modeled on passive wearable scoring</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAmbientEnabled}
              onChange={toggleAmbientSampling}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-normal">
          When enabled, STEADY periodically samples your phone&apos;s motion sensors in short bursts while the app is active, building a daily movement summary without requiring manual tests. Default is OFF.
        </p>

        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>{AMBIENT_SAMPLING_DISCLAIMER}</span>
        </div>
      </Card>

      {/* SECTION 2: PERSONAL FUNCTIONAL GOALS */}
      <FunctionalGoalsCard />

      {/* SECTION 2: PROFILE */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
            <User className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold">Profile Settings</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">
            Preferred Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-2 uppercase tracking-wider">
            What to Track
          </label>
          <div className="space-y-2">
            {TRACKING_OPTIONS.map((opt) => {
              const isChecked = trackedSymptoms.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleSymptom(opt.id)}
                  className={`p-3 rounded-xl border-[0.5px] cursor-pointer flex items-center justify-between transition-all ${
                    isChecked
                      ? "bg-blue-50/70 border-blue-300"
                      : "bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-100"
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-[#172554]">{opt.label}</div>
                    <div className="text-[10px] text-[#64748B]">{opt.desc}</div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isChecked
                        ? "bg-[#2563EB] border-[#2563EB] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <PrimaryButton fullWidth onClick={handleSaveProfile}>
          <span>Save Profile</span>
        </PrimaryButton>
      </Card>

      {/* SECTION 3: MEDICATION SCHEDULE */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-cyan-50 text-[#06B6D4]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold">Medication Schedule Reminders</h2>
            <p className="text-[10px] text-slate-500">User-entered times only — no automated suggestions</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-[#172554]">User-entered times only</p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Not a substitute for your prescribed schedule. STEADY only alerts you at times you explicitly enter.
          </p>
        </div>

        {/* Browser Notification Permission Warning */}
        {typeof window !== "undefined" && typeof Notification !== "undefined" && Notification.permission === "denied" && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Notification Permissions Blocked</span>
              <span className="text-[11px]">
                Browser notifications are blocked. Lock-screen medication alerts will not sound until permitted in browser settings.
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">
            Primary Morning Dose Time (User-Entered)
          </label>
          <input
            type="time"
            value={medicationTime}
            onChange={(e) => setMedicationTime(e.target.value)}
            className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]"
          />
        </div>

        <Button variant="outline" fullWidth onClick={handleSaveMedication} className="border-cyan-200 text-[#06B6D4] hover:bg-cyan-50 font-bold">
          <span>Save Schedule Time</span>
        </Button>
      </Card>

      {/* SECTION: DATA DELETION & PRIVACY ERASE */}
      <Card className="space-y-3 border-rose-200 bg-rose-50/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-950">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-950">Delete My Data &amp; Reset</h2>
              <p className="text-[10px] text-rose-700">Irreversibly erase all local sessions, logs &amp; guardian tokens</p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          fullWidth
          onClick={() => {
            if (typeof window !== "undefined" && confirm("Are you sure you want to delete all stored data, diary logs, and guardian tokens? This action cannot be undone.")) {
              localStorage.clear();
              sessionStorage.clear();
              resetDemoData();
              showToast("All user data deleted from device");
              setTimeout(() => {
                router.push("/");
              }, 1200);
            }
          }}
          className="border-rose-300 text-rose-700 hover:bg-rose-100 font-bold justify-center"
        >
          <span>Delete My Data</span>
        </Button>
      </Card>

      {/* SECTION: AUTOMATIC FREEZING-OF-GAIT (FOG) DETECTION */}
      <Card className="space-y-4 border-amber-200 bg-amber-50/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#172554]">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172554]">Automatic Freeze Detection</h2>
              <div className="text-[10px] text-[#64748B]">Bachlin Freeze Index algorithm</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              toggleAutoFreeze();
              showToast(!isAutoFreezeEnabled ? "Automatic freeze detection enabled" : "Automatic freeze detection disabled");
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isAutoFreezeEnabled ? "bg-amber-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isAutoFreezeEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-amber-950 space-y-2">
          <div className="flex items-center justify-between font-semibold">
            <span>Enable automatic freeze detection</span>
            <span className={isAutoFreezeEnabled ? "text-amber-700 font-bold" : "text-slate-400"}>
              {isAutoFreezeEnabled ? "Active" : "Off"}
            </span>
          </div>

          {/* REQUIRED PROTOTYPE DISCLAIMER LABEL */}
          <p className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-slate-100">
            {freezeLabel}
          </p>
        </div>

        {/* Live Freeze Index Monitor when enabled */}
        {isAutoFreezeEnabled && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#172554] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-500" />
                Live Bachlin Freeze Index
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isFreezeDetected ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {isFreezeDetected ? "FOG DETECTED (≥ 2.5)" : "Normal Gait"}
              </span>
            </div>

            <div className="flex items-end justify-between pt-1">
              <div>
                <div className="text-2xl font-black text-[#172554] font-mono">
                  {freezeIndex.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">Threshold: 2.5 ratio</div>
              </div>
              <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                <div>Sample Rate: <b>{sampleRateHz} Hz</b></div>
                <div>Confidence: <b>{confidence.tier.toUpperCase()} ({confidence.score}%)</b></div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* SECTION 4: CLINICIAN & EVIDENCE ZONE */}
      <Card className="space-y-3.5 border-slate-700 bg-slate-900 text-slate-100 p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Clinician &amp; Evidence Zone</h2>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-bold px-2 py-0.5 rounded-full">
                  Technical
                </span>
              </div>
              <div className="text-[10px] text-slate-300">Raw biomarker correlation metrics &amp; clinical scales</div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <Button
            onClick={() => router.push("/validation")}
            className="w-full justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold py-3 px-3.5 cursor-pointer rounded-xl transition"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" />
              <span>Validation Evidence (Pearson r &amp; V3 Framework)</span>
            </div>
            <span className="text-[10px] text-indigo-300 font-bold">View Evidence &rarr;</span>
          </Button>

          <Button
            onClick={() => router.push("/clinical-scores")}
            className="w-full justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold py-3 px-3.5 cursor-pointer rounded-xl transition"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Doctor Clinical Scores (MDS-UPDRS Log)</span>
            </div>
            <span className="text-[10px] text-indigo-300 font-bold">View Log &rarr;</span>
          </Button>

          <Button
            onClick={() => router.push("/cue-lab/prescription")}
            className="w-full justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold py-3 px-3.5 cursor-pointer rounded-xl transition"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Cue Prescription &amp; Doctor Report</span>
            </div>
            <span className="text-[10px] text-indigo-300 font-bold">Open Report &rarr;</span>
          </Button>

          <Button
            onClick={() => router.push("/analyze/reliability")}
            className="w-full justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold py-3 px-3.5 cursor-pointer rounded-xl transition"
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              <span>Test-Retest Reliability Check</span>
            </div>
            <span className="text-[10px] text-indigo-300 font-bold">Run Check &rarr;</span>
          </Button>
        </div>
      </Card>

      {/* SECTION 5: ABOUT STEADY */}
      <Card className="space-y-3 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-slate-200 text-slate-700">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">About STEADY</h2>
            <div className="text-[10px] text-[#64748B]">Version 1.0.0 (Hackathon Build)</div>
          </div>
        </div>

        <p className="text-xs text-[#64748B] leading-relaxed font-normal">
          STEADY combines phone-sensor movement data, camera-based pose analysis, and patient-reported context. It is not a diagnostic tool and does not provide clinical rating scores.
        </p>
      </Card>

      {/* SECTION 5: SIGN OUT */}
      <Button
        variant="outline"
        fullWidth
        onClick={handleSignOut}
        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 min-h-[48px]"
      >
        <LogOut className="w-4 h-4 mr-2" />
        <span>Sign Out</span>
      </Button>
    </div>
  );
}
