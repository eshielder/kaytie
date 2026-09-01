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

const BASE_VOLUME = 0.12; // low background volume (fraction of full)
const DUCK_VOLUME = 0.0; // silent while KT or the user is talking

/**
 * Soothing background music (/bg-music.mp3, looped) played at low volume
 * during the session. Fades to silence whenever KT is speaking/thinking or
 * the user is talking, and swells back during quiet listening moments.
 */
export default function AmbientMusic({
  active,
  currentSessionState,
  getAnalyser,
}: AmbientMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // Latest props in refs so playback isn't restarted on every state change.
  const stateRef = useRef(currentSessionState);
  const getAnalyserRef = useRef(getAnalyser);
  stateRef.current = currentSessionState;
  getAnalyserRef.current = getAnalyser;

  useEffect(() => {
    if (!active) return;

    const audio = new Audio("/bg-music.mp3");
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    let playing = false;
    const tryPlay = () => {
      audio
        .play()
        .then(() => {
          playing = true;
        })
        .catch(() => {
          // Autoplay blocked: retry on the next user interaction.
          playing = false;
        });
    };
    tryPlay();
    const retry = () => {
      if (!playing) tryPlay();
    };
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", retry);

    // Ducking loop: fade volume toward the target every frame.
    const analyserBuf = new Float32Array(512);
    let fade = 0;

    const tick = () => {
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
      const target = someoneTalking ? DUCK_VOLUME : BASE_VOLUME;

      // Smooth ramp to avoid abrupt jumps.
      fade += (target - fade) * 0.06;
      if (Math.abs(target - fade) < 0.003) fade = target;
      audio.volume = fade;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [active]);

  return null; // audio-only component
}
