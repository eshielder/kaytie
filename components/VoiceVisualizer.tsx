"use client";

import { useEffect, useRef } from "react";
import type { SessionState } from "@/types/voice";

interface VoiceVisualizerProps {
  state: SessionState;
  /** Returns an AnalyserNode for the active audio source, or null. */
  getAnalyser: () => AnalyserNode | null;
}

/**
 * Animated circular voice indicator. Pulses gently when idle, and reacts to
 * real audio amplitude from the microphone (listening) or KT's speech
 * (speaking) via the Web Audio AnalyserNode.
 */
export default function VoiceVisualizer({ state, getAnalyser }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const getAnalyserRef = useRef(getAnalyser);

  useEffect(() => {
    stateRef.current = state;
    getAnalyserRef.current = getAnalyser;
  }, [state, getAnalyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.3;
      const s = stateRef.current;

      let level = 0;
      const analyser = getAnalyserRef.current();
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        if (s === "speaking") {
          analyser.getByteFrequencyData(data);
        } else {
          analyser.getByteTimeDomainData(data);
        }
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = s === "speaking" ? data[i] / 255 : Math.abs(data[i] - 128) / 128;
          sum += v * v;
        }
        level = Math.min(1, Math.sqrt(sum / data.length) * 2.2);
      }

      // Ambient animation for idle/thinking/error states.
      const ambient =
        s === "idle" ? 0.05 : s === "thinking" ? 0.12 : s === "error" ? 0.04 : 0;
      const pulse = ambient + Math.sin(t * 0.05) * ambient * 0.6;
      const r = baseR * (1 + pulse + (s === "speaking" || s === "listening" ? level * 0.35 : 0));
      t++;

      // Outer glow rings
      const rings = s === "speaking" ? 3 : 2;
      for (let i = rings; i >= 1; i--) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + i * 14 + Math.sin(t * 0.03 + i) * 4, 0, Math.PI * 2);
        const alpha = s === "error" ? 0.06 : 0.14 - i * 0.03;
        const grad = ctx.createRadialGradient(cx, cy, r, cx, cy, r + i * 20);
        if (s === "error") {
          grad.addColorStop(0, `rgba(244,63,94,${alpha + 0.1})`);
          grad.addColorStop(1, "rgba(244,63,94,0)");
        } else {
          grad.addColorStop(0, `rgba(139,92,246,${alpha + 0.1})`);
          grad.addColorStop(1, "rgba(56,189,248,0)");
        }
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core orb
      const core = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      if (s === "error") {
        core.addColorStop(0, "#f43f5e");
        core.addColorStop(1, "#fb7185");
      } else if (s === "speaking") {
        core.addColorStop(0, "#a78bfa");
        core.addColorStop(1, "#38bdf8");
      } else {
        core.addColorStop(0, "#8b5cf6");
        core.addColorStop(1, "#38bdf8");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Inner soft highlight
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-64 w-64 sm:h-80 sm:w-80"
      role="img"
      aria-label={`Voice indicator: ${state}`}
    />
  );
}
