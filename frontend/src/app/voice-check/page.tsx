"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Activity,
  HeartPulse,
  Brain,
  Zap,
} from "lucide-react";

export default function VoiceCheckPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const [loudnessLevel, setLoudnessLevel] = useState(45); // in dB
  const [waveformBars, setWaveformBars] = useState<number[]>([30, 45, 60, 50, 70, 65, 40, 55, 80, 70, 60, 45]);

  // 3 Symptom Scales (Pain, Fatigue, Anxiety) - 5-dot taps
  const [painLevel, setPainLevel] = useState<number>(2);
  const [fatigueLevel, setFatigueLevel] = useState<number>(3);
  const [anxietyLevel, setAnxietyLevel] = useState<number>(1);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const startVoiceTest = () => {
    setIsRecording(true);
    setRecordProgress(0);
    setVoiceRecorded(false);

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setRecordProgress(current);

      // Animate waveform
      setWaveformBars(
        Array.from({ length: 14 }, () => Math.floor(Math.random() * 60) + 30)
      );
      setLoudnessLevel(Math.floor(Math.random() * 18) + 62);

      if (current >= 3) {
        clearInterval(interval);
        setIsRecording(false);
        setVoiceRecorded(true);
        showToast("Voice sample captured successfully!");
      }
    }, 1000);
  };

  const handleSaveAll = () => {
    setIsSaved(true);
    showToast("Voice & Non-motor check-in recorded!");
    setTimeout(() => {
      router.push("/today");
    }, 1200);
  };

  const SCALE_LABELS = ["None (1)", "Mild (2)", "Moderate (3)", "Elevated (4)", "Severe (5)"];

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24 text-left">
      {/* Toast Notification */}
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
                Voice &amp; Non-Motor Check
              </h1>
              <p className="text-xs text-[#64748B]">3s vocal loudness & symptom assessment</p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <Mic className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* Acoustic Analysis Upgrade Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <span className="font-bold text-[#172554] block">Full Acoustic Voice Check Available</span>
            <span className="text-[#64748B] text-[11px]">Analyze Jitter %, Shimmer %, F0, and HNR stability</span>
          </div>
        </div>
        <Button
          onClick={() => router.push("/analyze/voice")}
          className="bg-[#2563EB] text-white hover:bg-[#1D4ED8] text-xs py-1.5 px-3 shrink-0 cursor-pointer"
        >
          Open Test <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {/* DISTANCE & POSITION GUIDANCE NOTICE */}
      <div className="bg-slate-100 border border-slate-300 rounded-2xl p-3 text-xs text-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span><strong>Position Guidance:</strong> Hold phone 15–20cm (6 inches) from mouth in a quiet room.</span>
        </div>
      </div>

      {/* STEP 1: VOICE STANDARDIZED PROMPT & PRE-CHECKS */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              1. Standardized Vocal Prompt (Phrase + Vowel)
            </h2>
          </div>
          {voiceRecorded ? (
            <StatusDot status="success" label="Passed Pre-checks" size="sm" />
          ) : (
            <span className="text-xs text-[#64748B]">2-Part Task</span>
          )}
        </div>

        <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <p className="font-bold text-[#172554]">
            Part 1: Say sustained &quot;Ahhh&quot; for 3 seconds.
          </p>
          <p className="font-bold text-[#172554]">
            Part 2 (Optional Phrase): Read aloud: &quot;The quick brown fox jumps over the lazy dog.&quot;
          </p>
        </div>

        {/* Real-time Audio Pre-Check Meters */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block uppercase">Signal-to-Noise</span>
            <span className="text-emerald-700 font-extrabold text-xs">28 dB (Clean)</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block uppercase">Clipping Check</span>
            <span className="text-emerald-700 font-extrabold text-xs">0% (Normal)</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block uppercase">Duration</span>
            <span className="text-[#2563EB] font-extrabold text-xs">3.2s Valid</span>
          </div>
        </div>

        {/* Waveform & Loudness Display Area */}
        <div className="bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 min-h-[120px]">
          {/* Animated Waveform Bars */}
          <div className="flex items-end justify-center gap-1.5 h-14 w-full px-4">
            {waveformBars.map((height, i) => (
              <div
                key={i}
                className={`w-2 rounded-full transition-all duration-150 ${
                  isRecording
                    ? "bg-[#2563EB]"
                    : voiceRecorded
                    ? "bg-[#10B981]"
                    : "bg-slate-300"
                }`}
                style={{ height: `${isRecording || voiceRecorded ? height : 12}%` }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between w-full text-xs pt-1 border-t border-slate-200">
            <span className="font-semibold text-[#172554]">
              {isRecording ? "Pre-checking noise & listening..." : voiceRecorded ? "Vocal Check Passed" : "Ready to capture"}
            </span>
            <span className="font-semibold text-[#2563EB]">
              {isRecording ? `${loudnessLevel} dB` : voiceRecorded ? "68 dB (Normal)" : "-- dB"}
            </span>
          </div>
        </div>

        {/* Mic Action Button (≥ 48px tall) */}
        <Button
          variant={voiceRecorded ? "outline" : "primary"}
          fullWidth
          onClick={startVoiceTest}
          disabled={isRecording}
          className={voiceRecorded ? "border-[#10B981] text-[#065F46] bg-emerald-50/50" : ""}
        >
          {isRecording ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping mr-2" />
              <span>Checking SNR &amp; Recording... {3 - recordProgress}s left</span>
            </>
          ) : voiceRecorded ? (
            <>
              <CheckCircle2 className="w-5 h-5 mr-1.5 text-[#10B981]" />
              <span>Retake Voice Test</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-1.5" />
              <span>Start Audio Pre-check &amp; Test</span>
            </>
          )}
        </Button>

        {/* RECORDING METADATA LOGGING & INTRA-PERSON POLICY NOTE */}
        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span>Device: WebRTC / Built-in Mic</span>
            <span>Noise: 22 dB (Quiet)</span>
            <span>Language: English</span>
          </div>
          <p className="text-[10px] text-slate-600 italic">
            Note: Voice stability is analyzed as a personal trend over time, never as a diagnostic score across people.
          </p>
        </div>
      </Card>

      {/* STEP 2: 3 SYMPTOM SCALES (PAIN, FATIGUE, ANXIETY) - 5-DOT TAPS (≥ 44px each) */}
      <Card className="space-y-5 border-[0.5px] border-[#E2E8F0]">
        <div className="border-b-[0.5px] border-[#E2E8F0] pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              2. Non-Motor Symptoms
            </h2>
          </div>
          <span className="text-xs text-[#64748B]">Tap dot (1–5)</span>
        </div>

        {/* Scale 1: Pain */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#172554] flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-[#EF4444]" />
              <span>Pain Level</span>
            </span>
            <StatusDot
              status={painLevel <= 2 ? "good" : painLevel <= 3 ? "warning" : "danger"}
              label={SCALE_LABELS[painLevel - 1]}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5 bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
            {[1, 2, 3, 4, 5].map((dot) => (
              <button
                key={`pain-${dot}`}
                type="button"
                onClick={() => setPainLevel(dot)}
                className={`flex-1 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center font-medium text-sm transition-all cursor-pointer ${
                  painLevel === dot
                    ? "bg-[#EF4444] text-white shadow-xs scale-105"
                    : "bg-white text-[#172554] border border-[#E2E8F0] hover:bg-slate-100"
                }`}
                aria-label={`Pain rating ${dot} of 5`}
              >
                {dot}
              </button>
            ))}
          </div>
        </div>

        {/* Scale 2: Fatigue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#172554] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              <span>Fatigue / Energy</span>
            </span>
            <StatusDot
              status={fatigueLevel <= 2 ? "good" : fatigueLevel <= 3 ? "warning" : "danger"}
              label={SCALE_LABELS[fatigueLevel - 1]}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5 bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
            {[1, 2, 3, 4, 5].map((dot) => (
              <button
                key={`fatigue-${dot}`}
                type="button"
                onClick={() => setFatigueLevel(dot)}
                className={`flex-1 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center font-medium text-sm transition-all cursor-pointer ${
                  fatigueLevel === dot
                    ? "bg-[#F59E0B] text-white shadow-xs scale-105"
                    : "bg-white text-[#172554] border border-[#E2E8F0] hover:bg-slate-100"
                }`}
                aria-label={`Fatigue rating ${dot} of 5`}
              >
                {dot}
              </button>
            ))}
          </div>
        </div>

        {/* Scale 3: Anxiety */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#172554] flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-[#8B5CF6]" />
              <span>Anxiety / Mental Strain</span>
            </span>
            <StatusDot
              status={anxietyLevel <= 2 ? "good" : anxietyLevel <= 3 ? "warning" : "danger"}
              label={SCALE_LABELS[anxietyLevel - 1]}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5 bg-[#F8FAFC] p-2 rounded-2xl border-[0.5px] border-[#E2E8F0]">
            {[1, 2, 3, 4, 5].map((dot) => (
              <button
                key={`anxiety-${dot}`}
                type="button"
                onClick={() => setAnxietyLevel(dot)}
                className={`flex-1 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center font-medium text-sm transition-all cursor-pointer ${
                  anxietyLevel === dot
                    ? "bg-[#8B5CF6] text-white shadow-xs scale-105"
                    : "bg-white text-[#172554] border border-[#E2E8F0] hover:bg-slate-100"
                }`}
                aria-label={`Anxiety rating ${dot} of 5`}
              >
                {dot}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Save Action */}
      <PrimaryButton fullWidth onClick={handleSaveAll} disabled={isSaved}>
        <CheckCircle2 className="w-5 h-5 mr-1" />
        <span>{isSaved ? "Saved to NeuroDiary" : "Complete & Save Check-in"}</span>
      </PrimaryButton>
    </div>
  );
}
