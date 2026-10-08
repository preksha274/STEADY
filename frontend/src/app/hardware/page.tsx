"use client";
import { useSensorStream } from "./useSensorStream";

const pts = (d: number[], lo: number, hi: number) =>
    d.map((v, i) => `${(i / (d.length - 1 || 1)) * 600},${100 - ((v - lo) / (hi - lo)) * 100}`).join(" ");

export default function Page() {
    const { data, live } = useSensorStream();
    const last = data[data.length - 1];
    return (
        <main style={{ padding: 20 }}>
            <h1>Live wrist data {live ? "🟢" : "🔴"}</h1>
            {last && <p>Tremor: {last.t ? "YES" : "no"} · strength {last.rms} g · {last.f} Hz</p>}
            <svg viewBox="0 0 600 100" style={{ width: "100%", background: "#111" }}>
                <polyline fill="none" stroke="#4cc2ff" points={pts(data.map(d => d.rms), 0, 0.15)} />
            </svg>
        </main>
    );
}