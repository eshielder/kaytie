"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import KTLogo from "@/components/KTLogo";
import { SUBJECTS } from "@/lib/tutor/prompt";
import { demoLogin, demoLogout, getDemoUser, type DemoUser } from "@/lib/demoAuth";

const DEMO_USER_NAME = "Demo User";

export default function Landing() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    setUser(getDemoUser());
    setChecked(true);
  }, []);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = nameInput.trim();
      if (!name) return;
      setUser(demoLogin(name));
      setNameInput("");
    },
    [nameInput]
  );

  const handleLogout = useCallback(() => {
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
