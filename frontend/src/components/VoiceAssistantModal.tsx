"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { voiceGuide, VoiceCommandResult } from "@/lib/voiceGuide";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  X,
  Activity,
  Footprints,
  Pill,
  TrendingUp,
  HelpCircle,
  Radio,
  CheckCircle2,
} from "lucide-react";

export function VoiceAssistantModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assistantResponse, setAssistantResponse] = useState(
    "Hello! I am STEADY Voice Guide. Speak or tap a command below."
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Sync voice muted state
  useEffect(() => {
    voiceGuide.setVoiceEnabled(!voiceMuted);
  }, [voiceMuted]);

  // Execute action from command
  const executeIntent = (res: VoiceCommandResult) => {
    setTranscript(res.transcript);
    setAssistantResponse(res.responseMessage);
    setIsSpeaking(true);

    voiceGuide.speak(res.responseMessage, () => {
      setIsSpeaking(false);
    });

    switch (res.intent) {
      case "FREEZE_ASSIST":
        setLastAction("Triggered Freeze Assist");
        setTimeout(() => {
          setIsOpen(false);
          window.dispatchEvent(new CustomEvent("trigger-freeze-assist"));
        }, 1200);
        break;

      case "START_EXERCISE":
        setLastAction("Opening Move Coach");
        setTimeout(() => {
          setIsOpen(false);
          router.push("/move");
        }, 1200);
        break;

      case "LOG_MEDICATION":
        setLastAction("Opened Medication Logger");
        setTimeout(() => {
          setIsOpen(false);
          window.dispatchEvent(new CustomEvent("trigger-dose-log"));
        }, 1200);
        break;

      case "CHECK_FORECAST":
        setLastAction("Opening Daily Forecast");
        setTimeout(() => {
          setIsOpen(false);
          router.push("/forecast");
        }, 1200);
        break;

      case "CHECK_TREMOR":
        setLastAction("Opening Vocal Tremor Check");
        setTimeout(() => {
          setIsOpen(false);
          router.push("/voice-check");
        }, 1200);
        break;

      case "OPEN_CUE_LAB":
        setLastAction("Opening Live Cue Lab");
        setTimeout(() => {
          setIsOpen(false);
          router.push("/cue-lab");
        }, 1200);
        break;

      case "OPEN_DIARY":
        setLastAction("Opening Symptom Diary");
        setTimeout(() => {
          setIsOpen(false);
          router.push("/diary");
        }, 1200);
        break;

      default:
        setLastAction("Guidance provided");
        break;
    }
  };

  const handleStartListening = () => {
    setIsListening(true);
    setTranscript("Listening for your voice...");
    const started = voiceGuide.startListening(
      (result) => {
        setIsListening(false);
        executeIntent(result);
      },
      (err) => {
        setIsListening(false);
        setTranscript("");
        setAssistantResponse(
          "I couldn't catch that clearly. Please try speaking again or tap one of the suggested commands."
        );
      }
    );

    if (!started) {
      // Browser doesn't support native recognition
      setTimeout(() => {
        setIsListening(false);
        setTranscript("Browser speech recognition not active");
        setAssistantResponse(
          "Select any prompt below to activate hands-free guidance."
        );
      }, 800);
    }
  };

  const handleSimulatedPrompt = (commandText: string) => {
    const parsed = voiceGuide.parseCommand(commandText);
    executeIntent(parsed);
  };

  return (
    <>
      {/* Floating Voice Guide Trigger Orb */}
      <button
        onClick={() => {
          setIsOpen(true);
          handleStartListening();
        }}
        aria-label="Open STEADY Voice Assistant"
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border border-blue-400/30"
      >
        <div className="relative">
          <Mic className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-white"></span>
        </div>
        <span className="text-xs font-bold tracking-wide hidden sm:inline">
          Voice Guide
        </span>
      </button>

      {/* Voice Assistant Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative text-left overflow-hidden space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-[#2563EB]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#172554]">
                    STEADY Voice Guide
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Hands-free movement &amp; medication assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVoiceMuted(!voiceMuted)}
                  className="p-2 rounded-xl text-[#64748B] hover:bg-slate-100 transition-colors"
                  title={voiceMuted ? "Unmute Voice" : "Mute Voice"}
                >
                  {voiceMuted ? (
                    <VolumeX className="w-5 h-5 text-red-500" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-[#2563EB]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    voiceGuide.stopSpeaking();
                    voiceGuide.stopListening();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-xl text-[#64748B] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Visual Waveform & Mic Centerpiece */}
            <div className="flex flex-col items-center justify-center py-6 bg-gradient-to-b from-[#F8FAFC] to-[#EFF6FF] rounded-2xl border border-blue-100/60 relative">
              {/* Pulsating Ring */}
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-blue-600 ring-8 ring-blue-200 animate-pulse"
                    : isSpeaking
                    ? "bg-emerald-600 ring-8 ring-emerald-200 animate-bounce"
                    : "bg-[#2563EB] shadow-lg"
                }`}
              >
                <button
                  onClick={isListening ? () => voiceGuide.stopListening() : handleStartListening}
                  className="w-full h-full flex items-center justify-center text-white"
                >
                  {isListening ? (
                    <Radio className="w-10 h-10 animate-spin" />
                  ) : (
                    <Mic className="w-10 h-10" />
                  )}
                </button>
              </div>

              {/* Dynamic Waveform Visualizer */}
              <div className="flex items-center gap-1.5 mt-4 h-6">
                {[40, 70, 90, 60, 100, 80, 50, 90, 75, 45].map((height, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-300 ${
                      isListening || isSpeaking
                        ? "bg-[#2563EB] animate-pulse"
                        : "bg-slate-300"
                    }`}
                    style={{
                      height:
                        isListening || isSpeaking
                          ? `${Math.max(15, Math.round(height * Math.random()))}px`
                          : "6px",
                    }}
                  />
                ))}
              </div>

              <p className="text-xs font-semibold text-[#2563EB] mt-3">
                {isListening
                  ? "Listening... speak now"
                  : isSpeaking
                  ? "Speaking response..."
                  : "Tap microphone to speak"}
              </p>
            </div>

            {/* Speech Transcript & Assistant Reply */}
            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-200 space-y-2">
              {transcript && (
                <div className="text-xs text-[#64748B]">
                  <span className="font-semibold text-slate-700">You said: </span>
                  &ldquo;{transcript}&rdquo;
                </div>
              )}
              <div className="text-sm font-medium text-[#172554] flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <span>{assistantResponse}</span>
              </div>
            </div>

            {/* Quick Hands-Free Spoken Action Chips */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] block">
                Quick Voice Commands
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleSimulatedPrompt("Help I am frozen")}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-bold text-left transition-all"
                >
                  <Footprints className="w-4 h-4 text-red-600 shrink-0" />
                  <span>&ldquo;Help, I am frozen!&rdquo;</span>
                </button>

                <button
                  onClick={() => handleSimulatedPrompt("Start High Knees Exercise")}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold text-left transition-all"
                >
                  <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>&ldquo;Start Move Coach&rdquo;</span>
                </button>

                <button
                  onClick={() => handleSimulatedPrompt("Log Levodopa medication")}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-bold text-left transition-all"
                >
                  <Pill className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>&ldquo;Log medication dose&rdquo;</span>
                </button>

                <button
                  onClick={() => handleSimulatedPrompt("What is my mobility forecast?")}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold text-left transition-all"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>&ldquo;What is my forecast?&rdquo;</span>
                </button>
              </div>
            </div>

            {/* Bottom Status */}
            {lastAction && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-semibold pt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{lastAction}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
