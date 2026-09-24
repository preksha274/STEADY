"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Session,
  getSessions,
  addSession,
  clearSessions,
  seedDemoSessions,
} from "@/lib/sessions";
import { seedDemoDiary } from "@/lib/diary";

export interface IMUMetrics {
  tremor_frequency_hz: number;
  tremor_amplitude: number;
  intensity: "mild" | "moderate" | "high";
  signal_magnitude: number;
  variability: number;
  gyro_rms?: number | null;
}

export interface IMUQuality {
  duration_s: number;
  sample_rate_hz: number;
  missing_samples_pct: number;
  is_short: boolean;
  is_noisy: boolean;
}

export interface ChartSignalPoint {
  time_s: number;
  raw_magnitude: number;
  filtered_magnitude: number;
}

export interface ChartPSDPoint {
  freq_hz: number;
  power: number;
}

export interface IMUAnalysisResult {
  metrics: IMUMetrics;
  quality: IMUQuality;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  chart_data: {
    signal: ChartSignalPoint[];
    psd: ChartPSDPoint[];
  };
  analyzed_at?: string;
}

export interface EEGBandInfo {
  absolute: number;
  relative: number;
  band_hz: [number, number];
}

export interface EEGAnalysisResult {
  channel_count: number;
  channels: string[];
  band_powers: {
    delta: EEGBandInfo;
    theta: EEGBandInfo;
    alpha: EEGBandInfo;
    beta: EEGBandInfo;
    total_power_0_5_30hz: number;
  };
  quality: {
    duration_s: number;
    sample_rate_hz: number;
    flat_channels: string[];
    artifact_channels: string[];
    line_noise_present: boolean;
    is_short: boolean;
  };
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  chart_data: {
    psd: ChartPSDPoint[];
  };
  analyzed_at?: string;
}

export interface GaitMetrics {
  cadence_steps_per_min: number;
  step_count: number;
  symmetry_pct: number;
  gait_speed_category: "slow" | "typical" | "brisk";
}

export interface GaitQuality {
  duration_s: number;
  avg_foot_visibility: number;
  is_feet_visible: boolean;
  frame_count: number;
}

export interface GaitAnalysisResult {
  metrics: GaitMetrics;
  quality: GaitQuality;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  analyzed_at?: string;
}

interface AnalysisContextType {
  imuResult: IMUAnalysisResult | null;
  eegResult: EEGAnalysisResult | null;
  gaitResult: GaitAnalysisResult | null;
  isDemoMode: boolean;
  isLoaded: boolean;
  setIsDemoMode: (enabled: boolean) => void;
  setIMUResult: (result: IMUAnalysisResult | null) => void;
  setEEGResult: (result: EEGAnalysisResult | null) => void;
  setGaitResult: (result: GaitAnalysisResult | null) => void;
  clearAnalysis: () => void;
  resetDemoData: () => void;
  apiUrl: string;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [imuResult, setIMUResultState] = useState<IMUAnalysisResult | null>(null);
  const [eegResult, setEEGResultState] = useState<EEGAnalysisResult | null>(null);
  const [gaitResult, setGaitResultState] = useState<GaitAnalysisResult | null>(null);
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

  // Load from localStorage on mount & seed demo sessions if needed (Rule 4: useEffect client only)
  useEffect(() => {
    try {
      // Seed demo sessions & diary on first load if empty
      seedDemoSessions(false);
      seedDemoDiary(false);

      const storedDemoMode = localStorage.getItem("movepilot_demo_mode");
      if (storedDemoMode !== null) {
        setIsDemoModeState(JSON.parse(storedDemoMode));
      }

      const storedIMU = localStorage.getItem("movepilot_imu_result");
      if (storedIMU) {
        setIMUResultState(JSON.parse(storedIMU));
      }
      const storedEEG = localStorage.getItem("movepilot_eeg_result");
      if (storedEEG) {
        setEEGResultState(JSON.parse(storedEEG));
      }
      const storedGait = localStorage.getItem("movepilot_gait_result");
      if (storedGait) {
        setGaitResultState(JSON.parse(storedGait));
      }
    } catch (e) {
      console.error("Error reading analysis results from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const setIsDemoMode = (enabled: boolean) => {
    setIsDemoModeState(enabled);
    try {
      localStorage.setItem("movepilot_demo_mode", JSON.stringify(enabled));
    } catch (e) {
      console.error("Failed to save demo mode setting", e);
    }
  };

  const setIMUResult = (result: IMUAnalysisResult | null) => {
    setIMUResultState(result);
    try {
      if (result) {
        localStorage.setItem("movepilot_imu_result", JSON.stringify(result));
      } else {
        localStorage.removeItem("movepilot_imu_result");
      }
    } catch (e) {
      console.error("Failed to persist IMU result", e);
    }
  };

  const setEEGResult = (result: EEGAnalysisResult | null) => {
    setEEGResultState(result);
    try {
      if (result) {
        localStorage.setItem("movepilot_eeg_result", JSON.stringify(result));
      } else {
        localStorage.removeItem("movepilot_eeg_result");
      }
    } catch (e) {
      console.error("Failed to persist EEG result", e);
    }
  };

  const setGaitResult = (result: GaitAnalysisResult | null) => {
    setGaitResultState(result);
    try {
      if (result) {
        localStorage.setItem("movepilot_gait_result", JSON.stringify(result));
      } else {
        localStorage.removeItem("movepilot_gait_result");
      }
    } catch (e) {
      console.error("Failed to persist Gait result", e);
    }
  };

  const clearAnalysis = () => {
    setIMUResultState(null);
    setEEGResultState(null);
    setGaitResultState(null);
    localStorage.removeItem("movepilot_imu_result");
    localStorage.removeItem("movepilot_eeg_result");
    localStorage.removeItem("movepilot_gait_result");
  };

  const resetDemoData = () => {
    clearAnalysis();
    seedDemoSessions(true);
    seedDemoDiary(true);
  };

  return (
    <AnalysisContext.Provider
      value={{
        imuResult,
        eegResult,
        gaitResult,
        isDemoMode,
        isLoaded,
        setIsDemoMode,
        setIMUResult,
        setEEGResult,
        setGaitResult,
        clearAnalysis,
        resetDemoData,
        apiUrl,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return context;
};
