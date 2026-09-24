"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { User, CheckSquare, Clock, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";

const TRACKING_OPTIONS = [
  { id: "tremor", label: "Tremor Frequency & Severity", desc: "Track resting and movement tremors" },
  { id: "walking", label: "Walking & Gait Cadence", desc: "Monitor step symmetry and stride speed" },
  { id: "balance", label: "Postural Balance & Stability", desc: "Evaluate stability during standing/turning" },
  { id: "slowness", label: "Bradykinesia (Slowness)", desc: "Track movement initiation times" },
  { id: "freezing", label: "Freezing of Gait (FoG)", desc: "Log hesitation episodes and triggers" },
];

const MEDICATION_TIMES = [
  "7:00 AM",
  "8:00 AM",
  "12:00 PM",
  "4:00 PM",
  "6:00 PM",
  "8:00 PM",
  "10:00 PM",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [name, setName] = useState("Sarah Miller");
  const [trackedSymptoms, setTrackedSymptoms] = useState<string[]>([
    "tremor",
    "walking",
    "freezing",
  ]);
  const [medicationTimes, setMedicationTimes] = useState<string[]>(["8:00 AM", "12:00 PM", "6:00 PM"]);

  const toggleSymptom = (id: string) => {
    if (trackedSymptoms.includes(id)) {
      setTrackedSymptoms(trackedSymptoms.filter((s) => s !== id));
    } else {
      setTrackedSymptoms([...trackedSymptoms, id]);
    }
  };

  const toggleMedTime = (time: string) => {
    if (medicationTimes.includes(time)) {
      setMedicationTimes(medicationTimes.filter((t) => t !== time));
    } else {
      setMedicationTimes([...medicationTimes, time]);
    }
  };

  const handleComplete = () => {
    const profile = {
      name: name.trim() || "Sarah Miller",
      trackedSymptoms,
      medicationTimes,
      onboardedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("movepilot_user_profile", JSON.stringify(profile));
    } catch (e) {
      console.error("Failed to save profile to localStorage", e);
    }

    router.push("/today");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-soft-gradient">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl border border-slate-100 relative">
        {/* Progress Bar Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#64748B] mb-2 uppercase tracking-wider">
            <span>Step {step} of 3</span>
            <span>
              {step === 1 && "Personal Info"}
              {step === 2 && "Symptom Tracking"}
              {step === 3 && "Medication Schedule"}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-gradient h-full transition-all duration-300 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Name */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="text-left">
              <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-[#2563EB] mb-3">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#172554]">What should we call you?</h2>
              <p className="text-sm text-[#64748B] mt-1">
                MovePilot tailors your daily movement journey around your personal baseline.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172554] mb-2 uppercase tracking-wider">
                Your Preferred Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarah Miller"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              className="bg-brand-gradient"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP 2: Symptoms to Track */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="text-left">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-[#6366F1] mb-3">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#172554]">What do you want to track?</h2>
              <p className="text-sm text-[#64748B] mt-1">
                Select the symptoms that impact your daily mobility most.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {TRACKING_OPTIONS.map((opt) => {
                const isSelected = trackedSymptoms.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleSymptom(opt.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? "bg-blue-50/70 border-[#2563EB] shadow-xs"
                        : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center mt-0.5 shrink-0 ${
                        isSelected
                          ? "bg-[#2563EB] border-[#2563EB] text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#172554]">{opt.label}</div>
                      <div className="text-xs text-[#64748B]">{opt.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
                className="w-1/3"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="w-2/3 bg-brand-gradient"
                onClick={() => setStep(3)}
                disabled={trackedSymptoms.length === 0}
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Medication Times */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="text-left">
              <div className="inline-flex p-3 rounded-2xl bg-cyan-50 text-[#06B6D4] mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#172554]">Usual Medication Times</h2>
              <p className="text-sm text-[#64748B] mt-1">
                MovePilot predicts your ON/OFF mobility windows based on when you take your doses.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172554] mb-2 uppercase tracking-wider">
                Select your usual dose times:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MEDICATION_TIMES.map((time) => {
                  const isSelected = medicationTimes.includes(time);
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => toggleMedTime(time)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        isSelected
                          ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                          : "bg-slate-50 text-[#172554] border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-xs">
              <Sparkles className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>
                MovePilot will dynamically highlight your expected optimal mobility windows each day!
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(2)}
                className="w-1/3"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="w-2/3 bg-brand-gradient"
                onClick={handleComplete}
              >
                <span>Save Profile</span>
                <Check className="w-4 h-4 ml-1 stroke-[3]" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
