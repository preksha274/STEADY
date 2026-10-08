"use client";

import { IMUPacket, ConnectionHealth } from "./sensorSource";

export interface HapticCommand {
  intensity: "low" | "medium" | "high";
  duration_ms: number;
  pattern: "pulse" | "metronome" | "continuous";
}

export interface BandTelemetry {
  batteryPct: number;
  firmwareVersion: string;
  hardwareModel: string;
  packetLossCount: number;
  outOfOrderCount: number;
  estimatedSampleRateHz: number;
  lastSampleAgeMs: number;
  pps: number;
}

// Steady Band Hardware Protocol & Firmware Spec
export const STEADY_BAND_SPEC = {
  transport: "Web Bluetooth GATT | WebSocket",
  gatt: {
    serviceUuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
    imuCharUuid: "0000ffe1-0000-1000-8000-00805f9b34fb", // Notify (Batched 100Hz IMU)
    hapticCharUuid: "0000ffe2-0000-1000-8000-00805f9b34fb", // Write (Vibration Motor)
    batteryCharUuid: "00002a19-0000-1000-8000-00805f9b34fb", // Read/Notify (Battery %)
  },
  websocketUrl: "ws://localhost:8080/steady-band",
  packetSpec: {
    format: "<timestamp_ms (uint32), ax (int16), ay (int16), az (int16), gx (int16), gy (int16), gz (int16)>",
    endianness: "little-endian",
    accelScale: "16384.0 LSB/g",
    gyroScale: "131.0 LSB/(deg/s)",
    nominalHz: 100,
    batchSize: 5,
  },
};

/**
 * Parses raw little-endian batched binary IMU packet into standard IMUPackets.
 * Binary Spec per sample (16 bytes):
 * - timestamp_ms: uint32 (4 bytes, little-endian)
 * - ax, ay, az: int16 (6 bytes, scale /16384.0 -> g, little-endian)
 * - gx, gy, gz: int16 (6 bytes, scale /131.0 -> deg/s, little-endian)
 */
export function parseBandBinaryPacket(
  buffer: ArrayBufferLike,
  lastKnownTs: number = 0
): {
  packets: IMUPacket[];
  packetLoss: boolean;
  outOfOrder: boolean;
  latestTs: number;
  sampleDeltas: number[];
} {
  const view = new DataView(buffer);
  const packets: IMUPacket[] = [];
  let packetLoss = false;
  let outOfOrder = false;
  const sampleDeltas: number[] = [];

  const sampleSize = 16;
  const numSamples = Math.floor(buffer.byteLength / sampleSize);

  let currentTs = lastKnownTs;

  for (let i = 0; i < numSamples; i++) {
    const offset = i * sampleSize;
    const timestamp_ms = view.getUint32(offset, true);
    const rawAx = view.getInt16(offset + 4, true);
    const rawAy = view.getInt16(offset + 6, true);
    const rawAz = view.getInt16(offset + 8, true);
    const rawGx = view.getInt16(offset + 10, true);
    const rawGy = view.getInt16(offset + 12, true);
    const rawGz = view.getInt16(offset + 14, true);

    // Unit conversion to g and deg/s
    const ax = rawAx / 16384.0;
    const ay = rawAy / 16384.0;
    const az = rawAz / 16384.0;
    const gx = rawGx / 131.0;
    const gy = rawGy / 131.0;
    const gz = rawGz / 131.0;

    if (currentTs > 0) {
      const dt = timestamp_ms - currentTs;
      sampleDeltas.push(dt);
      if (dt < 0) outOfOrder = true;
      if (dt > 25) packetLoss = true; // Nominal 100 Hz = 10 ms interval; > 25 ms indicates dropped sample
    }
    currentTs = timestamp_ms;

    packets.push({
      timestamp: timestamp_ms,
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      source: "band",
    });
  }

  return { packets, packetLoss, outOfOrder, latestTs: currentTs, sampleDeltas };
}

/**
 * Creates synthetic binary packet batch matching exact firmware little-endian spec
 * for testing the adapter before hardware arrives.
 */
