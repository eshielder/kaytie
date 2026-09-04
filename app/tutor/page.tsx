"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import VoiceVisualizer from "@/components/VoiceVisualizer";
import VoiceButton from "@/components/VoiceButton";
import Conversation from "@/components/Conversation";
import SessionSummary from "@/components/SessionSummary";
import MicCheck from "@/components/MicCheck";
import AmbientMusic from "@/components/AmbientMusic";
import { demoLogout, getDemoUser, type DemoUser } from "@/lib/demoAuth";
import { getSelectedVoice, getDifficulty, getLanguageMode, getBargeIn, setTextSize, getTextSize, LANGUAGE_VOICES } from "@/lib/voices";
import { addSessionRecord } from "@/lib/history";
import { useRouter } from "next/navigation";
import { VoiceAgentSession } from "@/lib/assemblyai/client";
import type {
  SessionState,
  SessionSummaryData,
  SummaryMessage,
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
  const router = useRouter();

  const [user, setUser] = useState<DemoUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [state, setState] = useState<SessionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready when you are.");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [ending, setEnding] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<SummaryMessage[]>([]);
  const [micCheckDone, setMicCheckDone] = useState(false);
  const [showMicCheck, setShowMicCheck] = useState(false);
  const [textSize, setTextSizeState] = useState<"normal" | "large">("normal");
  const sessionStartedAt = useRef<number>(0);

  const sessionRef = useRef<VoiceAgentSession | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Demo auth gate: no logged-in user → back to the login screen.
  useEffect(() => {
    const u = getDemoUser();
    if (!u) {
      router.replace("/");
      return;
    }
    setUser(u);
    setAuthChecked(true);
    const size = getTextSize();
    setTextSizeState(size);
    setTextSize(size);
  }, [router]);

  const handleLogout = useCallback(() => {
    sessionRef.current?.end();
    sessionRef.current = null;
    demoLogout();
    router.replace("/");
  }, [router]);

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
    sessionStartedAt.current = Date.now();
    const language = getLanguageMode();
    const selectedVoice = language ? LANGUAGE_VOICES[language] : getSelectedVoice();
    await session.start(subject, user?.name, selectedVoice, {
      difficulty: getDifficulty(),
      language,
      bargeIn: getBargeIn(),
    });
  }, [subject, user]);

  const endSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    setEnding(true);
    session.end();

    // Build the session summary from the conversation so far.
    const messages = transcriptRef.current
      .filter((e) => e.text.trim().length > 0 && !e.partial)
      .map((e) => ({ speaker: e.speaker, text: e.text }));
    setSessionMessages(messages);

    let finalSummary: SessionSummaryData | null = null;
    try {
      const res = await fetch("/api/voice/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        finalSummary = (await res.json()) as SessionSummaryData;
      } else {
        finalSummary = {
          topic: subject ?? "What we talked about",
          learned: ["A voice learning session with KT"],
        };
      }
    } catch {
      finalSummary = {
        topic: subject ?? "What we talked about",
        learned: ["A voice learning session with KT"],
      };
    }
    setSummary(finalSummary);

    // Persist the finished session locally for the progress dashboard.
    addSessionRecord({
      sessionId: session.id ?? undefined,
      date: new Date().toISOString(),
      subject,
      difficulty: getDifficulty(),
      topic: finalSummary?.topic ?? subject ?? "Voice learning session",
      learned: finalSummary?.learned ?? [],
      turns: messages.filter((m) => m.speaker === "user").length,
      durationSeconds: Math.round((Date.now() - sessionStartedAt.current) / 1000),
    });

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

  // Wait for the demo-auth check before rendering anything.
  if (!authChecked) {
    return (
      <main className="ambient-bg flex flex-1 items-center justify-center">
        <p className="text-slate-400">Loading KT...</p>
      </main>
    );
  }

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
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-slate-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label="Log out"
        >
          Log out
        </button>
        <button
          type="button"
          onClick={() => {
            const next = textSize === "normal" ? "large" : "normal";
            setTextSize(next);
            setTextSizeState(next);
          }}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label="Toggle larger text"
        >
          {textSize === "large" ? "A−" : "A+"}
        </button>
      </div>

      {summary ? (
        <div className="mt-10 flex w-full flex-1 items-start justify-center">
          <SessionSummary
            summary={summary}
            transcript={sessionMessages}
            learnerName={user?.name}
            subject={subject}
            onStartAnother={() => void startSession()}
            onLearnSomethingElse={() => {
              setSummary(null);
              setState("idle");
            }}
          />
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 py-6">
          {/* Ambient background music (auto-ducks during speech) */}
          <AmbientMusic active={isActive} currentSessionState={state} getAnalyser={getAnalyser} />
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
            <div className="flex flex-col items-center gap-3">
              <VoiceButton
                label={state === "error" ? "Try Again" : "🎙 Start Learning"}
                onClick={() => void startSession()}
                disabled={(state as string) === "connecting"}
                ariaLabel="Start learning session"
              />
              {!showMicCheck ? (
                <button
                  type="button"
                  onClick={() => setShowMicCheck(true)}
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  🧪 Test microphone first
                </button>
              ) : (
                <div className="w-full">
                  <MicCheck onPassed={() => { setMicCheckDone(true); setShowMicCheck(false); }} />
                  <button
                    type="button"
                    onClick={() => setShowMicCheck(false)}
                    className="mx-auto mt-3 block text-xs font-medium text-slate-500 hover:text-slate-300 focus:outline-none"
                  >
                    Hide test
                  </button>
                </div>
              )}
            </div>
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
