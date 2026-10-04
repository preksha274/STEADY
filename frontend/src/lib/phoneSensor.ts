"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface PhoneSensorSample {
  timestamp: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface PhoneSensorConnectionState {
  status: "disconnected" | "connecting" | "connected" | "recording" | "error";
  error: string | null;
  samplesReceived: number;
  sessionId: string | null;
}

export interface PhoneSensorConnectionActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  requestPermission: () => Promise<boolean>;
}

export function usePhoneSensorConnection(
  serverUrl: string,
  onRecordingComplete?: (samples: PhoneSensorSample[]) => void
): [PhoneSensorConnectionState, PhoneSensorConnectionActions] {
  const [state, setState] = useState<PhoneSensorConnectionState>({
    status: "disconnected",
    error: null,
    samplesReceived: 0,
    sessionId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const samplesRef = useRef<PhoneSensorSample[]>([]);
  const isRecordingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessagesRef = useRef<Array<{ type: string; payload: any }>>([]);

  const getWsUrl = useCallback(() => {
    const protocol = serverUrl.startsWith("https") ? "wss" : "ws";
    const host = serverUrl.replace(/^https?:\/\//, "");
    return `${protocol}://${host}/ws/sensor`;
  }, [serverUrl]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      pendingMessagesRef.current.push(message);
    }
  }, []);

  const flushPendingMessages = useCallback(() => {
    while (pendingMessagesRef.current.length > 0) {
      const msg = pendingMessagesRef.current.shift();
      if (msg && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      } else if (msg) {
        pendingMessagesRef.current.unshift(msg);
        break;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setState((prev) => ({ ...prev, status: "connecting", error: null }));

    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, status: "connected" }));
        flushPendingMessages();

        const sessionId = `phone_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        setState((prev) => ({ ...prev, sessionId }));
        sendMessage({ type: "session_start", sessionId });
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, status: "disconnected" }));
        if (isRecordingRef.current) {
          isRecordingRef.current = false;
        }
      };

      ws.onerror = (event) => {
        setState((prev) => ({ ...prev, status: "error", error: "WebSocket connection failed" }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ack") {
            console.log("[PhoneSensor] Server ack:", msg.details);
          } else if (msg.type === "error") {
            setState((prev) => ({ ...prev, error: msg.details }));
          }
        } catch (e) {
          console.error("[PhoneSensor] Failed to parse server message:", e);
        }
      };
    } catch (e) {
      setState((prev) => ({ ...prev, status: "error", error: "Failed to create WebSocket connection" }));
    }
  }, [getWsUrl, sendMessage, flushPendingMessages]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        sendMessage({ type: "session_end", sessionId: state.sessionId });
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "disconnected", sessionId: null, samplesReceived: 0 }));
  }, [state.sessionId, sendMessage]);

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
    setState((prev) => ({ ...prev, samplesReceived: samplesRef.current.length }));

    sendMessage({
      type: "sensor_data",
      timestamp: sample.timestamp,
      accelerometer: { x: sample.ax, y: sample.ay, z: sample.az },
      gyroscope: { x: sample.gx, y: sample.gy, z: sample.gz },
    });
  }, [sendMessage]);

  const startRecording = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      setState((prev) => ({ ...prev, status: "error", error: "Motion permission denied" }));
      return;
    }

    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setState((prev) => ({ ...prev, status: "error", error: "DeviceMotion not supported" }));
      return;
    }

    samplesRef.current = [];
    isRecordingRef.current = true;
    setState((prev) => ({ ...prev, status: "recording", samplesReceived: 0 }));

    window.addEventListener("devicemotion", handleMotionEvent);
  }, [requestPermission, handleMotionEvent]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    window.removeEventListener("devicemotion", handleMotionEvent);

    const samples = samplesRef.current;
    if (samples.length > 0 && onRecordingComplete) {
      onRecordingComplete(samples);
    }

    sendMessage({ type: "session_end", sessionId: state.sessionId });
    setState((prev) => ({ ...prev, status: "connected" }));
  }, [state.sessionId, sendMessage, onRecordingComplete, handleMotionEvent]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      window.removeEventListener("devicemotion", handleMotionEvent);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [handleMotionEvent]);

  return [state, { connect, disconnect, startRecording, stopRecording, requestPermission }];
}