"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  extractVoiceFeatures,
  getFallbackVoiceFeatures,
  compareVoiceToBaseline,
  VoiceAnalysisResult,
  VoiceBaselineComparison,
} from "@/lib/voiceAnalysis";
import {
  addSession,
  getSessions,
  getBaseline,
  Session,
} from "@/lib/sessions";
import { saveVoiceCheck } from "@/lib/confidence";
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Info,
  Square,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  AlertTriangle,
} from "lucide-react";

export default function VoiceAnalysisPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0); // 0 to 10 seconds
  const [liveVolume, setLiveVolume] = useState(0); // 0 to 100 for level meter
  const [waveformBars, setWaveformBars] = useState<number[]>([15, 20, 25, 30, 20, 15, 25, 35, 40, 30, 20, 15]);
  const [micDenied, setMicDenied] = useState(false);

  // Audio nodes & references
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcmBufferRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Results state
  const [voiceResult, setVoiceResult] = useState<VoiceAnalysisResult | null>(null);
  const [baselineComparison, setBaselineComparison] = useState<VoiceBaselineComparison | null>(null);
  const [personalBaseline, setPersonalBaseline] = useState<{
    f0Hz: number;
    jitterPct: number;
    shimmerPct: number;
    hnrDb: number;
  }>({
    f0Hz: 140.0,
    jitterPct: 0.70,
    shimmerPct: 2.10,
    hnrDb: 23.0,
  });

  const [isSaved, setIsSaved] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // Load personal baseline from prior sessions
    const sessions = getSessions(true);
    const b = getBaseline(new Date().toISOString(), true);
    if (b && b.voiceJitterMean !== null) {
      setPersonalBaseline({
        f0Hz: b.voiceF0Mean ?? 140.0,
        jitterPct: b.voiceJitterMean ?? 0.70,
        shimmerPct: b.voiceShimmerMean ?? 2.10,
        hnrDb: b.voiceHnrMean ?? 23.0,
      });
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Start Web Audio API recording
  const startRecording = async () => {
    setMicDenied(false);
    setVoiceResult(null);
    setBaselineComparison(null);
    setIsSaved(false);
    pcmBufferRef.current = [];
    setRecordProgress(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Process audio frames
      const dataArray = new Float32Array(analyser.fftSize);

      const processAudio = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(dataArray);

        // Calculate live RMS volume
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = dataArray[i];
          sumSq += val * val;
          pcmBufferRef.current.push(val);
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const volumeLevel = Math.min(100, Math.round(rms * 400));
        setLiveVolume(volumeLevel);

        // Update live visualizer bars
        setWaveformBars(
          Array.from({ length: 14 }, () => Math.min(95, Math.max(12, Math.floor(rms * 350 + Math.random() * 25))))
        );

        animationFrameRef.current = requestAnimationFrame(processAudio);
      };

      processAudio();

      // Timer update
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setRecordProgress(elapsed);

        if (elapsed >= 10.0) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      console.warn("Microphone access unavailable or denied:", err);
      setMicDenied(true);
      showToast("Microphone access unavailable — using sample simulation");
      runSimulatedTest();
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const elapsed = startTimeRef.current > 0 ? (Date.now() - startTimeRef.current) / 1000 : 5.0;
    setIsRecording(false);
    setRecordProgress(elapsed);

    // Stop audio tracks & context
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    const sampleRate = audioContextRef.current ? audioContextRef.current.sampleRate : 44100;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }

    // Extract features
    const pcm = new Float32Array(pcmBufferRef.current);
    const result = extractVoiceFeatures(pcm, sampleRate, elapsed);
    setVoiceResult(result);

    const comp = compareVoiceToBaseline(result, personalBaseline);
    setBaselineComparison(comp);
    showToast("Voice analysis complete!");
  };

  const runSimulatedTest = (isUnusual = false) => {
    setIsRecording(true);
    setRecordProgress(0);

    let progress = 0;
    const simInterval = setInterval(() => {
      progress += 0.5;
      setRecordProgress(progress);
      setLiveVolume(Math.floor(Math.random() * 35) + 45);
      setWaveformBars(
        Array.from({ length: 14 }, () => Math.floor(Math.random() * 50) + 25)
      );

      if (progress >= 5.0) {
        clearInterval(simInterval);
        setIsRecording(false);
        const result = getFallbackVoiceFeatures(5.0, isUnusual);
        setVoiceResult(result);
        const comp = compareVoiceToBaseline(result, personalBaseline);
        setBaselineComparison(comp);
        showToast("Simulated voice sample analyzed!");
      }
    }, 500);
  };

  const handleSaveSession = () => {
    if (!voiceResult) return;

    // 1. Save to sessions.ts
    const sessionDate = new Date().toISOString();
    const newSession: Omit<Session, "id"> = {
      timestamp: sessionDate,
      tremor: {
        frequencyHz: 4.8,
        amplitude: 0.18,
        intensity: "mild",
        confidence: voiceResult.confidence,
        confidenceReason: voiceResult.confidenceReason,
      },
      voice: {
        f0Hz: voiceResult.f0Hz,
        jitterPct: voiceResult.jitterPct,
        shimmerPct: voiceResult.shimmerPct,
        hnrDb: voiceResult.hnrDb,
        loudnessDb: voiceResult.loudnessDb,
        confidence: voiceResult.confidence,
        confidenceReason: voiceResult.confidenceReason,
      },
      source: "live",
    };

    addSession(newSession);

    // 2. Save to confidence voice checks
    saveVoiceCheck({
      timestamp: sessionDate,
      loudnessDb: voiceResult.loudnessDb,
      source: "user",
    });

    setIsSaved(true);
    showToast("Voice check saved to Movement History!");
    setTimeout(() => {
      router.push("/progress");
    }, 1200);
  };

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
                🎤 Voice Check
              </h1>
              <p className="text-xs text-[#64748B]">
                Sustained vowel acoustic stability (Jitter / Shimmer / HNR)
              </p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-blue-50 text-[#2563EB]">
            <Mic className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* INSTRUCTIONS & RECORDING CARD */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Sustained Vowel Test (&quot;aaah&quot;)
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
            3s min &bull; 10s max
          </span>
        </div>

        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-[#1E3A8A] leading-relaxed flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Instructions:</span> Say &quot;aaah&quot; and hold it for as long and steady as you can at your regular speaking volume.
          </div>
        </div>

        {/* LIVE WAVEFORM & LEVEL METER */}
        <div className="bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-2xl p-5 flex flex-col items-center justify-center space-y-4 min-h-[150px] relative overflow-hidden">
          {isRecording ? (
            <div className="w-full space-y-3 text-center">
              <div className="flex items-center justify-center gap-1.5 h-16 px-4">
                {waveformBars.map((height, idx) => (
                  <div
                    key={idx}
                    className="w-2 rounded-full bg-[#2563EB] transition-all duration-75"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>

              {/* Progress timer bar */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] px-1">
                  <span>Recording... {recordProgress.toFixed(1)}s</span>
                  <span className={recordProgress >= 3.0 ? "text-emerald-600" : "text-amber-600"}>
                    {recordProgress < 3.0 ? "Min 3s needed" : "Ready to complete"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      recordProgress >= 3.0 ? "bg-emerald-500" : "bg-[#2563EB]"
                    }`}
                    style={{ width: `${Math.min(100, (recordProgress / 10) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : voiceResult ? (
            <div className="text-center space-y-1 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#172554]">Acoustic Analysis Complete</h3>
              <p className="text-xs text-[#64748B]">
                {voiceResult.durationSec}s sample &bull; {voiceResult.loudnessDb} dB volume
              </p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center mx-auto">
                <Mic className="w-6 h-6" />
              </div>
              <p className="text-xs text-[#64748B] max-w-[240px]">
                Tap Record, then hold a steady &quot;aaah&quot; vowel sound for 3–10 seconds.
              </p>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="space-y-2">
          {!isRecording ? (
            <PrimaryButton
              onClick={startRecording}
              className="w-full justify-center bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              <Mic className="w-4 h-4 mr-2" />
              {voiceResult ? "Record New Voice Sample" : "Start Voice Recording"}
            </PrimaryButton>
          ) : (
            <Button
              onClick={stopRecording}
              disabled={recordProgress < 3.0}
              className={`w-full justify-center ${
                recordProgress < 3.0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }`}
            >
              <Square className="w-4 h-4 mr-2 fill-current" />
              {recordProgress < 3.0
                ? `Hold sound (${(3.0 - recordProgress).toFixed(1)}s min)`
                : "Stop Recording & Analyze"}
            </Button>
          )}

          {/* Dev/Demo Simulation Fallback */}
          {!isRecording && (
            <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1 px-1">
              <span>No microphone?</span>
              <button
                onClick={() => runSimulatedTest(false)}
                className="text-[#2563EB] font-semibold hover:underline cursor-pointer"
              >
                Run Sample Test
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* RESULTS DISPLAY PANEL */}
      {voiceResult && baselineComparison && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Main Voice Summary Card */}
          <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                  Voice Acoustic Features
                </h3>
              </div>
              <ConfidenceBadge
                level={voiceResult.confidence}
                reason={voiceResult.confidenceReason}
              />
            </div>

            {/* Overall Status Banner */}
            <div
              className={`p-3 rounded-xl border text-xs font-medium leading-relaxed flex items-start gap-2.5 ${
                baselineComparison.overallFlag === "unusual"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              {baselineComparison.overallFlag === "unusual" ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block mb-0.5">
                  {baselineComparison.overallFlag === "unusual"
                    ? "Unusual for you today"
                    : "Matches your usual voice stability"}
                </span>
                <span>{baselineComparison.summaryText}</span>
              </div>
            </div>

            {/* 4 Core Acoustic Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Fundamental Frequency (F0) */}
              <div className="bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Pitch (F0)
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-extrabold text-[#172554]">
                    {voiceResult.f0Hz} <span className="text-xs font-normal text-[#64748B]">Hz</span>
                  </span>
                  <span className="text-[10px] font-semibold text-[#64748B]">
                    vs {personalBaseline.f0Hz} Hz
                  </span>
                </div>
                <div className="text-[10px] text-[#64748B]">Fundamental vocal pitch</div>
              </div>

              {/* 2. Jitter (%) */}
              <div
                className={`border-[0.5px] rounded-xl p-3 space-y-1 ${
                  baselineComparison.isJitterUnusual
                    ? "bg-amber-50/70 border-amber-200"
                    : "bg-[#F8FAFC] border-[#E2E8F0]"
                }`}
              >
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Jitter (Pitch Var)
                </span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-lg font-extrabold ${
                      baselineComparison.isJitterUnusual ? "text-amber-900" : "text-[#172554]"
                    }`}
                  >
                    {voiceResult.jitterPct}%
                  </span>
                  <div
                    className={`flex items-center text-[10px] font-bold ${
                      baselineComparison.jitterDiff > 0.1
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {baselineComparison.jitterDiff > 0 ? (
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    )}
                    {Math.abs(baselineComparison.jitterDiff)}%
                  </div>
                </div>
                <div className="text-[10px] text-[#64748B]">
                  Baseline: {personalBaseline.jitterPct}%
                </div>
              </div>

              {/* 3. Shimmer (%) */}
              <div
                className={`border-[0.5px] rounded-xl p-3 space-y-1 ${
                  baselineComparison.isShimmerUnusual
                    ? "bg-amber-50/70 border-amber-200"
                    : "bg-[#F8FAFC] border-[#E2E8F0]"
                }`}
              >
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Shimmer (Amp Var)
                </span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-lg font-extrabold ${
                      baselineComparison.isShimmerUnusual ? "text-amber-900" : "text-[#172554]"
                    }`}
                  >
                    {voiceResult.shimmerPct}%
                  </span>
                  <div
                    className={`flex items-center text-[10px] font-bold ${
                      baselineComparison.shimmerDiff > 0.2
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {baselineComparison.shimmerDiff > 0 ? (
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    )}
                    {Math.abs(baselineComparison.shimmerDiff)}%
                  </div>
                </div>
                <div className="text-[10px] text-[#64748B]">
                  Baseline: {personalBaseline.shimmerPct}%
                </div>
              </div>

              {/* 4. HNR (dB) */}
              <div
                className={`border-[0.5px] rounded-xl p-3 space-y-1 ${
                  baselineComparison.isHnrUnusual
                    ? "bg-amber-50/70 border-amber-200"
                    : "bg-[#F8FAFC] border-[#E2E8F0]"
                }`}
              >
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  HNR Ratio
                </span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-lg font-extrabold ${
                      baselineComparison.isHnrUnusual ? "text-amber-900" : "text-[#172554]"
                    }`}
                  >
                    {voiceResult.hnrDb} <span className="text-xs font-normal text-[#64748B]">dB</span>
                  </span>
                  <div
                    className={`flex items-center text-[10px] font-bold ${
                      baselineComparison.hnrDiff < -1.5
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {baselineComparison.hnrDiff >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    )}
                    {Math.abs(baselineComparison.hnrDiff)} dB
                  </div>
                </div>
                <div className="text-[10px] text-[#64748B]">
                  Baseline: {personalBaseline.hnrDb} dB
                </div>
              </div>
            </div>

            {/* Disclaimers & Save Button */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-[#64748B] flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <span>
                <strong>Estimated acoustic parameters:</strong> Extracted in-browser via Web Audio API autocorrelation. Compared against your personal rolling baseline, not clinical lab standards.
              </span>
            </div>

            <PrimaryButton
              onClick={handleSaveSession}
              disabled={isSaved}
              className="w-full justify-center bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isSaved ? "Voice Check Saved!" : "Save Voice Check to History"}
            </PrimaryButton>
          </Card>
        </div>
      )}
    </div>
  );
}
