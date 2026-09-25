"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAnalysis } from "@/context/AnalysisContext";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
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
        <div className="p-2.5 rounded-2xl bg-slate-100 text-[#172554]">
          <Sliders className="w-6 h-6" />
        </div>
      </header>

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

      {/* SECTION 3: MEDICATION */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-cyan-50 text-[#06B6D4]">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold">Medication Schedule</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">
            Primary Morning Dose Time
          </label>
          <input
            type="time"
            value={medicationTime}
            onChange={(e) => setMedicationTime(e.target.value)}
            className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]"
          />
        </div>

        <Button variant="outline" fullWidth onClick={handleSaveMedication} className="border-cyan-200 text-[#06B6D4] hover:bg-cyan-50">
          <span>Save Schedule Time</span>
        </Button>
      </Card>

      {/* SECTION 4: ABOUT STEADY */}
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
