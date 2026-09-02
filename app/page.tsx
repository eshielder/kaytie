"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import KTLogo from "@/components/KTLogo";
import { SUBJECTS } from "@/lib/tutor/prompt";
import { demoLogin, demoLogout, getDemoUser, type DemoUser } from "@/lib/demoAuth";
import { speakWelcome, stopWelcome } from "@/lib/welcome";
import {
  getDifficulty,
  setDifficulty,
  getLanguageMode,
  setLanguageMode,
  getBargeIn,
  setBargeIn,
  type LanguageMode,
  type Difficulty,
  LANGUAGE_VOICES,
} from "@/lib/voices";
import { getSessionHistory, getProgressStats, clearSessionHistory, type ProgressStats } from "@/lib/history";
import { getVocabulary, vocabularyToCsv, removeVocabTerm } from "@/lib/vocab";
import type { SessionRecord } from "@/types/voice";
import { DEFAULT_VOICE, VOICES, getSelectedVoice, setSelectedVoice } from "@/lib/voices";

const DEMO_USER_NAME = "Pal";

export default function Landing() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [voice, setVoice] = useState<string>(DEFAULT_VOICE);
  const [difficulty, setDifficultyState] = useState<Difficulty>("intermediate");
  const [language, setLanguageState] = useState<LanguageMode>(null);
  const [bargeIn, setBargeInState] = useState(false);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [vocabulary, setVocabulary] = useState<{ term: string; note?: string }[]>([]);
  const [showVocab, setShowVocab] = useState(false);
  const [pastLessons, setPastLessons] = useState(false);

  const refreshLocalData = useCallback(() => {
    setStats(getProgressStats());
    setHistory(getSessionHistory());
    setVocabulary(getVocabulary());
  }, []);

  useEffect(() => {
    setUser(getDemoUser());
    setVoice(getSelectedVoice());
    setDifficultyState(getDifficulty());
    setLanguageState(getLanguageMode());
    setBargeInState(getBargeIn());
    refreshLocalData();
    setChecked(true);
  }, [refreshLocalData]);

  const handleVoiceChange = useCallback((id: string) => {
    setSelectedVoice(id);
    setVoice(id);
  }, []);

  const handleLanguageChange = useCallback((mode: LanguageMode) => {
    setLanguageMode(mode);
    setLanguageState(mode);
  }, []);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = nameInput.trim();
      if (!name) return;
      setUser(demoLogin(name));
      setNameInput("");
      speakWelcome(name);
    },
    [nameInput]
  );

  const handleLogout = useCallback(() => {
    stopWelcome();
    demoLogout();
    setUser(null);
  }, []);

  if (!checked) {
    return (
      <main className="ambient-bg flex flex-1 items-center justify-center">
        <p className="text-slate-400">Loading KT...</p>
      </main>
    );
  }

  return (
    <main className="ambient-bg flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="animate-fade-up flex w-full max-w-md flex-col items-center text-center">
        <KTLogo size={104} />

        <h1 className="mt-8 text-6xl font-bold tracking-tight text-white">KT</h1>
        <p className="mt-3 text-xl font-medium text-slate-300">Learn by talking.</p>

        {user ? (
          <>
            <p className="mt-10 text-2xl font-semibold leading-snug text-white">
              Welcome back,
              <br />
              {user.name}!
            </p>
            <p className="mt-2 text-sm text-slate-400">What would you like to learn?</p>

            <Link
              href="/tutor"
              className="mt-8 rounded-full bg-gradient-to-r from-violet-500 to-sky-400 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-violet-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="Start learning with KT"
            >
              🎙 Start Learning
            </Link>

            {/* KT voice picker */}
            <div className="mt-8 w-full rounded-3xl border border-white/10 bg-white/5 p-5">
              <label
                htmlFor="kt-voice"
                className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500"
              >
                KT&apos;s voice
              </label>
              <select
                id="kt-voice"
                value={voice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.accent === "US" ? "🇺🇸 American" : "🇬🇧 British"}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Used for every session until you change it.
              </p>
            </div>

            {/* Difficulty level */}
            <div className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Difficulty level
              </p>
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDifficulty(d);
                      setDifficultyState(d);
                    }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                      difficulty === d
                        ? "border-sky-400/50 bg-sky-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Language practice mode */}
            <div className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 p-5">
              <label htmlFor="kt-language" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Language practice (optional)
              </label>
              <select
                id="kt-language"
                value={language ?? ""}
                onChange={(e) => handleLanguageChange((e.target.value || null) as LanguageMode)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <option value="">Off — subject tutor</option>
                <option value="spanish">🇪🇸 Spanish practice</option>
                <option value="french">🇫🇷 French practice</option>
                <option value="german">🇩🇪 German practice</option>
                <option value="italian">🇮🇹 Italian practice</option>
                <option value="portuguese">🇵🇹 Portuguese practice</option>
              </select>
              {language && (
                <p className="mt-2 text-xs text-slate-500">
                  KT will use a native {language} voice and converse in {language}.
                </p>
              )}
            </div>

            {/* Barge-in setting */}
            <div className="mt-4 flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-left">
                <p className="text-sm font-medium text-white">Allow interrupting KT</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Best with headphones. Off = wait for KT to finish (recommended on phones).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={bargeIn}
                onClick={() => {
                  setBargeIn(!bargeIn);
                  setBargeInState(!bargeIn);
                }}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  bargeIn ? "bg-sky-500" : "bg-white/15"
                }`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${bargeIn ? "left-6" : "left-1"}`} />
              </button>
            </div>

            {/* Learning journey (progress dashboard) */}
            {stats && stats.totalSessions > 0 && (
              <div className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Your learning journey
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Sessions", value: stats.totalSessions },
                    { label: "Minutes", value: stats.totalMinutes },
                    { label: "Streak", value: stats.currentStreak },
                    { label: "Subjects", value: stats.subjectsCovered },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white/5 py-3">
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                {history.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPastLessons(!pastLessons)}
                      className="mt-3 text-xs font-medium text-sky-300 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      {pastLessons ? "▾ Hide recent sessions" : "▸ Show recent sessions"}
                    </button>
                    {pastLessons && (
                      <ul className="mt-2 space-y-2">
                        {history.slice(0, 5).map((r, i) => (
                          <li key={i} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                            <p className="font-medium text-slate-200">{r.topic}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(r.date).toLocaleDateString()} · {Math.max(1, Math.round(r.durationSeconds / 60))} min
                              {r.subject ? ` · ${r.subject}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear your local session history?")) {
                      clearSessionHistory();
                      refreshLocalData();
                    }
                  }}
                  className="mt-3 text-xs text-slate-600 hover:text-rose-300 focus:outline-none"
                >
                  Clear history
                </button>
              </div>
            )}

            {/* Vocabulary notebook */}
            {vocabulary.length > 0 && (
              <div className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
                <button
                  type="button"
                  onClick={() => setShowVocab(!showVocab)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500 focus:outline-none"
                >
                  <span>Vocabulary notebook ({vocabulary.length})</span>
                  <span>{showVocab ? "▾" : "▸"}</span>
                </button>
                {showVocab && (
                  <>
                    <ul className="mt-3 space-y-1.5">
                      {vocabulary.slice(0, 12).map((v) => (
                        <li key={v.term} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-200">{v.term}</span>
                          <button
                            type="button"
                            onClick={() => {
                              removeVocabTerm(v.term);
                              refreshLocalData();
                            }}
                            aria-label={`Remove ${v.term}`}
                            className="text-xs text-slate-600 hover:text-rose-300 focus:outline-none"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([vocabularyToCsv()], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "kt-vocabulary.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="mt-3 text-xs font-medium text-sky-300 hover:text-sky-200 focus:outline-none"
                    >
                      ⬇ Export as CSV (Anki-ready)
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="mt-14">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Or pick a subject
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUBJECTS.map((subject) => (
                  <Link
                    key={subject}
                    href={`/tutor?subject=${encodeURIComponent(subject)}`}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-violet-400/40 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    {subject}
                  </Link>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-10 rounded-full border border-white/15 bg-white/5 px-6 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Log out ({user.name})
            </button>
          </>
        ) : (
          <>
            <p className="mt-10 text-2xl font-semibold leading-snug text-white">
              What would you like
              <br />
              to learn?
            </p>

            <form
              onSubmit={handleLogin}
              className="mt-8 flex w-full flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <label htmlFor="demo-name" className="text-sm font-medium text-slate-300">
                What&apos;s your name? (demo login)
              </label>
              <input
                id="demo-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Alex"
                autoComplete="given-name"
                maxLength={40}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              />
              <button
                type="button"
                onClick={() => setNameInput(DEMO_USER_NAME)}
                className="w-full rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                ⚡ Auto-fill demo credentials
              </button>
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Log in &amp; Start Learning
              </button>
              <p className="text-xs text-slate-500">
                Demo mode — no password needed. KT will greet you by name.
              </p>
            </form>
          </>
        )}
      </div>

      <p className="mt-12 text-xs text-slate-600">
        Powered by AssemblyAI real-time voice
      </p>
    </main>
  );
}
