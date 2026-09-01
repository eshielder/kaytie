"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TEST_PHRASE = "Hello KT, can you hear me clearly?";
const PASS_SIMILARITY = 0.5;

/** Minimal SpeechRecognition typings (Chrome/Edge). */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
}

/** Normalize text for a forgiving pronunciation/similarity check. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word-level bigram similarity (order-tolerant, forgiving scoring). */
function similarity(a: string, b: string): number {
  const wa = a.split(" ").filter(Boolean);
  const wb = b.split(" ").filter(Boolean);
  if (wa.length === 0 || wb.length === 0) return 0;
  if (wa.length === 1 || wb.length === 1) {
    const hit = wa.some((w) => wb.includes(w));
    return hit ? 0.6 : 0;
  }
  const bigrams = (words: string[]) => {
    const set = new Map<string, number>();
    for (let i = 0; i < words.length - 1; i++) {
      const bg = `${words[i]} ${words[i + 1]}`;
      set.set(bg, (set.get(bg) ?? 0) + 1);
    }
    return set;
  };
  const ga = bigrams(wa);
  const gb = bigrams(wb);
  let overlap = 0;
  ga.forEach((count, bg) => {
    overlap += Math.min(count, gb.get(bg) ?? 0);
  });
  const total = Math.max(ga.size, gb.size);
  return total > 0 ? overlap / total : 0;
}

type CheckStage = "intro" | "listening" | "checking";

interface MicCheckProps {
  /** Called when the microphone has been verified (level + speech recognized). */
  onPassed: () => void;
}

/**
 * Pre-session microphone test. Verifies, before the tutor session starts:
 *  1. The microphone is reachable and permission granted.
 *  2. Real audio is coming in (live level meter).
 *  3. Speech is recognized and roughly matches the test phrase
 *     (catches wrong input device, heavy noise, or no-transcription issues).
 */
export default function MicCheck({ onPassed }: MicCheckProps) {
  const [stage, setStage] = useState<CheckStage>("intro");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [failed, setFailed] = useState<string>("");

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => teardown, [teardown]);

  const runTest = useCallback(async () => {
    teardown();
    setHeard("");
    setFailed("");
    setStatus("Requesting microphone access...");
    setStage("listening");

    let ctx: AudioContext;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      ctx = new AudioContext();
      await ctx.resume();
    } catch (err) {
      const name = (err as DOMException)?.name;
      setStage("intro");
      setFailed(
        name === "NotFoundError"
          ? "No microphone found. Please connect one and try again."
          : "Microphone access was blocked. Please allow microphone access and try again."
      );
      return;
    }

    streamRef.current = stream;
    ctxRef.current = ctx;

    // Live level meter — proves audio is actually arriving.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let sawSound = false;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
      }
      if (peak > 0.06) sawSound = true;
      setLevel(Math.min(1, peak * 2.5));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Speech recognition check.
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      // No SpeechRecognition support: pass on level alone, but note it.
      setStatus(
        "I can hear you (level is moving). This browser can't do the spoken word check — starting anyway."
      );
      window.setTimeout(() => {
        teardown();
        onPassed();
      }, 1500);
      return;
    }

    setStatus("Say the phrase below out loud.");

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = "";
    let stopped = false;

    const finish = () => {
      if (stopped) return;
      stopped = true;
      setStage("checking");
      const score = similarity(normalize(finalText), normalize(TEST_PHRASE));
      setHeard(finalText.trim());
      if (!sawSound) {
        teardown();
        setStage("intro");
        setFailed(
          "Your microphone picked up no sound while you spoke. Check that the correct input device is selected and not muted in your system settings."
        );
        return;
      }
      if (score >= PASS_SIMILARITY) {
        setStatus("Mic check passed — I can hear and understand you!");
        window.setTimeout(() => {
          teardown();
          onPassed();
        }, 1200);
      } else {
        teardown();
        setStage("intro");
        setFailed(
          finalText.trim()
            ? `I heard "${finalText.trim()}" instead of the test phrase. Your voice reaches the microphone but recognition is poor — try moving closer, reducing background noise, or picking a different input device.`
            : "I couldn't make out any speech. Your voice is reaching the microphone but nothing was recognized — try speaking louder and closer to the mic."
        );
      }
    };

    recognition.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += ` ${r[0].transcript}`;
      }
      const partial = e.results[e.results.length - 1];
      if (partial && !partial.isFinal) {
        setStatus(`Hearing: "${partial[0].transcript}"`);
      }
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        teardown();
        setStage("intro");
        setFailed("Speech recognition was blocked by the browser. Please allow it and try again.");
      } else {
        // no-speech and others: evaluate what we have.
        finish();
      }
    };
    recognition.onend = () => finish();
    try {
      recognition.start();
    } catch {
      /* already started */
    }
  }, [onPassed, teardown]);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-8">
      <h2 className="text-xl font-semibold text-white">Microphone Check</h2>

      {stage === "intro" && (
        <p className="text-center text-sm text-slate-300">
          Before we start, let&apos;s make sure KT can hear you and understands your
          pronunciation.
        </p>
      )}

      {stage === "listening" && (
        <div className="flex w-full flex-col items-center gap-4">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-white/10"
            role="meter"
            aria-valuenow={Math.round(level * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
          <p className="text-center text-sm font-medium text-sky-300" aria-live="polite">
            {status}
          </p>
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg font-semibold text-white">
            &ldquo;{TEST_PHRASE}&rdquo;
          </p>
          <p className="text-center text-xs text-slate-400">
            Speak the phrase clearly at your normal volume.
          </p>
        </div>
      )}

      {stage === "checking" && (
        <p className="text-center text-sm text-sky-300" aria-live="polite">
          {status}
        </p>
      )}

      {failed && (
        <p className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-sm text-rose-200">
          {failed}
        </p>
      )}

      {stage !== "listening" ? (
        <button
          type="button"
          onClick={() => void runTest()}
          className="rounded-full bg-gradient-to-r from-violet-500 to-sky-400 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-violet-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          {failed ? "🔄 Try Again" : "🎙 Test My Microphone"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            teardown();
            setStage("intro");
            setFailed("Check cancelled.");
          }}
          className="rounded-full border border-white/15 bg-white/10 px-6 py-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

