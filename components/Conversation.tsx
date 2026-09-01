"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/types/voice";

interface ConversationProps {
  entries: TranscriptEntry[];
}

/** Small live transcript area under the voice interface. */
export default function Conversation({ entries }: ConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="text-center text-sm text-slate-400" aria-live="polite">
        Your conversation will appear here as you talk.
      </p>
    );
  }

  return (
    <div
      className="max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed"
      aria-live="polite"
      aria-label="Live conversation transcript"
    >
      {entries.map((entry, i) => (
        <div key={i} className={entry.speaker === "user" ? "text-right" : "text-left"}>
          <span
            className={`mb-0.5 block text-xs font-semibold uppercase tracking-wide ${
              entry.speaker === "user" ? "text-sky-300" : "text-violet-300"
            }`}
          >
            {entry.speaker === "user" ? "You" : "KT"}
          </span>
          <span
            className={`inline-block max-w-[85%] rounded-xl px-3 py-1.5 ${
              entry.speaker === "user"
                ? "bg-sky-500/15 text-slate-100"
                : "bg-violet-500/15 text-slate-100"
            } ${entry.partial ? "italic opacity-70" : ""}`}
          >
            {entry.text}
            {entry.partial && <span className="ml-1 animate-pulse">▍</span>}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
