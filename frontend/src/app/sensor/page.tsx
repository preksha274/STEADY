"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function SensorGateway() {
  const [mounted, setMounted] = useState(false);
  const [support, setSupport] = useState<{
    hasGeneric: boolean;
    hasMotion: boolean;
    hasOrient: boolean;
    needsIosPermission: boolean;
    isSecureContext: boolean;
  }>({
    hasGeneric: false,
    hasMotion: false,
    hasOrient: false,
    needsIosPermission: false,
    isSecureContext: false,
  });

  const [permission, setPermission] = useState<"unknown" | "denied" | "granted" | "not required">("unknown");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "waiting" | "connected" | "stopped" | "unsupported">("idle");
  const [source, setSource] = useState<string>("none");
  const [accel, setAccel] = useState<{ x: number; y: number; z: number } | null>(null);
  const [gyro, setGyro] = useState<{ x: number; y: number; z: number } | null>(null);
  const [accelSource, setAccelSource] = useState("");
  const [gyroSource, setGyroSource] = useState("");
  const [streamStatus, setStreamStatus] = useState<"off" | "on" | "stale">("off");
  const [movementStatus, setMovementStatus] = useState<"none" | "hit">("none");
  const [logs, setLogs] = useState<Array<{ time: string; message: string; level: "info" | "warn" | "error" | "ok" }>>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [sampleRate, setSampleRate] = useState(0);

  const runningRef = useRef(false);
  const sourceRef = useRef<string | null>(null);
  const sensorsRef = useRef<Array<{ stop: () => void }>>([]);
  const listenersRef = useRef<Array<[EventTarget, string, EventListener]>>([]);
  const startedAtRef = useRef(0);
  const lastEventAtRef = useRef(0);
  const warnedNoDataRef = useRef(false);
  const lastRenderAtRef = useRef(0);
  const baselineRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const baselineAtRef = useRef(0);
  const moveUntilRef = useRef(0);
  const sawRotationRateRef = useRef(false);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sampleTimestampsRef = useRef<number[]>([]);

  const MOVE_THRESHOLD = 0.7;
  const MOVE_HOLD_MS = 1200;
  const EVENT_TIMEOUT_MS = 1200;
  const GENERIC_GRACE_MS = 2500;

  const log = useCallback((msg: string, level: "info" | "warn" | "error" | "ok" = "info") => {
    const time = new Date().toTimeString().slice(0, 8);
    setLogs((prev) => [
      { time, message: msg, level },
      ...prev.slice(0, 11),
    ]);
  }, []);

  const setStatus = useCallback((el: React.MutableRefObject<HTMLElement | null>, text: string, cls: string) => {
    if (el.current) {
      el.current.textContent = text;
      el.current.className = cls;
    }
  }, []);

  const fmt = useCallback((v: number | null | undefined) => {
    if (v == null || typeof v !== "number" || isNaN(v)) return "—";
    return v.toFixed(2);
  }, []);

  const addListener = useCallback((target: EventTarget, type: string, fn: EventListenerOrEventListenerObject) => {
    target.addEventListener(type, fn, { passive: true });
    listenersRef.current.push([target, type, fn as EventListener]);
  }, []);

  const clearListeners = useCallback(() => {
    listenersRef.current.forEach(([t, ty, fn]) => t.removeEventListener(ty, fn));
    listenersRef.current = [];
  }, []);

  const markEvent = useCallback(() => {
    const now = performance.now();
    lastEventAtRef.current = now;
    sampleTimestampsRef.current.push(now);
    if (sampleTimestampsRef.current.length > 100) sampleTimestampsRef.current.shift();
  }, []);

  const onAccel = useCallback((x: number, y: number, z: number, src: string) => {
    markEvent();

    if (accelSource !== src) {
      setAccelSource(src);
    }

    const now = performance.now();

    if (baselineRef.current && now - baselineAtRef.current >= 150) {
      const d = Math.sqrt(
        Math.pow(x - baselineRef.current.x, 2) +
        Math.pow(y - baselineRef.current.y, 2) +
        Math.pow(z - baselineRef.current.z, 2)
      );

      if (d >= MOVE_THRESHOLD) {
        moveUntilRef.current = now + MOVE_HOLD_MS;
      }

      baselineRef.current = { x, y, z };
      baselineAtRef.current = now;
    } else if (!baselineRef.current) {
      baselineRef.current = { x, y, z };
      baselineAtRef.current = now;
    }

    if (now - lastRenderAtRef.current > 60) {
      setAccel({ x, y, z });
      lastRenderAtRef.current = now;
    }
  }, [accelSource, markEvent]);

  const onGyro = useCallback((x: number, y: number, z: number, src: string) => {
    markEvent();

    if (gyroSource !== src) {
      setGyroSource(src);
    }

    setGyro({ x, y, z });
  }, [gyroSource, markEvent]);

  const stopGeneric = useCallback(() => {
    sensorsRef.current.forEach((s) => {
      try { s.stop(); } catch (e) {}
    });
    sensorsRef.current = [];
  }, []);

  const startGeneric = useCallback(() => {
    const { hasGeneric, isSecureContext } = support;
    if (!hasGeneric || !isSecureContext) return false;

    try {
      const AccelConstructor = (window as any).Accelerometer;
      const GyroConstructor = (window as any).Gyroscope;

      const acc = new AccelConstructor({ frequency: 60 });
      const gyro = new GyroConstructor({ frequency: 60 });

      acc.addEventListener("reading", () =>
        onAccel(acc.x, acc.y, acc.z, "Generic Accelerometer")
      );

      gyro.addEventListener("reading", () => {
        const d = 180 / Math.PI;
        onGyro(gyro.x * d, gyro.y * d, gyro.z * d, "Generic Gyroscope (rad/s → deg/s)");
      });

      const onErr = (label: string) => (e: any) => {
        const err = e?.error ? e.error : e;
        log(`${label}: ${err?.name || err}`, "error");

        if (err?.name === "NotAllowedError") {
          setPermission("denied");
        }

        if (err?.name === "SecurityError") {
          // handled by secure context check
        }

        fallbackToEvents();
      };

      acc.addEventListener("error", onErr("Accelerometer"));
      gyro.addEventListener("error", onErr("Gyroscope"));

      acc.start();
      gyro.start();

      sensorsRef.current = [acc, gyro];
      sourceRef.current = "generic";
      setSource("Generic Sensor API");
      log("Started Generic Sensor API.", "ok");

      return true;
    } catch (e: any) {
      log(`Generic Sensor API failed: ${e.message}`, "error");
      return false;
    }
  }, [support, onAccel, onGyro, log]);

  const startEvents = useCallback(() => {
    const { hasMotion, hasOrient } = support;
    if (sourceRef.current === "events") return;
    if (!hasMotion && !hasOrient) {
      log("No event-based motion API available in this browser.", "error");
      setConnectionStatus("unsupported");
      return;
    }

    const onMotion = (e: DeviceMotionEvent) => {
      const incl = e.accelerationIncludingGravity;
      const dyn = e.acceleration;

      const a =
        incl && incl.x !== null && incl.x !== undefined
          ? incl
          : dyn && dyn.x !== null && dyn.x !== undefined
          ? dyn
          : null;

      if (a) {
        onAccel(
          a.x ?? 0,
          a.y ?? 0,
          a.z ?? 0,
          incl ? "devicemotion accelerationIncludingGravity" : "devicemotion acceleration"
        );
      }

      const r = e.rotationRate;
      if (r && r.beta !== null && r.beta !== undefined) {
        sawRotationRateRef.current = true;
        onGyro(r.beta ?? 0, r.gamma ?? 0, r.alpha ?? 0, "devicemotion rotationRate");
      }
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.alpha === undefined) return;
      if (sawRotationRateRef.current) return;
      onGyro(e.beta ?? 0, e.gamma ?? 0, e.alpha ?? 0, "deviceorientation (orientation in deg, rotationRate missing)");
    };

    if (hasMotion) addListener(window, "devicemotion", onMotion as EventListener);
    if (hasOrient) addListener(window, "deviceorientation", onOrient as EventListener);

    sourceRef.current = "events";
    setSource(hasMotion ? "devicemotion / deviceorientation" : "deviceorientation");
    log("Listening to devicemotion / deviceorientation events.", "ok");
  }, [support, addListener, onAccel, onGyro, log]);

  const fallbackToEvents = useCallback(() => {
    if (sourceRef.current === "events" || !runningRef.current) return;
    stopGeneric();
    sourceRef.current = null;
    setSource("none");
    log("Falling back to event-based sensors…", "warn");
    startEvents();
  }, [stopGeneric, startEvents]);

  const updateSampleRate = useCallback(() => {
    const now = performance.now();
    const recent = sampleTimestampsRef.current.filter((t) => now - t < 1000);
    setSampleRate(recent.length);
    setSampleCount(sampleTimestampsRef.current.length);
  }, []);

  const updateIndicators = useCallback(() => {
    if (!runningRef.current) {
      setStreamStatus("off");
      setMovementStatus("none");
      setConnectionStatus("stopped");
      return;
    }

    const now = performance.now();
    const age = lastEventAtRef.current ? now - lastEventAtRef.current : Infinity;

    if (age < EVENT_TIMEOUT_MS) {
      setStreamStatus("on");
      setConnectionStatus("connected");
    } else {
      setStreamStatus(age === Infinity && now - startedAtRef.current > 3000 ? "stale" : "off");
      setConnectionStatus("waiting");

      if (!lastEventAtRef.current && !warnedNoDataRef.current && now - startedAtRef.current > 6000) {
        warnedNoDataRef.current = true;
        log("No sensor events after 6s. Check: HTTPS, permission, and that this browser supports motion sensors.", "warn");
      }
    }

    if (now < moveUntilRef.current) {
      setMovementStatus("hit");
    } else {
      setMovementStatus("none");
    }

    updateSampleRate();
  }, [updateSampleRate, log]);

  const startSensors = useCallback(async () => {
    if (runningRef.current) return;

    runningRef.current = true;
    startedAtRef.current = performance.now();
    lastEventAtRef.current = 0;
    warnedNoDataRef.current = false;
    baselineRef.current = null;
    moveUntilRef.current = 0;
    sawRotationRateRef.current = false;
    sampleTimestampsRef.current = [];
    sampleTimestampsRef.current.push(startedAtRef.current);

    setConnectionStatus("waiting");
    setAccel(null);
    setGyro(null);
    setAccelSource("waiting…");
    setGyroSource("waiting…");

    if (!support.isSecureContext) {
      log("WARNING: insecure context — expect no data on a phone.", "warn");
    }

    if (!support.hasGeneric && !support.hasMotion) {
      log("ERROR: this browser has no motion sensor API.", "error");
      setConnectionStatus("unsupported");
      runningRef.current = false;
      return;
    }

    log("Starting sensors…");

    const ok = startGeneric();
    if (!ok) startEvents();

    if (sourceRef.current === "generic") {
      graceTimerRef.current = setTimeout(() => {
        if (runningRef.current && sourceRef.current === "generic" && !lastEventAtRef.current) {
          log(`No readings from Generic Sensor API within ${GENERIC_GRACE_MS / 1000}s — trying event-based sensors instead.`, "warn");
          fallbackToEvents();
        }
      }, GENERIC_GRACE_MS);
    }
  }, [support, startGeneric, startEvents, fallbackToEvents, log]);

  const stopSensors = useCallback(() => {
    if (!runningRef.current) return;

    runningRef.current = false;

    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }

    stopGeneric();
    clearListeners();

    sourceRef.current = null;
    setSource("none");

    setConnectionStatus("stopped");
    setAccel(null);
    setGyro(null);
    setAccelSource("stopped");
    setGyroSource("stopped");

    log("Sensors stopped. Event listeners removed.");
  }, [stopGeneric, clearListeners, log]);

  const requestPermission = useCallback(async () => {
    const { needsIosPermission } = support;
    if (!needsIosPermission) {
      log("No explicit permission prompt required by this browser.");
      setPermission("not required");
      return true;
    }

    setPermission("unknown");
    log("Requesting motion permission…");

    const requests: Array<Promise<{ ok: boolean; result?: string; error?: any }>> = [];

    const safeRequest = (what: string, api: any) => {
      if (api && typeof api.requestPermission === "function") {
        try {
          requests.push(
            Promise.resolve(api.requestPermission()).then(
              (r) => ({ ok: true, result: r }),
              (e) => ({ ok: false, error: e })
            )
          );
        } catch (e) {
          log(`${what} permission request threw: ${e}`, "error");
        }
      }
    };

    safeRequest("DeviceMotion", (window as any).DeviceMotionEvent);
    safeRequest("DeviceOrientation", (window as any).DeviceOrientationEvent);

    if (requests.length === 0) {
      log("No explicit permission prompt required by this browser.");
      setPermission("not required");
      return true;
    }

    const results = await Promise.all(requests);
    const denied = results.some((x) => !x.ok || x.result === "denied");

    if (denied) {
      setPermission("denied");
      log("Motion permission denied by the user.", "error");
      return false;
    } else {
      setPermission("granted");
      log("Motion permission granted.", "ok");
      return true;
    }
  }, [support, log]);

  useEffect(() => {
    setMounted(true);

    const hasGeneric =
      typeof (window as any).Accelerometer === "function" &&
      typeof (window as any).Gyroscope === "function";
    const hasMotion = "DeviceMotionEvent" in window;
    const hasOrient = "DeviceOrientationEvent" in window;

    const needsIosPermission =
      (hasMotion && typeof (window as any).DeviceMotionEvent?.requestPermission === "function") ||
      (hasOrient && typeof (window as any).DeviceOrientationEvent?.requestPermission === "function");

    setSupport({
      hasGeneric,
      hasMotion,
      hasOrient,
      needsIosPermission,
      isSecureContext: window.isSecureContext,
    });

    const found: string[] = [];
    if (hasGeneric) found.push("Generic Sensor API");
    if (hasMotion) found.push("DeviceMotion");
    if (hasOrient) found.push("DeviceOrientation");

    if (found.length === 0) {
      log("No motion sensor API in this browser.", "error");
    } else {
      log(`Sensor APIs: ${found.join(", ")}`, "ok");
    }

    if (window.isSecureContext) {
      log("Secure context: HTTPS ✓", "ok");
    } else {
      log("Insecure context: sensors only work on https:// or localhost.", "error");
    }

    if (!hasGeneric && !hasMotion) {
      setConnectionStatus("unsupported");
    }

    if (needsIosPermission) {
      setPermission("unknown");
    } else {
      setPermission("not required");
    }

    const interval = setInterval(updateIndicators, 400);
    return () => clearInterval(interval);
  }, [log, updateIndicators]);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-8 h-8 text-[#2563EB] animate-spin mx-auto border-4 border-blue-200 border-t-transparent rounded-full" />
          <div className="text-sm font-bold text-[#172554]">Loading Sensor Gateway…</div>
          <p className="text-xs text-slate-500">Initializing phone motion sensors</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-1 text-center">
        <h1 className="text-xl font-extrabold text-[#172554] tracking-tight">STEADY Sensor Gateway</h1>
        <p className="text-xs text-[#64748B]">Live Phone Kinematics Stream</p>
      </header>

      {!support.isSecureContext && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-center gap-2">
          <span className="shrink-0">⚠</span>
          <div>
            <b>Insecure page.</b> Browsers block motion sensors over plain <code>http://</code> on a phone. 
            Open the <b>https://</b> URL instead.
          </div>
        </div>
      )}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-[#2563EB] flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center text-[10px] font-bold">1</span>
          Connection Status
        </h2>
        <ul className="space-y-2 text-xs">
          <li className="flex justify-between gap-2 py-1 border-b border-slate-100">
            <span className="text-slate-500">Sensor Support</span>
            <b className={support.hasGeneric || support.hasMotion || support.hasOrient ? "text-emerald-600" : "text-rose-600"}>
              {support.hasGeneric || support.hasMotion || support.hasOrient ? "Detected" : "Not detected"}
            </b>
          </li>
          <li className="flex justify-between gap-2 py-1 border-b border-slate-100">
            <span className="text-slate-500">Permission</span>
            <b className={
              permission === "granted" ? "text-emerald-600" :
              permission === "denied" ? "text-rose-600" :
              "text-slate-500"
            }>
              {permission === "unknown" ? "unknown" :
               permission === "denied" ? "Denied" :
               permission === "granted" ? "Granted" :
               "not required"}
            </b>
          </li>
          <li className="flex justify-between gap-2 py-1 border-b border-slate-100">
            <span className="text-slate-500">Connection</span>
            <b className={
              connectionStatus === "connected" ? "text-emerald-600" :
              connectionStatus === "waiting" ? "text-amber-600" :
              connectionStatus === "unsupported" ? "text-rose-600" :
              "text-slate-500"
            }>
              {connectionStatus === "idle" ? "Idle" :
               connectionStatus === "waiting" ? "Waiting…" :
               connectionStatus === "connected" ? "Connected" :
               connectionStatus === "stopped" ? "Stopped" :
               "Unsupported"}
            </b>
          </li>
          <li className="flex justify-between gap-2 py-1 border-b border-slate-100">
            <span className="text-slate-500">API Source</span>
            <b className={source !== "none" && source !== "waiting…" ? "text-emerald-600" : "text-slate-500"}>{source}</b>
          </li>
          <li className="flex justify-between gap-2 py-1">
            <span className="text-slate-500">Secure Context</span>
            <b className={support.isSecureContext ? "text-emerald-600" : "text-rose-600"}>
              {support.isSecureContext ? "Yes" : "No — sensors blocked"}
            </b>
          </li>
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-[#2563EB] flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center text-[10px] font-bold">2</span>
          Controls
        </h2>

        {permission === "unknown" && support.needsIosPermission && (
          <Button variant="primary" fullWidth size="lg" onClick={requestPermission} className="bg-brand-gradient">
            Enable Motion Sensors
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={runningRef.current ? "secondary" : "primary"}
            fullWidth
            size="lg"
            onClick={runningRef.current ? stopSensors : startSensors}
            disabled={runningRef.current ? false : (!support.hasGeneric && !support.hasMotion)}
            className={runningRef.current ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" : "bg-brand-gradient"}
          >
            {runningRef.current ? "Stop Live Sensor Stream" : "Start Live Sensor Stream"}
          </Button>
          <Button variant="outline" fullWidth size="lg" onClick={() => {}} disabled className="opacity-50">
            Download CSV
          </Button>
        </div>

        {permission === "denied" && (
          <p className="text-xs text-rose-600 text-center">
            Permission denied. Allow motion/sensors for this site in your browser settings, then reload.
            (iPhone: clear this site's data under Safari Settings → Advanced → Website Data.)
          </p>
        )}
        {!support.isSecureContext && runningRef.current && (
          <p className="text-xs text-amber-600 text-center">WARNING: insecure context — expect no data on a phone.</p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-[#2563EB] flex items-center gap-2">
            Accelerometer <span className="text-xs text-slate-500 font-normal">m/s²</span>
          </h2>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs font-bold">X</span>
              <b className="font-mono text-xl">{fmt(accel?.x ?? null)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs font-bold">Y</span>
              <b className="font-mono text-xl">{fmt(accel?.y ?? null)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs font-bold">Z</span>
              <b className="font-mono text-xl">{fmt(accel?.z ?? null)}</b>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">source: {accelSource || "not started"}</p>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-[#2563EB] flex items-center gap-2">
            Gyroscope <span className="text-xs text-slate-500 font-normal">deg/s</span>
          </h2>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs font-bold">X</span>
              <b className="font-mono text-xl">{fmt(gyro?.x ?? null)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs font-bold">Y</span>
              <b className="font-mono text-xl">{fmt(gyro?.y ?? null)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs font-bold">Z</span>
              <b className="font-mono text-xl">{fmt(gyro?.z ?? null)}</b>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">source: {gyroSource || "not started"}</p>
        </Card>
      </div>

      <Card className="space-y-2">
        <div className={`font-mono text-base px-2 py-1 rounded-lg text-center ${
          streamStatus === "on" ? "bg-emerald-50 text-emerald-700" :
          streamStatus === "stale" ? "bg-amber-50 text-amber-700" :
          "bg-slate-50 text-slate-500"
        }`}>
          {streamStatus === "on" ? "● Receiving sensor data" :
           streamStatus === "stale" ? "● Waiting for sensor data..." :
           runningRef.current ? "Waiting for sensor data..." : "Sensors stopped"}
        </div>
        <div className={`font-mono text-sm px-2 py-1 rounded-lg text-center ${
          movementStatus === "hit" ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-slate-50 text-slate-500"
        }`}>
          Phone movement: {movementStatus === "hit" ? "DETECTED" : "NONE (stable)"}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2">
          <span>Samples: {sampleCount}</span>
          <span>Rate: {sampleRate} Hz</span>
        </div>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway Log</h3>
        <div className="font-mono text-[10px] text-slate-500 max-h-[190px] overflow-y-auto space-y-1" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
          {logs.map((entry, i) => (
            <div key={i} className={`px-2 py-0.5 rounded ${entry.level === "error" ? "text-rose-600" : entry.level === "warn" ? "text-amber-600" : entry.level === "ok" ? "text-emerald-600" : ""}`}>
              [{entry.time}] {entry.message}
            </div>
          ))}
          {logs.length === 0 && <div className="text-center py-4 text-slate-400">No log entries yet</div>}
        </div>
      </Card>
    </div>
  );
}