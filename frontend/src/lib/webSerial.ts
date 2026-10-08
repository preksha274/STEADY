"use client";

/**
 * STEADY Band Web Serial API Manager
 * Protocol: 115200 baud
 * Incoming JSON Line:
 *   {"t":ms,"x":g,"y":g,"z":g,"hp":g,"rms":g,"freq":Hz,"tremor":0|1,"alert":0|1,"btn":0|1}
 */

export const STEADY_BAND_BAUD_RATE = 115200;

export interface SteadyBandSample {
  ms: number;
  ax: number;
  ay: number;
  az: number;
  hp: number;
  rms: number;
  freq: number;
  tremor: number; // 0 or 1
  alert: number;  // 0 or 1
  btn: number;    // 0 or 1
  state: number;  // 0=normal, 1=vibrating, 2=cooldown, 3=button
  drops: number;
  receivedAt: number;
}

export interface SteadyBandHello {
  firmwareVersion: string;
  sampleRateHz: number;
  accelRangeG: number;
}

export interface ConnectionHealth {
  samplesPerSec: number;
  lastSampleAgeMs: number;
  dropsCount: number;
  malformedCount: number;
  totalSamples: number;
  firmware: SteadyBandHello | null;
  baudRate: number;
}

export type SerialState =
  | "unsupported"
  | "disconnected"
  | "connecting"
  | "connected"
  | "port_busy"
  | "legacy_format"
  | "error";

export type ParseResult =
  | { type: "sample"; sample: SteadyBandSample }
  | { type: "legacy_text"; message: string }
  | { type: "hello"; hello: SteadyBandHello }
  | { type: "ack"; ack: string }
  | { type: "comment"; text: string }
  | { type: "drop"; reason: string; raw: string };

/**
 * Pure parsing function for testing and stream decoding.
 */
