"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { addSession } from "@/lib/sessions";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { SensorBadge } from "@/components/SensorBadge";

import {
  Smartphone,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Activity,
  RefreshCw,
  Download,
  FileText,
  Info,
} from "lucide-react";

type ConnectionState =
  | "idle"
  | "permission"
  | "recording"
  | "processing"
  | "complete"
  | "error";

interface PhoneConnectState {
  phase: ConnectionState;
  error: string | null;
  samplesReceived: number;
  analysisResult: any | null;
  liveData: { x: number; y: number; z: number } | null;
}

export interface PhoneSensorSample {
  timestamp: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export default function PhoneConnectPage() {
  const router = useRouter();
  const { setIMUResult, apiUrl } = useAnalysis();

  const [state, setState] = useState<PhoneConnectState>({
    phase: "idle",
    error: null,
    samplesReceived: 0,
    analysisResult: null,
    liveData: null,
  });

  const [csvData, setCsvData] = useState<string | null>(null);

  const samplesRef = useRef<PhoneSensorSample[]>([]);
  const isRecordingRef = useRef(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        return permission === "granted";
      } catch (e) {
        console.error("iOS permission error", e);
        return false;
      }
    }
    return true;
  }, []);

  const handleMotionEvent = useCallback((event: DeviceMotionEvent) => {
    if (!isRecordingRef.current) return;

    const accel = event.accelerationIncludingGravity;
    const rotation = event.rotationRate;

    if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

    const sample: PhoneSensorSample = {
      timestamp: Date.now(),
      ax: Number(accel.x.toFixed(4)),
      ay: Number(accel.y.toFixed(4)),
      az: Number(accel.z.toFixed(4)),
      gx: rotation ? Number((rotation.alpha ?? 0).toFixed(4)) : 0,
      gy: rotation ? Number((rotation.beta ?? 0).toFixed(4)) : 0,
      gz: rotation ? Number((rotation.gamma ?? 0).toFixed(4)) : 0,
    };

    samplesRef.current.push(sample);
    setState((prev) => ({
      ...prev,
      samplesReceived: samplesRef.current.length,
      liveData: { x: sample.ax, y: sample.ay, z: sample.az },
    }));
  }, []);

  const startRecording = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      setState((prev) => ({ ...prev, phase: "error", error: "Motion permission denied" }));
      return;
    }

    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setState((prev) => ({ ...prev, phase: "error", error: "DeviceMotion not supported on this device" }));
      return;
    }

    samplesRef.current = [];
    isRecordingRef.current = true;
    setState((prev) => ({ ...prev, phase: "recording", samplesReceived: 0, error: null, liveData: null }));

    window.addEventListener("devicemotion", handleMotionEvent);

    recordingTimerRef.current = setTimeout(() => {
      stopRecording();
    }, 20000);
  }, [requestPermission, handleMotionEvent]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    window.removeEventListener("devicemotion", handleMotionEvent);

    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const samples = samplesRef.current;
    if (samples.length > 0) {
      handleRecordingComplete(samples);
    }

    setState((prev) => ({ ...prev, phase: "idle", liveData: null }));
  }, [handleMotionEvent]);

  const handleRecordingComplete = async (samples: PhoneSensorSample[]) => {
    if (samples.length < 5) {
      setState((prev) => ({ ...prev, phase: "error", error: "Recording too short. Please record for at least 2 seconds." }));
      return;
    }

    setState((prev) => ({ ...prev, phase: "processing" }));

    try {
      const csvLines = ["time,ax,ay,az,gx,gy,gz"];
      samples.forEach((s) => {
        const timeSec = ((s.timestamp - samples[0].timestamp) / 1000).toFixed(3);
        csvLines.push(`${timeSec},${s.ax},${s.ay},${s.az},${s.gx},${s.gy},${s.gz}`);
      });
      const csvContent = csvLines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = new File([blob], `phone_session_${Date.now()}.csv`, { type: "text/csv" });
      setCsvData(csvContent);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${apiUrl}/analyze/imu`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to analyze IMU recording.");
      }

      const timestamp = new Date().toISOString();
      const resultWithTime = { ...data, analyzed_at: timestamp, csv_session_id: data.session_id };
      setIMUResult(resultWithTime);

      addSession({
        timestamp,
        tremor: {
          frequencyHz: data.metrics.tremor_frequency_hz,
          amplitude: data.metrics.tremor_amplitude,
          intensity: data.metrics.intensity,
          confidence: data.confidence,
          confidenceReason: data.confidence_reason,
        },
        source: "live",
      });

      setState((prev) => ({
        ...prev,
        phase: "complete",
        analysisResult: resultWithTime,
      }));
    } catch (err: any) {
      setState((prev) => ({ ...prev, phase: "error", error: err.message || "Analysis failed" }));
    }
  };

  const downloadCSV = useCallback(() => {
    const sessionId = state.analysisResult?.csv_session_id;
    if (sessionId) {
      window.open(`${apiUrl}/analyze/imu/${sessionId}/csv`, "_blank");
    } else if (csvData) {
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tremor_session_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [csvData, state.analysisResult, apiUrl]);

  const downloadReport = useCallback(() => {
    if (!state.analysisResult) return;
    const report = {
      sessionDate: new Date().toISOString(),
      sessionId: state.analysisResult.csv_session_id || state.analysisResult.session_id,
      analysis: state.analysisResult,
      rawDataCsv: csvData,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tremor_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.analysisResult, csvData]);

  const handleRetry = () => {
    setState((prev) => ({ ...prev, phase: "idle", error: null }));
  };

  const handleNewRecording = () => {
    setState((prev) => ({ ...prev, phase: "idle", analysisResult: null, samplesReceived: 0 }));
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
      window.removeEventListener("devicemotion", handleMotionEvent);
    };
  }, [handleMotionEvent]);

  const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const isMobile = typeof window !== "undefined" && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Calculate actual sample rate from recorded samples
  const actualSampleRateHz =
    samplesRef.current.length >= 2
      ? Math.round(
          (samplesRef.current.length /
            ((samplesRef.current[samplesRef.current.length - 1].timestamp - samplesRef.current[0].timestamp) / 1000)) ||
            50
        )
      : 50;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
            Phone IMU Mode
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Wrist-strapped phone sensor mode (No band required)
          </p>
        </div>
        <SensorBadge />
      </header>

      {/* WRIST SETUP GUIDE & ILLUSTRATION */}
      <Card className="space-y-3.5 border-emerald-200 bg-emerald-50/50">
        <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span>Wrist Setup Guide</span>
        </div>
        <div className="space-y-2 text-xs text-emerald-900 leading-relaxed font-normal">
          <p>
            Strap or hold your phone firmly against the <strong>back of your wrist or forearm</strong> with the screen facing outward.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center pt-1 font-semibold text-[11px]">
            <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
              1. Strap to Wrist
            </div>
            <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
              2. Rest Arm Flat
            </div>
            <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
              3. Press Start
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172554]">Sensor Status</h2>
            <p className="text-xs text-[#64748B]">Phone accelerometer &amp; gyroscope</p>
          </div>
          <Activity className="w-5 h-5 text-[#2563EB]" />
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${state.phase === "recording" ? "text-emerald-600" : "text-slate-400"}`} />
              <span className="font-medium text-[#172554]">DeviceMotion Sensor</span>
            </div>
            <span className={`font-bold ${state.phase === "recording" ? "text-emerald-600" : "text-slate-500"}`}>
              {state.phase === "recording" ? `Active (${actualSampleRateHz} Hz)` : "Ready"}
            </span>
          </div>


          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-[#172554]">Secure Context</span>
            </div>
            <span className={`font-bold ${isSecureContext ? "text-emerald-600" : "text-rose-600"}`}>
              {isSecureContext ? "HTTPS ✓" : "HTTP ⚠"}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-[#172554]">Samples Received</span>
            </div>
            <span className="font-bold text-[#2563EB]">{state.samplesReceived}</span>
          </div>

          {state.liveData && state.phase === "recording" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="text-xs font-bold text-blue-900 mb-2">Live Accelerometer (m/s²)</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 block font-bold">X</span>
                  <span className="text-sm font-bold text-blue-700">{state.liveData.x.toFixed(4)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Y</span>
                  <span className="text-sm font-bold text-blue-700">{state.liveData.y.toFixed(4)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Z</span>
                  <span className="text-sm font-bold text-blue-700">{state.liveData.z.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {state.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{state.error}</div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {state.phase === "idle" && (
            <div className="border-2 border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center mx-auto shadow-sm">
                <Smartphone className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#172554]">Ready to Record</h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto">
                  Hold the phone steady in your dominant hand, arm resting on your lap. Tap Start to capture 20 seconds of motion data.
                </p>
              </div>
              <Button variant="primary" fullWidth size="lg" onClick={startRecording} className="bg-brand-gradient shadow-md font-bold" disabled={!isSecureContext}>
                <Play className="w-5 h-5 mr-2" />
                <span>Start Motion Sensor</span>
              </Button>
              {!isSecureContext && (
                <p className="text-xs text-rose-600">Requires HTTPS. Open via HTTPS or localhost.</p>
              )}
            </div>
          )}

          {state.phase === "recording" && (
            <div className="bg-slate-50 border border-blue-200 rounded-2xl p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-black text-[#172554] uppercase tracking-wider">Recording</span>
                </div>
                <div className="text-base font-black text-blue-600">
                  {state.samplesReceived} samples
                </div>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-gradient h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, (state.samplesReceived / 400) * 100)}%` }}
                />
              </div>

              <div className="text-center text-xs text-slate-600">
                Hold phone steady in dominant hand, arm resting on lap
              </div>

              <Button
                variant="secondary"
                fullWidth
                size="lg"
                onClick={stopRecording}
                className="bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
              >
                <Square className="w-5 h-5 mr-2 fill-rose-600" />
                <span>Stop & Analyze</span>
              </Button>
            </div>
          )}

          {state.phase === "processing" && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin mx-auto" />
              <div className="text-sm font-bold text-[#172554]">Analyzing Tremor Frequency & PSD...</div>
              <p className="text-xs text-slate-500">Processing {state.samplesReceived} motion samples</p>
            </div>
          )}

          {state.phase === "complete" && state.analysisResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">Analysis Complete</span>
                </div>
                <ConfidenceBadge
                  level={state.analysisResult.confidence}
                  showText={true}
                  reason={state.analysisResult.confidence_reason}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Tremor Freq</span>
                  <span className="text-lg font-extrabold text-[#172554]">{state.analysisResult.metrics.tremor_frequency_hz.toFixed(2)} Hz</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Amplitude</span>
                  <span className="text-lg font-extrabold text-[#172554]">{state.analysisResult.metrics.tremor_amplitude.toFixed(4)} m/s²</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Intensity</span>
                  <span className="text-lg font-extrabold text-[#172554] capitalize">{state.analysisResult.metrics.intensity}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" fullWidth size="md" onClick={() => router.push("/fingerprint")} className="bg-brand-gradient font-bold flex-1 min-w-[140px]">
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                  <span>View in Fingerprint</span>
                </Button>
                <Button variant="outline" fullWidth size="md" onClick={downloadCSV} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold flex-1 min-w-[140px]" disabled={!csvData}>
                  <Download className="w-4 h-4 mr-1.5" />
                  <span>Download CSV</span>
                </Button>
                <Button variant="outline" fullWidth size="md" onClick={downloadReport} className="border-blue-300 text-blue-700 hover:bg-blue-50 font-bold flex-1 min-w-[140px]" disabled={!csvData}>
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Download Report</span>
                </Button>
                <Button variant="outline" fullWidth size="md" onClick={handleNewRecording} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold flex-1 min-w-[140px]">
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  <span>Record Again</span>
                </Button>
              </div>
            </div>
          )}

          {state.phase === "error" && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 space-y-3 text-rose-900">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-100 rounded-xl shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">Recording Failed</h4>
                  <p className="text-xs text-rose-900 mt-1 leading-relaxed font-medium">{state.error}</p>
                </div>
              </div>
              <Button variant="outline" fullWidth size="sm" onClick={handleRetry} className="bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200 font-bold text-xs">
                <RefreshCw className="w-4 h-4 mr-1.5" />
                <span>Try Again</span>
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Requirements</h3>
        <ul className="space-y-2 text-xs text-slate-600">
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> Open this page on your <strong>phone</strong> (HTTPS required)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> Grant <strong>motion sensor permission</strong> when prompted (iOS Safari)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> Hold phone steady in dominant hand, arm resting on lap</li>
        </ul>
      </Card>
    </div>
  );
}