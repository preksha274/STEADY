/**
 * STEADY Voice Guide & Assistant Engine
 * Web Speech API integration for bidirectional voice interaction:
 * 1. Text-to-Speech (TTS) for hands-free audio coaching, cue guidance, and accessibility
 * 2. Speech-to-Text (STT) for hands-free voice commands (Freeze Assist, Exercise, Medication, Forecast)
 */

export type VoiceIntent =
  | "FREEZE_ASSIST"
  | "START_EXERCISE"
  | "STOP_EXERCISE"
  | "LOG_MEDICATION"
  | "CHECK_FORECAST"
  | "CHECK_TREMOR"
  | "OPEN_CUE_LAB"
  | "OPEN_DIARY"
  | "READ_SCHEDULE"
  | "HELP"
  | "UNKNOWN";

export interface VoiceCommandResult {
  transcript: string;
  intent: VoiceIntent;
  responseMessage: string;
  actionPayload?: any;
}

class VoiceGuideEngine {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening: boolean = false;
  private voiceEnabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        this.synth = window.speechSynthesis;
      }

      // Initialize SpeechRecognition if available
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = false;
          this.recognition.interimResults = false;
          this.recognition.lang = "en-US";
        } catch (e) {
          console.warn("Speech recognition initialization error:", e);
        }
      }
    }
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    if (!enabled && this.synth) {
      this.synth.cancel();
    }
  }

  public getVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  /**
   * Speaks text using SpeechSynthesis with warm, steady cadence
   */
  public speak(text: string, onEnd?: () => void): void {
    if (!this.voiceEnabled || typeof window === "undefined" || !this.synth) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.synth.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly slower, clear cadence for accessibility
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Select preferred gentle English voice if available
      const voices = this.synth.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel"))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      if (onEnd) {
        utterance.onend = () => onEnd();
        utterance.onerror = () => onEnd();
      }

      this.synth.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      if (onEnd) onEnd();
    }
  }

  public stopSpeaking(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  /**
   * Parses spoken text into an actionable intent
   */
  public parseCommand(spokenText: string): VoiceCommandResult {
    const text = spokenText.toLowerCase().trim();

    if (
      text.includes("freeze") ||
      text.includes("frozen") ||
      text.includes("stuck") ||
      text.includes("can't move") ||
      text.includes("cant move") ||
      text.includes("unfreeze") ||
      text.includes("help me walk")
    ) {
      return {
        transcript: spokenText,
        intent: "FREEZE_ASSIST",
        responseMessage:
          "Activating Freeze Assist laser cue now. Stand steady and step over the line on the beat.",
      };
    }

    if (
      text.includes("exercise") ||
      text.includes("move") ||
      text.includes("start workout") ||
      text.includes("reach") ||
      text.includes("marching") ||
      text.includes("knees")
    ) {
      return {
        transcript: spokenText,
        intent: "START_EXERCISE",
        responseMessage:
          "Opening Move Coach. Let's do your big movements with rhythmic cues.",
      };
    }

    if (text.includes("stop") || text.includes("pause") || text.includes("end workout")) {
      return {
        transcript: spokenText,
        intent: "STOP_EXERCISE",
        responseMessage: "Pausing exercise session. Take a resting breath.",
      };
    }

    if (
      text.includes("medication") ||
      text.includes("medicine") ||
      text.includes("dose") ||
      text.includes("pill") ||
      text.includes("levodopa") ||
      text.includes("took my")
    ) {
      return {
        transcript: spokenText,
        intent: "LOG_MEDICATION",
        responseMessage:
          "Logging your medication dose now. Keeping your response curve up to date.",
      };
    }

    if (
      text.includes("forecast") ||
      text.includes("mobility") ||
      text.includes("best window") ||
      text.includes("good window") ||
      text.includes("how is today") ||
      text.includes("score")
    ) {
      return {
        transcript: spokenText,
        intent: "CHECK_FORECAST",
        responseMessage:
          "Your optimal mobility window today is 9:00 AM to 1:00 PM. Predicted mobility score is 84 percent.",
      };
    }

    if (
      text.includes("tremor") ||
      text.includes("voice check") ||
      text.includes("speech") ||
      text.includes("pitch") ||
      text.includes("stability")
    ) {
      return {
        transcript: spokenText,
        intent: "CHECK_TREMOR",
        responseMessage:
          "Opening tremor and vocal stability check. Say 'Ahhh' for 5 seconds.",
      };
    }

    if (text.includes("cue") || text.includes("tempo") || text.includes("metronome") || text.includes("bpm")) {
      return {
        transcript: spokenText,
        intent: "OPEN_CUE_LAB",
        responseMessage: "Opening Live Cue Designer. Your calibrated tempo is 88 beats per minute.",
      };
    }

    if (text.includes("diary") || text.includes("log feeling") || text.includes("symptom")) {
      return {
        transcript: spokenText,
        intent: "OPEN_DIARY",
        responseMessage: "Opening symptom diary. Record how your movement feels right now.",
      };
    }

    if (text.includes("schedule") || text.includes("danger zone") || text.includes("wearing off")) {
      return {
        transcript: spokenText,
        intent: "READ_SCHEDULE",
        responseMessage:
          "Next medication dose is at 1:00 PM. High freeze risk zone predicted between 4:30 PM and 5:30 PM.",
      };
    }

    return {
      transcript: spokenText,
      intent: "HELP",
      responseMessage:
        "I'm your STEADY voice companion. You can say 'Help I am frozen', 'Start exercise', 'Log medication', or 'What is my forecast?'.",
    };
  }

  /**
   * Starts listening with SpeechRecognition or triggers simulated prompt
   */
  public startListening(
    onResult: (result: VoiceCommandResult) => void,
    onError?: (err: any) => void
  ): boolean {
    if (!this.recognition) {
      console.log("Speech recognition not natively supported, falling back to interactive voice prompts");
      return false;
    }

    try {
      this.isListening = true;
      this.recognition.onresult = (event: any) => {
        this.isListening = false;
        const transcript = event.results[0][0].transcript;
        const parsed = this.parseCommand(transcript);
        this.speak(parsed.responseMessage);
        onResult(parsed);
      };

      this.recognition.onerror = (err: any) => {
        this.isListening = false;
        if (onError) onError(err);
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
      return true;
    } catch (e) {
      this.isListening = false;
      if (onError) onError(e);
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
  }
}

export const voiceGuide = new VoiceGuideEngine();
