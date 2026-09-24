"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
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
  const { isDemoMode, setIsDemoMode, resetDemoData } = useAnalysis();

  // Profile Form State
  const [name, setName] = useState("Sarah Miller");
  const [trackedSymptoms, setTrackedSymptoms] = useState<string[]>([
    "tremor",
    "walking",
    "freezing",
  ]);
  const [medicationTime, setMedicationTime] = useState("08:00");
  const [displayMode, setDisplayMode] = useState<"standard" | "simple">("standard");

  // UI state
  const [mounted, setMounted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Load stored profile and preferences on mount
  useEffect(() => {
    setMounted(true);
    try {
      const storedProfile = localStorage.getItem("movepilot_user_profile");
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        if (parsed.name) setName(parsed.name);
        if (parsed.trackedSymptoms) setTrackedSymptoms(parsed.trackedSymptoms);
        if (parsed.medicationTimes && parsed.medicationTimes[0]) {
          setMedicationTime(parsed.medicationTimes[0]);
        }
      }

      const storedDisplay = localStorage.getItem("movepilot_display_mode");
      if (storedDisplay === "simple" || storedDisplay === "standard") {
        setDisplayMode(storedDisplay);
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
    const existing = localStorage.getItem("movepilot_user_profile");
    const parsed = existing ? JSON.parse(existing) : {};

    const updatedProfile = {
      ...parsed,
      name: name.trim() || "Sarah Miller",
      trackedSymptoms,
      medicationTimes: [medicationTime],
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("movepilot_user_profile", JSON.stringify(updatedProfile));
      showToast("Profile saved");
    } catch (e) {
      console.error("Failed to save profile", e);
    }
  };

  const handleSaveMedication = () => {
    const existing = localStorage.getItem("movepilot_user_profile");
    const parsed = existing ? JSON.parse(existing) : {};

    const updatedProfile = {
      ...parsed,
      medicationTimes: [medicationTime],
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("movepilot_user_profile", JSON.stringify(updatedProfile));
      showToast("Medication schedule saved");
    } catch (e) {
      console.error("Failed to save medication time", e);
    }
  };

  const handleDisplayChange = (mode: "standard" | "simple") => {
    setDisplayMode(mode);
    try {
      localStorage.setItem("movepilot_display_mode", mode);
      showToast("Saved");
    } catch (e) {
      console.error("Failed to save display mode", e);
    }
  };

  const handleConfirmResetDemo = () => {
    resetDemoData();
    setShowResetModal(false);
    showToast("Demo data reset to 18-day synthetic history");
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem("movepilot_user_profile");
    } catch (e) {
      console.error("Failed to clear profile", e);
    }
    router.push("/login");
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
              Settings & Profile
            </h1>
            <p className="text-xs text-[#64748B]">App preferences and personal profile</p>
          </div>
        </header>
        <Card className="animate-pulse py-12 text-center text-slate-400">
          Loading settings...
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-20">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-[#2563EB] font-semibold flex items-center gap-1 mb-1 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-[#64748B]">Personal preferences & data controls</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-slate-100 text-[#172554]">
          <Sliders className="w-6 h-6" />
        </div>
      </header>

      {/* SECTION 1: PROFILE */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
            <User className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold">Profile Settings</h2>
        </div>

        {/* Name Input */}
        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wider">
            Preferred Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* What to Track Checkboxes */}
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
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                    isChecked
                      ? "bg-blue-50/70 border-blue-300"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-[#172554]">{opt.label}</div>
                    <div className="text-[10px] text-slate-500">{opt.desc}</div>
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

        {/* Save Profile Button */}
        <Button variant="primary" fullWidth size="md" onClick={handleSaveProfile} className="bg-brand-gradient shadow-xs">
          <span>Save Profile</span>
        </Button>
      </Card>

      {/* SECTION 2: MEDICATION */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-cyan-50 text-[#06B6D4]">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold">Medication Schedule</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wider">
            Usual Medication Time
          </label>
          <input
            type="time"
            value={medicationTime}
            onChange={(e) => setMedicationTime(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-[#172554] focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Used to calculate your daily expected ON/OFF mobility windows.
          </p>
        </div>

        <Button variant="outline" fullWidth size="md" onClick={handleSaveMedication} className="border-cyan-200 text-[#06B6D4] hover:bg-cyan-50">
          <span>Save Medication Time</span>
        </Button>
      </Card>

      {/* SECTION 3: DISPLAY MODE */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-purple-50 text-[#8B5CF6]">
            <Sun className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold">Display Preferences</h2>
        </div>

        <div className="space-y-2">
          <label
            onClick={() => handleDisplayChange("standard")}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              displayMode === "standard"
                ? "bg-purple-50/70 border-purple-300"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div>
              <div className="text-xs font-bold text-[#172554]">Standard Mode</div>
              <div className="text-[10px] text-slate-500">Full detailed analytics, charts & signal graphs</div>
            </div>
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === "standard"}
              onChange={() => handleDisplayChange("standard")}
              className="w-4 h-4 text-purple-600 focus:ring-purple-500"
            />
          </label>

          <label
            onClick={() => handleDisplayChange("simple")}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              displayMode === "simple"
                ? "bg-purple-50/70 border-purple-300"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div>
              <div className="text-xs font-bold text-[#172554]">Simple Mode</div>
              <div className="text-[10px] text-slate-500">Simplified large text view (Preference saved)</div>
            </div>
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === "simple"}
              onChange={() => handleDisplayChange("simple")}
              className="w-4 h-4 text-purple-600 focus:ring-purple-500"
            />
          </label>
        </div>
      </Card>

      {/* SECTION 4: DEMO DATA */}
      <Card className="space-y-4 bg-amber-50/40 border-amber-200">
        <div className="flex items-center gap-2.5 text-amber-950">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold">Demo Data Controls</h2>
        </div>

        {/* Demo Mode Toggle Switch */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-100">
          <div>
            <div className="text-xs font-bold text-[#172554] flex items-center gap-2">
              <span>Demo Mode</span>
              <span className="text-[10px] bg-amber-100 text-[#D97706] font-bold px-2 py-0.5 rounded-full">
                {isDemoMode ? "ON" : "OFF"}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Include 18-day seeded sessions in charts and baseline calculations
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextVal = !isDemoMode;
              setIsDemoMode(nextVal);
              showToast(nextVal ? "Demo mode enabled" : "Demo mode disabled");
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              isDemoMode ? "bg-[#F59E0B]" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isDemoMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Reset Demo Data Button */}
        <Button
          variant="outline"
          fullWidth
          size="md"
          onClick={() => setShowResetModal(true)}
          className="border-amber-300 text-amber-800 hover:bg-amber-100"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          <span>Reset Demo Data</span>
        </Button>
      </Card>

      {/* SECTION 5: ABOUT */}
      <Card className="space-y-3 bg-slate-50 border-slate-200">
        <div className="flex items-center gap-2.5 text-[#172554]">
          <div className="p-2 rounded-xl bg-slate-200 text-slate-700">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">About MovePilot</h2>
            <div className="text-[10px] text-slate-500">Version 1.0.0 (Hackathon Build)</div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          MovePilot is not a diagnostic tool. Results are shown compared to your usual and are for personal tracking only.
        </p>
      </Card>

      {/* SECTION 6: SIGN OUT */}
      <Button
        variant="outline"
        fullWidth
        size="lg"
        onClick={handleSignOut}
        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
      >
        <LogOut className="w-4 h-4 mr-2" />
        <span>Sign Out</span>
      </Button>

      {/* CONFIRM RESET DEMO DIALOG MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="max-w-xs w-full bg-white space-y-4 shadow-2xl border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-800">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-amber-950">Reset Demo Data?</h3>
                <div className="text-xs text-amber-700">Restore 18-day synthetic history</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore the default 18-day synthetic motor session dataset into local storage.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowResetModal(false)}
                className="border-slate-200 text-slate-700"
              >
                <span>Cancel</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmResetDemo}
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              >
                <span>Confirm Reset</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
