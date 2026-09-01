"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 *
 * Browsers block autoplay unless play() happens inside a user gesture, so a
 * visible on/off toggle is provided — tapping it is a guaranteed gesture.
 */
export default function AmbientMusic({
  active,
  currentSessionState,
  getAnalyser,
}: AmbientMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  // Latest props in refs so playback isn't restarted on every state change.
  const stateRef = useRef(currentSessionState);
  const getAnalyserRef = useRef(getAnalyser);
  stateRef.current = currentSessionState;
  getAnalyserRef.current = getAnalyser;

  // Create the element once per session.
  useEffect(() => {
    if (!active) return;
    const audio = new Audio("/bg-music.mp3");
    audio.loop = true;
    audio.volume = 0;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [active]);

  // Try to start automatically; if autoplay is blocked, the toggle covers it.
  useEffect(() => {
    if (!active) return;
    const tryPlay = () => {
      audioRef.current?.play().catch(() => {
        /* blocked until a gesture — user can tap the toggle */
      });
    };
    tryPlay();
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("touchstart", tryPlay, { passive: true });
    window.addEventListener("keydown", tryPlay);
    return () => {
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("touchstart", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, [active]);

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setMusicOn((on) => {
      if (on) {
        audio.pause();
        return false;
      }
      // Inside a real tap: browsers must allow this.
      audio.play().catch(() => {});
      return true;
    });
  }, []);

  // Ducking loop: fade volume toward the target every frame.
  useEffect(() => {
    if (!active || !musicOn) return;
    const audio = audioRef.current;
    if (!audio) return;

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
    };
  }, [active, musicOn]);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={toggleMusic}
      aria-pressed={musicOn}
      aria-label={musicOn ? "Turn background music off" : "Turn background music on"}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-lg backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      {musicOn ? "🔊 Music on" : "🔇 Music off"}
    </button>
  );
}
