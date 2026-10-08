"use client";
import { useEffect, useState } from "react";

export type Sample = {
    x: number; y: number; z: number; hp: number; rms: number;
    f: number; t: number; b: number; v: number
};

export function useSensorStream(url = "ws://127.0.0.1:8000/ws/sensor", max = 500) {
    const [data, setData] = useState<Sample[]>([]);
    const [live, setLive] = useState(false);
    useEffect(() => {
        let ws: WebSocket; let stop = false;
        const connect = () => {
            ws = new WebSocket(url);
            ws.onopen = () => setLive(true);
            ws.onclose = () => { setLive(false); if (!stop) setTimeout(connect, 1500); };
            ws.onmessage = (e) => {
                const batch: Sample[] = JSON.parse(e.data);
                setData((p) => [...p, ...batch].slice(-max));
            };
        };
        connect();
        return () => { stop = true; ws.close(); };
    }, [url, max]);
    return { data, live };
}