export function createMockBinaryPacketBatch(
  startTimestampMs: number,
  numSamples: number = 5,
  stepIndex: number = 0
): ArrayBuffer {
  const sampleSize = 16;
  const buffer = new ArrayBuffer(numSamples * sampleSize);
  const view = new DataView(buffer);

  const freq = 4.8; // Simulated tremor frequency in Hz
  const sampleIntervalMs = 10; // 100 Hz nominal

  for (let i = 0; i < numSamples; i++) {
    const offset = i * sampleSize;
    const ts = startTimestampMs + i * sampleIntervalMs;
    const t = (stepIndex * numSamples + i) / 100.0;

    // Simulated tremor + gravity
    const axG = 0.18 * Math.sin(2 * Math.PI * freq * t);
    const ayG = 0.18 * Math.cos(2 * Math.PI * freq * t);
    const azG = 9.81 + 0.05 * Math.sin(2 * Math.PI * freq * t);

    const gxDeg = 25.0 * Math.sin(2 * Math.PI * freq * t);
    const gyDeg = 25.0 * Math.cos(2 * Math.PI * freq * t);
    const gzDeg = 5.0;

    // Scale to raw LSBs (little-endian int16)
    const rawAx = Math.round(axG * 16384.0);
    const rawAy = Math.round(ayG * 16384.0);
    const rawAz = Math.round(azG * 16384.0);
    const rawGx = Math.round(gxDeg * 131.0);
    const rawGy = Math.round(gyDeg * 131.0);
    const rawGz = Math.round(gzDeg * 131.0);

    view.setUint32(offset, ts, true);
    view.setInt16(offset + 4, rawAx, true);
    view.setInt16(offset + 6, rawAy, true);
    view.setInt16(offset + 8, rawAz, true);
    view.setInt16(offset + 10, rawGx, true);
    view.setInt16(offset + 12, rawGy, true);
    view.setInt16(offset + 14, rawGz, true);
  }

  return buffer;
}

/**
 * Steady Band Hardware Adapter with Auto-Reconnect Exponential Backoff & Connection Health
 */
export class SteadyBandAdapter {
  private gattDevice: any = null;
  private gattServer: any = null;
  private hapticChar: any = null;
  private webSocket: WebSocket | null = null;

  private isConnected: boolean = false;
  private isMockMode: boolean = false;
  private reconnectAttempt: number = 0;
  private maxReconnectBackoffMs: number = 16000;
  private backoffTimer: any = null;

  private lastKnownTimestamp: number = 0;
  private ppsCounter: number = 0;
  private currentPps: number = 0;
  private recentDeltas: number[] = [];

  private telemetry: BandTelemetry = {
    batteryPct: 92,
    firmwareVersion: "v2.1.4-steady",
    hardwareModel: "SteadyBand-Pro-v2",
    packetLossCount: 0,
    outOfOrderCount: 0,
    estimatedSampleRateHz: 100,
    lastSampleAgeMs: 0,
    pps: 100,
  };

  private packetCallback: ((packet: IMUPacket) => void) | null = null;
  private mockTimer: any = null;
  private ppsTimer: any = null;

  constructor() {
    this.startPpsMonitoring();
  }

  public onPacket(callback: (packet: IMUPacket) => void): void {
    this.packetCallback = callback;
  }

  private startPpsMonitoring(): void {
    if (typeof window === "undefined") return;
    this.ppsTimer = setInterval(() => {
      this.currentPps = this.ppsCounter;
      this.ppsCounter = 0;
      this.telemetry.pps = this.currentPps;

      // Estimate real sample rate from timestamp deltas
      if (this.recentDeltas.length > 0) {
        const avgDt = this.recentDeltas.reduce((a, b) => a + b, 0) / this.recentDeltas.length;
        if (avgDt > 0) {
          this.telemetry.estimatedSampleRateHz = Math.round(1000 / avgDt);
        }
      }
      this.telemetry.lastSampleAgeMs = Math.max(0, Date.now() - (this.lastKnownTimestamp || Date.now()));
    }, 1000);
  }

