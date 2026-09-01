"use client";

import { useEffect, useRef } from "react";
import type { SessionState } from "@/types/voice";

interface AmbientMusicProps {
  /** Music only plays while this is true (i.e., an active session). */
  active: boolean;
  currentSessionState: SessionState;
  /** Returns the mic analyser so we can hear (literally) when the user talks. */
  getAnalyser: () => AnalyserNode | null;
}

const BASE_GAIN = 0.05; // low background volume
const DUCK_GAIN = 0.0; // silent while KT or the user is talking

/**
 * Soothing ambient background music (Interstellar-style organ drone),
 * synthesized live with the Web Audio API — no audio files needed.
 * Plays softly during the session and fades to silence whenever KT is
 * speaking/thinking or the user is talking, resuming in quiet moments.
 */
export default function AmbientMusic({
  active,
  currentSessionState,
  getAnalyser,
}: AmbientMusicProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array | null>(null);
  // Keep latest props in refs so the audio graph isn't rebuilt on every
  // session-state change — only ducking behavior reacts.
  const stateRef = useRef(currentSessionState);
  const getAnalyserRef = useRef(getAnalyser);
  stateRef.current = currentSessionState;
  getAnalyserRef.current = getAnalyser;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    void ctx.resume().catch(() => {});

    // --- Synthesize a slow, warm drone (chord: A2, E3, A3, C#4, E4) ---
    const master = ctx.createGain();
    master.gain.value = 0;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 900;
    lowpass.Q.value = 0.5;
    lowpass.connect(master);
    master.connect(ctx.destination);
    gainRef.current = master;

    const frequencies = [110, 164.81, 220, 277.18, 329.63];
    const oscillators: OscillatorNode[] = [];
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? "sawtooth" : "sine"; // lower reeds + soft upper pads
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * 4; // gentle chorus shimmer

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = i < 2 ? 0.25 : 0.12;

      // Very slow amplitude swell per voice for organic movement.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = voiceGain.gain.value * 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);
      lfo.start();

      osc.connect(voiceGain);
      voiceGain.connect(lowpass);
      osc.start();
      oscillators.push(osc, lfo);
    });

    // Slow filter sweep for a breathing, cinematic feel.
    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.03;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 350;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(lowpass.frequency);
    filterLfo.start();
    oscillators.push(filterLfo);

    // --- Ducking loop: fade out while KT or the user is talking ---
    const analyserBuf = new Float32Array(512);
    bufferRef.current = analyserBuf;
    let fade = 0;

    const tick = () => {
      if (cancelled) return;

      let userTalking = false;
      const analyser = getAnalyserRef.current();
      if (analyser) {
        analyser.getFloatTimeDomainData(analyserBuf);
        let peak = 0;
        for (let i = 0; i < analyserBuf.length; i++) {
          const v = Math.abs(analyserBuf[i]);
          if (v > peak) peak = v;
        }
        userTalking = peak > 0.08;
      }

      const state = stateRef.current;
      const someoneTalking =
        userTalking || state === "speaking" || state === "thinking";
      const target = someoneTalking ? DUCK_GAIN : BASE_GAIN;

      // Smooth ramp (about 0.8s) to avoid clicks.
      fade += (target - fade) * 0.06;
      if (Math.abs(target - fade) < 0.0005) fade = target;
      const now = ctx.currentTime;
      master.gain.setTargetAtTime(fade, now, 0.2);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        oscillators.forEach((osc) => {
          try {
            osc.stop(ctx.currentTime + 0.6);
          } catch {
            /* already stopped */
          }
        });
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 800);
      ctxRef.current = null;
      gainRef.current = null;
    };
  }, [active]);

  return null; // audio-only component
}