export function parseBandLine(rawLine: string, currentDrops = 0): ParseResult {
  const line = rawLine.trim();
  if (!line) {
    return { type: "drop", reason: "empty line", raw: rawLine };
  }

  // 1. Check for legacy plain text format (e.g., x=-240 y=-24 z=16000 or x=1.0, y=2.0)
  if (
    !line.startsWith("{") &&
    (/x\s*=\s*-?\d+/i.test(line) ||
      (/x=/i.test(line) && /y=/i.test(line) && /z=/i.test(line)) ||
      /^ax\s*=\s*-?\d+/i.test(line))
  ) {
    return {
      type: "legacy_text",
      message: "Old text format: upload the JSON firmware",
    };
  }

  // 2. Check for JSON line: {"t":ms,"x":g,"y":g,"z":g,"hp":g,"rms":g,"freq":Hz,"tremor":0|1,"alert":0|1,"btn":0|1}
  if (line.startsWith("{") && line.endsWith("}")) {
    try {
      const obj = JSON.parse(line);
      const t = typeof obj.t === "number" ? obj.t : typeof obj.t_ms === "number" ? obj.t_ms : typeof obj.ms === "number" ? obj.ms : null;
      const x = typeof obj.x === "number" ? obj.x : typeof obj.ax === "number" ? obj.ax : null;
      const y = typeof obj.y === "number" ? obj.y : typeof obj.ay === "number" ? obj.ay : null;
      const z = typeof obj.z === "number" ? obj.z : typeof obj.az === "number" ? obj.az : null;

      if (t !== null && x !== null && y !== null && z !== null) {
        const hp = typeof obj.hp === "number" ? obj.hp : typeof obj.motion === "number" ? obj.motion : 0;
        const rms = typeof obj.rms === "number" ? obj.rms : typeof obj.tremor_strength === "number" ? obj.tremor_strength : 0;
        const freq = typeof obj.freq === "number" ? obj.freq : typeof obj.tremor_frequency === "number" ? obj.tremor_frequency : 0;
        const tremor = obj.tremor ? 1 : 0;
        const alert = obj.alert ? 1 : 0;
        const btn = obj.btn ? 1 : 0;

        const state = alert ? 1 : btn ? 3 : 0;

        return {
          type: "sample",
          sample: {
            ms: t,
            ax: x,
            ay: y,
            az: z,
            hp,
            rms,
            freq,
            tremor,
            alert,
            btn,
            state,
            drops: currentDrops,
            receivedAt: Date.now(),
          },
        };
      }
    } catch {
      return { type: "drop", reason: "invalid JSON", raw: rawLine };
    }
  }

  // 3. Comments, boot banners, greetings
  if (
    line.startsWith("#") ||
    line.startsWith("Ready") ||
    line.startsWith("Booting") ||
    line.startsWith("Steady") ||
    line.startsWith("ESP-ROM")
  ) {
    return { type: "comment", text: line };
  }

  // 4. Hello Banner: H,<fw>,<rate>,<range>
  if (line.startsWith("H,")) {
    const parts = line.split(",");
    if (parts.length >= 4) {
      return {
        type: "hello",
        hello: {
          firmwareVersion: parts[1].trim(),
          sampleRateHz: parseFloat(parts[2]) || 10,
          accelRangeG: parseFloat(parts[3]) || 2.0,
        },
      };
    }
  }

  // 5. Command Ack: A,<cmd>
  if (line.startsWith("A,")) {
    return { type: "ack", ack: line };
  }

  // 6. Legacy CSV S line fallback: S,<ms>,<ax>,<ay>,<az>,<hp>,<rms>,<freq>,<tremor>,<state>,<drops>
  if (line.startsWith("S,")) {
    const parts = line.split(",");
    if (parts.length >= 11) {
      const ms = parseInt(parts[1], 10);
      const ax = parseFloat(parts[2]);
      const ay = parseFloat(parts[3]);
      const az = parseFloat(parts[4]);
      const hp = parseFloat(parts[5]);
      const rms = parseFloat(parts[6]);
      const freq = parseFloat(parts[7]);
      const tremor = parseInt(parts[8], 10);
      const state = parseInt(parts[9], 10);
      const drops = parseInt(parts[10], 10);

      if (!isNaN(ms) && !isNaN(ax) && !isNaN(ay) && !isNaN(az)) {
        return {
          type: "sample",
          sample: {
            ms,
            ax,
            ay,
            az,
            hp: isNaN(hp) ? 0 : hp,
            rms: isNaN(rms) ? 0 : rms,
            freq: isNaN(freq) ? 0 : freq,
            tremor: tremor === 1 ? 1 : 0,
            alert: state === 1 ? 1 : 0,
            btn: state === 3 ? 1 : 0,
            state: isNaN(state) ? 0 : state,
            drops: isNaN(drops) ? currentDrops : drops,
            receivedAt: Date.now(),
          },
        };
      }
    }
  }

  return { type: "drop", reason: "unrecognized line format", raw: rawLine };
}

export class WebSerialManager {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private keepReading: boolean = false;
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  private sampleListeners: Set<(sample: SteadyBandSample) => void> = new Set();
  private batchListeners: Set<(batch: SteadyBandSample[]) => void> = new Set();
  private statusListeners: Set<(state: SerialState, errorMsg?: string) => void> = new Set();
  private healthListeners: Set<(health: ConnectionHealth) => void> = new Set();
  private ackListeners: Set<(ack: string) => void> = new Set();

  private pendingBatch: SteadyBandSample[] = [];
  private batchTimer: any = null;
  private healthTimer: any = null;

  private state: SerialState = "disconnected";
  private errorMessage: string = "";
  private firmware: SteadyBandHello | null = null;
  private dropsCounter: number = 0;
  private malformedCounter: number = 0;
  private totalSampleCounter: number = 0;
  private samplesInLastSecond: number = 0;
  private liveSamplesPerSec: number = 0;
  private lastSampleTime: number = 0;

