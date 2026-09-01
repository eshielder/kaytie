"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import VoiceVisualizer from "@/components/VoiceVisualizer";
import VoiceButton from "@/components/VoiceButton";
import Conversation from "@/components/Conversation";
import SessionSummary from "@/components/SessionSummary";
import { VoiceAgentSession } from "@/lib/assemblyai/client";
import type {
  SessionState,
  SessionSummaryData,
  TranscriptEntry,
} from "@/types/voice";

const STATE_MESSAGES: Partial<Record<SessionState, string>> = {
  connecting: "Connecting...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "KT is speaking...",
};

function TutorContent() {
  const searchParams = useSearchParams();
  const subject = searchParams.get("subject") ?? undefined;

  const [state, setState] = useState<SessionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready when you are.");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [ending, setEnding] = useState(false);

  const sessionRef = useRef<VoiceAgentSession | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const getAnalyser = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return null;
    if (state === "speaking" || state === "thinking") return session.outAnalyser;
    return session.micAnalyser;
  }, [state]);

  const startSession = useCallback(async () => {
    if (sessionRef.current) return;
    setSummary(null);
    setTranscript([]);
    setMuted(false);
    setEnding(false);

    const session = new VoiceAgentSession({
      onStateChange: (next, message) => {
        setState(next);
        if (message) {
          setStatusMessage(message);
        } else {
          setStatusMessage(
            next === "connecting" ? "Connecting..." : "Ready when you are."
          );
        }
      },
      onUserPartial: (text) => {
        setTranscript((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.speaker === "user" && last.partial) {
            next[next.length - 1] = { speaker: "user", text, partial: true };
          } else {
            next.push({ speaker: "user", text, partial: true });
          }
          return next;
        });
      },
      onUserFinal: (text) => {
        setTranscript((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.speaker === "user" && last.partial) {
            next[next.length - 1] = { speaker: "user", text: text || last.text };
          } else if (text) {
            next.push({ speaker: "user", text });
          }
          return next;
        });
      },
      onAgentFinal: (text) => {
        if (text) {
          setTranscript((prev) => [...prev, { speaker: "kt", text }]);
        }
      },
      onProtocolError: (code, message) => {
        console.warn(`Voice agent protocol error [${code}]: ${message}`);
      },
    });

    sessionRef.current = session;
    await session.start(subject);
  }, [subject]);

  const endSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    setEnding(true);
    session.end();

    // Build the session summary from the conversation so far.
    const messages = transcriptRef.current
      .filter((e) => e.text.trim().length > 0 && !e.partial)
      .map((e) => ({ speaker: e.speaker, text: e.text }));

    try {
      const res = await fetch("/api/voice/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        setSummary((await res.json()) as SessionSummaryData);
      } else {
        setSummary({
          topic: subject ?? "What we talked about",
          learned: ["A voice learning session with KT"],
        });
      }
    } catch {
      setSummary({
        topic: subject ?? "What we talked about",
        learned: ["A voice learning session with KT"],
      });
    }

    sessionRef.current = null;
    setEnding(false);
    setState("idle");
    setStatusMessage("Ready when you are.");
    setTranscript([]);
  }, [subject]);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const next = !session.isMuted;
    session.setMuted(next);
    setMuted(next);
  }, []);

  const leaveToLanding = useCallback(() => {
    sessionRef.current?.end();
    sessionRef.current = null;
  }, []);

  // Clean termination if the user closes the tab mid-session.
  useEffect(() => {
    const onPageHide = () => {
      sessionRef.current?.end();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const isActive = state !== "idle" && state !== "error";

  return (
    <main className="ambient-bg flex flex-1 flex-col items-center px-6 py-10">
      {/* Session controls */}
      <div className="flex w-full max-w-md items-center justify-between">
        <Link
          href="/"
          onClick={leaveToLanding}
          className="text-sm text-slate-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label="Back to home"
        >
          ← KT
        </Link>
        {subject && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {subject}
          </span>
        )}
      </div>

      {summary ? (
        <div className="mt-10 flex w-full flex-1 items-start justify-center">
          <SessionSummary
            summary={summary}
            onStartAnother={() => void startSession()}
            onLearnSomethingElse={() => {
              setSummary(null);
              setState("idle");
            }}
          />
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 py-6">
          {/* Voice interface */}
          <VoiceVisualizer state={state} getAnalyser={getAnalyser} />

          <div className="min-h-16 text-center" aria-live="polite">
            <p className="text-xl font-semibold text-white">
              {state === "error" ? "Something went wrong." : (STATE_MESSAGES[state] ?? "Ready when you are.")}
            </p>
            {state === "error" && statusMessage && (
              <p className="mt-2 text-sm text-rose-300">{statusMessage}</p>
            )}
            {state !== "error" && statusMessage !== "Ready when you are." && state !== "connecting" && (
              <p className="mt-1 text-sm text-slate-400">{statusMessage}</p>
            )}
          </div>

          {/* Controls */}
          {!isActive ? (
            <VoiceButton
              label={state === "error" ? "Try Again" : "🎙 Start Learning"}
              onClick={() => void startSession()}
              disabled={(state as string) === "connecting"}
              ariaLabel="Start learning session"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                  {muted ? "Muted" : "🎙 Listening"}
                </span>
                <VoiceButton
                  label={muted ? "Unmute" : "Mute"}
                  onClick={toggleMute}
                  variant="secondary"
                  className="px-5 py-2 text-sm"
                  ariaLabel={muted ? "Unmute microphone" : "Mute microphone"}
                />
              </div>
              <VoiceButton
                label={ending ? "Ending..." : "End Session"}
                onClick={() => void endSession()}
                variant="danger"
                className="px-6 py-2.5 text-sm"
                disabled={ending}
                ariaLabel="End learning session"
              />
            </div>
          )}

          {/* Live transcript */}
          <div className="w-full">
            <Conversation entries={transcript} />
          </div>
        </div>
      )}
    </main>
  );
}

export default function TutorPage() {
  return (
    <Suspense
      fallback={
        <main className="ambient-bg flex flex-1 items-center justify-center">
          <p className="text-slate-400">Loading KT...</p>
        </main>
      }
    >
      <TutorContent />
    </Suspense>
  );
}
