"use client";

import type { SessionSummaryData } from "@/types/voice";
import VoiceButton from "./VoiceButton";

interface SessionSummaryProps {
  summary: SessionSummaryData;
  onStartAnother: () => void;
  onLearnSomethingElse: () => void;
}

/** Post-session summary shown after the user ends a learning session. */
export default function SessionSummary({
  summary,
  onStartAnother,
  onLearnSomethingElse,
}: SessionSummaryProps) {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
      <h2 className="text-2xl font-bold text-white">Session Complete</h2>
      <p className="mt-2 text-slate-400">Great work — here&apos;s what we covered.</p>

      <div className="mt-6 rounded-2xl bg-white/5 p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
          Topic
        </p>
        <p className="mt-1 text-lg font-semibold text-white">{summary.topic}</p>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-sky-300">
          What you learned
        </p>
        <ul className="mt-2 space-y-2">
          {summary.learned.length > 0 ? (
            summary.learned.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-violet-400 to-sky-400" />
                {item}
              </li>
            ))
          ) : (
            <li className="text-slate-400">A short learning session.</li>
          )}
        </ul>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <VoiceButton label="🎙 Start Another Session" onClick={onStartAnother} />
        <VoiceButton
          label="Learn Something Else"
          onClick={onLearnSomethingElse}
          variant="secondary"
        />
      </div>
    </div>
  );
}