  constructor() {
    if (typeof window !== "undefined" && "navigator" in window) {
      if (!("serial" in navigator)) {
        this.state = "unsupported";
        this.errorMessage = "Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.";
      } else {
        (navigator as any).serial.addEventListener("disconnect", (e: any) => {
          if (this.port && e.port === this.port) {
            this.handleUnplug();
          }
        });

        // Clean port release on tab close or page navigation
        window.addEventListener("beforeunload", () => {
          this.disconnectSync();
        });
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== "undefined" && "serial" in navigator;
  }

  public getState(): SerialState {
    return this.state;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public onSample(cb: (sample: SteadyBandSample) => void): () => void {
    this.sampleListeners.add(cb);
    return () => this.sampleListeners.delete(cb);
  }

  public onBatch(cb: (batch: SteadyBandSample[]) => void): () => void {
    this.batchListeners.add(cb);
    return () => this.batchListeners.delete(cb);
  }

  public onStatusChange(cb: (state: SerialState, errorMsg?: string) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public onHealth(cb: (health: ConnectionHealth) => void): () => void {
    this.healthListeners.add(cb);
    return () => this.healthListeners.delete(cb);
  }

  public onAck(cb: (ack: string) => void): () => void {
    this.ackListeners.add(cb);
    return () => this.ackListeners.delete(cb);
  }

  private setStatus(state: SerialState, errorMsg: string = "") {
    this.state = state;
    this.errorMessage = errorMsg;
    this.statusListeners.forEach((cb) => cb(state, errorMsg));
  }

  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.setStatus("unsupported", "Web Serial API is not supported. Use Chrome or Edge.");
      return false;
    }

    try {
      this.setStatus("connecting");
      // Prompt user for port
      this.port = await (navigator as any).serial.requestPort();

      // Open at 115200 baud matching firmware
      await this.port.open({
        baudRate: STEADY_BAND_BAUD_RATE,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        bufferSize: 16384,
      });

      this.keepReading = true;
      this.startHealthTimer();
      this.startBatchTimer();
      this.setStatus("connected");

      // Start asynchronous non-blocking stream reader
      this.readStreamLoop();
      return true;
    } catch (err: any) {
      console.error("[WebSerial] Connection failed", err);
      if (err.name === "NotFoundError") {
        this.setStatus("disconnected", "No port selected.");
      } else if (
        err.name === "NetworkError" ||
        err.message?.includes("Failed to open") ||
        err.message?.includes("busy") ||
        err.message?.includes("in use")
      ) {
        this.setStatus(
          "port_busy",
          "Close the Arduino Serial Monitor/Plotter, close other browser tabs using the band, stop the Steady backend if it started with SERIAL_PORT, then unplug and replug the USB cable."
        );
      } else {
        this.setStatus("error", err.message || "Failed to open serial port.");
      }
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.keepReading = false;
    if (this.batchTimer) clearInterval(this.batchTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);

    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (e) {
      console.warn("[WebSerial] Disconnect warning", e);
    } finally {
      this.setStatus("disconnected");
    }
  }

  private disconnectSync(): void {
    this.keepReading = false;
    if (this.batchTimer) clearInterval(this.batchTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);

    try {
      if (this.reader) {
        this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (_) {}
  }

  private handleUnplug(): void {
    console.warn("[WebSerial] Device unplugged");
    this.disconnect();
    this.setStatus("disconnected", "Steady Band was disconnected. Plug it back in and click Connect.");
  }

  private startHealthTimer() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = setInterval(() => {
      this.liveSamplesPerSec = this.samplesInLastSecond;
      this.samplesInLastSecond = 0;

      const now = Date.now();
      const age = this.lastSampleTime > 0 ? now - this.lastSampleTime : 0;

      const health: ConnectionHealth = {
        samplesPerSec: this.liveSamplesPerSec,
        lastSampleAgeMs: age,
        dropsCount: this.dropsCounter,
        malformedCount: this.malformedCounter,
        totalSamples: this.totalSampleCounter,
        firmware: this.firmware,
        baudRate: STEADY_BAND_BAUD_RATE,
      };

      this.healthListeners.forEach((cb) => cb(health));
    }, 1000);
  }

  private startBatchTimer() {
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.batchTimer = setInterval(() => {
      if (this.pendingBatch.length > 0) {
        const batchCopy = [...this.pendingBatch];
        this.pendingBatch = [];
        this.batchListeners.forEach((cb) => cb(batchCopy));
      }
    }, 250); // ~250ms batching interval
  }

  private async readStreamLoop() {
    let lineBuffer = "";

    while (this.port && this.port.readable && this.keepReading) {
      try {
        this.reader = this.port.readable.getReader();
        while (this.keepReading) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            const chunk = this.textDecoder.decode(value, { stream: true });
            lineBuffer += chunk;

            let newlineIdx = lineBuffer.indexOf("\n");
            while (newlineIdx !== -1) {
              const rawLine = lineBuffer.slice(0, newlineIdx).trim();
              lineBuffer = lineBuffer.slice(newlineIdx + 1);
              if (rawLine.length > 0) {
                this.handleLine(rawLine);
              }
              newlineIdx = lineBuffer.indexOf("\n");
            }
          }
        }
      } catch (err: any) {
        if (this.keepReading) {
          console.error("[WebSerial] Read error:", err);
          this.setStatus("error", "Serial stream read error: " + err.message);
        }
        break;
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch (_) {}
          this.reader = null;
        }
      }
    }
  }

  private handleLine(rawLine: string) {
    const result = parseBandLine(rawLine, this.dropsCounter);

    switch (result.type) {
      case "sample": {
        const sample = result.sample;
        this.totalSampleCounter++;
        this.samplesInLastSecond++;
        this.lastSampleTime = Date.now();

        this.pendingBatch.push(sample);
        this.sampleListeners.forEach((cb) => cb(sample));
        break;
      }
      case "legacy_text": {
        this.setStatus("legacy_format", result.message);
        break;
      }
      case "hello": {
        this.firmware = result.hello;
        break;
      }
      case "ack": {
        this.ackListeners.forEach((cb) => cb(result.ack));
        break;
      }
      case "comment": {
        break;
      }
      case "drop": {
        this.dropsCounter++;
        this.malformedCounter++;
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Outgoing Commands
  // ---------------------------------------------------------------------------
  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this.port || !this.port.writable) {
      console.warn("[WebSerial] Cannot send command: port not writable");
      return false;
    }

    try {
      const writer = this.port.writable.getWriter();
      const payload = cmd.endsWith("\n") ? cmd : cmd + "\n";
      await writer.write(this.textEncoder.encode(payload));
      writer.releaseLock();
      return true;
    } catch (err) {
      console.error("[WebSerial] Send command error", err);
      return false;
    }
  }

  public async sendVibration(
    durationMs: number = 1500,
    intensity: number = 200,
    pulseMs: number = 0
  ): Promise<boolean> {
    const cappedDuration = Math.min(5000, Math.max(100, Math.round(durationMs)));
    const cappedIntensity = Math.min(255, Math.max(0, Math.round(intensity)));
    const cappedPulse = Math.max(0, Math.round(pulseMs));

    return this.sendCommand(`V,${cappedDuration},${cappedIntensity},${cappedPulse}`);
  }

  public async cancelVibration(): Promise<boolean> {
    return this.sendCommand("X");
  }

  public async sendThresholdConfig(
    rms: number,
    fmin: number = 3.0,
    fmax: number = 8.0,
    sustainedMs: number = 1500
  ): Promise<boolean> {
    const r = rms.toFixed(3);
    const f1 = fmin.toFixed(2);
    const f2 = fmax.toFixed(2);
    const sMs = Math.max(100, Math.round(sustainedMs));
    return this.sendCommand(`C,${r},${f1},${f2},${sMs}`);
  }

  public async sendPing(): Promise<boolean> {
    return this.sendCommand("P");
  }
}

// Global Singleton instance
let globalManager: WebSerialManager | null = null;
export function getWebSerialManager(): WebSerialManager {
  if (!globalManager) {
    globalManager = new WebSerialManager();
  }
  return globalManager;
}
