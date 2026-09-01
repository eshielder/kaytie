import Link from "next/link";
import KTLogo from "@/components/KTLogo";
import { SUBJECTS } from "@/lib/tutor/prompt";

export default function Landing() {
  return (
    <main className="ambient-bg flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="animate-fade-up flex w-full max-w-md flex-col items-center text-center">
        <KTLogo size={104} />

        <h1 className="mt-8 text-6xl font-bold tracking-tight text-white">KT</h1>
        <p className="mt-3 text-xl font-medium text-slate-300">Learn by talking.</p>

        <p className="mt-12 text-2xl font-semibold leading-snug text-white">
          What would you like
          <br />
          to learn?
        </p>

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
      </div>

      <p className="mt-12 text-xs text-slate-600">
        Powered by AssemblyAI real-time voice
      </p>
    </main>
  );
}