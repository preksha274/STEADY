"use client";

export interface DataGapReason {
  id: string;
  reason: "band_not_worn" | "battery_low" | "ble_disconnect" | "poor_lighting" | "noisy_room";
  label: string;
  count: number;
  pct: number;
  remedy: string;
}

export interface DataHealthSummary {
  usableDaysCount: number;
  totalDaysLogged: number;
  usablePercentage: number;
  gapReasons: DataGapReason[];
  isOfflineBuffered: boolean;
  bufferedRecordsCount: number;
  bandBatteryPct: number;
  isBandConnected: boolean;
  isLightMode: boolean;
  burdenScore?: number; // 1-5
  guardianGpsEnabled: boolean;
  guardianSymptomSync: boolean;
}

const DATA_HEALTH_STORAGE_KEY = "steady_data_health_settings";

export function getDataHealthSummary(isDemoMode: boolean = true): DataHealthSummary {
  if (typeof window === "undefined") {
    return getDefaultHealthSummary();
  }

  try {
    const raw = localStorage.getItem(DATA_HEALTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...getDefaultHealthSummary(),
        ...parsed,
      };
    }
  } catch (e) {
    console.error("Could not read data health settings", e);
  }

  return getDefaultHealthSummary();
}

export function saveDataHealthSummary(summary: Partial<DataHealthSummary>): DataHealthSummary {
  const current = getDataHealthSummary();
  const updated = { ...current, ...summary };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DATA_HEALTH_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Could not save data health settings", e);
    }
  }
  return updated;
}

function getDefaultHealthSummary(): DataHealthSummary {
  return {
    usableDaysCount: 19,
    totalDaysLogged: 21,
    usablePercentage: 90.5,
    gapReasons: [
      { id: "1", reason: "band_not_worn", label: "Band not worn during movement", count: 4, pct: 40.0, remedy: "Put on wearable band before morning walk" },
      { id: "2", reason: "battery_low", label: "Wearable battery low (<15%)", count: 3, pct: 30.0, remedy: "Charge band overnight on magnetic dock" },
      { id: "3", reason: "ble_disconnect", label: "Bluetooth connection dropped", count: 2, pct: 20.0, remedy: "Tap one-touch reconnect button below" },
      { id: "4", reason: "poor_lighting", label: "Camera view too dim for video check", count: 1, pct: 10.0, remedy: "Ensure room light or lamp is facing you" },
    ],
    isOfflineBuffered: true,
    bufferedRecordsCount: 14,
    bandBatteryPct: 82,
    isBandConnected: true,
    isLightMode: false,
    burdenScore: 2, // 1-5 scale (2 = Low effort)
    guardianGpsEnabled: false, // explicit consent off by default
    guardianSymptomSync: false,
  };
}