  /**
   * Connect to physical Web Bluetooth GATT device
   */
  public async connectBLE(): Promise<boolean> {
    if (typeof window === "undefined" || !("bluetooth" in navigator)) {
      console.warn("[SteadyBand] Web Bluetooth unavailable, falling back to Mock Band");
      return this.startMockBand();
    }

    try {
      this.gattDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [STEADY_BAND_SPEC.gatt.serviceUuid] }],
        optionalServices: [STEADY_BAND_SPEC.gatt.serviceUuid, "battery_service"],
      });

      this.gattDevice.addEventListener("gattserverdisconnected", () => this.handleDisconnect());
      this.gattServer = await this.gattDevice.gatt.connect();

      const service = await this.gattServer.getPrimaryService(STEADY_BAND_SPEC.gatt.serviceUuid);
      const imuChar = await service.getCharacteristic(STEADY_BAND_SPEC.gatt.imuCharUuid);
      this.hapticChar = await service.getCharacteristic(STEADY_BAND_SPEC.gatt.hapticCharUuid);

      await imuChar.startNotifications();
      imuChar.addEventListener("characteristicvaluechanged", (e: any) => {
        const value: DataView = e.target.value;
        this.processIncomingBinaryBuffer(value.buffer);
      });

      this.isConnected = true;
      this.isMockMode = false;
      this.reconnectAttempt = 0;
      return true;
    } catch (e) {
      console.warn("[SteadyBand] BLE connection failed or cancelled. Starting Mock Band.", e);
      return this.startMockBand();
    }
  }

  /**
   * Connect to Steady Band WebSocket server endpoint (alternative transport)
   */
  public connectWebSocket(url: string = STEADY_BAND_SPEC.websocketUrl): boolean {
    if (typeof window === "undefined") return false;

    try {
      this.stop();
      this.webSocket = new WebSocket(url);
      this.webSocket.binaryType = "arraybuffer";

      this.webSocket.onopen = () => {
        console.log(`[SteadyBand WS] Connected to ${url}`);
        this.isConnected = true;
        this.isMockMode = false;
        this.reconnectAttempt = 0;
      };

      this.webSocket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.processIncomingBinaryBuffer(event.data);
        }
      };

      this.webSocket.onclose = () => {
        console.warn("[SteadyBand WS] WebSocket closed");
        this.handleDisconnect();
      };

      return true;
    } catch (e) {
      console.error("[SteadyBand WS] Connection failed", e);
      return this.startMockBand();
    }
  }

  /**
   * Start Mock Band Hardware Simulator emitting 100 Hz batched binary packets from synthetic recording
   */
  public startMockBand(): boolean {
    this.stop();
    this.isMockMode = true;
    this.isConnected = true;
    this.telemetry.batteryPct = 94;
    this.telemetry.firmwareVersion = "v2.1.4-steady-mock";

    let stepIndex = 0;
    const batchIntervalMs = 50; // Emits 5 samples (50ms worth of 100Hz data) every 50ms
    const numSamplesPerBatch = 5;

    this.mockTimer = setInterval(() => {
      stepIndex++;
      const now = Date.now();
      const startTs = now - numSamplesPerBatch * 10;

      // Create binary ArrayBuffer matching exact firmware spec
      const buffer = createMockBinaryPacketBatch(startTs, numSamplesPerBatch, stepIndex);
      this.processIncomingBinaryBuffer(buffer);
    }, batchIntervalMs);

    return true;
  }

  /**
   * Process raw little-endian binary packet buffer, converting units and updating telemetry
   */
  private processIncomingBinaryBuffer(buffer: ArrayBufferLike): void {
    const parsed = parseBandBinaryPacket(buffer, this.lastKnownTimestamp);
    if (parsed.packetLoss) this.telemetry.packetLossCount++;
    if (parsed.outOfOrder) this.telemetry.outOfOrderCount++;

    if (parsed.latestTs > 0) {
      this.lastKnownTimestamp = parsed.latestTs;
    }

    if (parsed.sampleDeltas.length > 0) {
      this.recentDeltas.push(...parsed.sampleDeltas);
      if (this.recentDeltas.length > 50) {
        this.recentDeltas.splice(0, this.recentDeltas.length - 50);
      }
    }

    this.ppsCounter += parsed.packets.length;

    parsed.packets.forEach((pkt) => {
      if (this.packetCallback) this.packetCallback(pkt);
    });
  }

  /**
   * Write haptic command to band motor
   */
  public async sendHapticCommand(cmd: HapticCommand): Promise<boolean> {
    if (!this.isConnected) return false;

    console.log(`[SteadyBand Motor] Haptic cue dispatched: intensity=${cmd.intensity}, duration=${cmd.duration_ms}ms, pattern=${cmd.pattern}`);

    if (this.isMockMode) {
      return true; // Mock band acknowledges vibration command execution
    }

    if (this.hapticChar) {
      try {
        const payload = JSON.stringify(cmd);
        const encoder = new TextEncoder();
        await this.hapticChar.writeValue(encoder.encode(payload));
        return true;
      } catch (e) {
        console.error("Failed writing to band haptic characteristic", e);
        return false;
      }
    }
    return false;
  }

  /**
   * Handle unexpected disconnect with exponential backoff auto-reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.reconnectAttempt++;

    const backoffMs = Math.min(
      this.maxReconnectBackoffMs,
      Math.pow(2, this.reconnectAttempt - 1) * 1000
    );

    console.log(`[SteadyBand] Disconnected. Reconnecting in ${backoffMs}ms (Attempt #${this.reconnectAttempt})...`);

    this.backoffTimer = setTimeout(() => {
      if (!this.isMockMode) {
        this.connectBLE();
      }
    }, backoffMs);
  }

  public getTelemetry(): BandTelemetry {
    return { ...this.telemetry };
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsMockMode(): boolean {
    return this.isMockMode;
  }

  public stop(): void {
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
    if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    this.isConnected = false;
  }
}

export const steadyBandAdapter = new SteadyBandAdapter();

