import type { SessionRecord } from "@/types/voice";

const HISTORY_KEY = "kt-sessions";
const MAX_RECORDS = 100;

export function getSessionHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addSessionRecord(record: SessionRecord): void {
  try {
    const all = getSessionHistory();
    all.unshift(record);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(0, MAX_RECORDS)));
  } catch {
    /* ignore */
  }
}

export interface ProgressStats {
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number; // consecutive days with >= 1 session
  subjectsCovered: number;
}

export function getProgressStats(): ProgressStats {
  const all = getSessionHistory();
  const totalMinutes = Math.round(all.reduce((sum, r) => sum + r.durationSeconds, 0) / 60);
  const subjects = new Set(all.map((r) => r.subject).filter(Boolean));

  const days = new Set(all.map((r) => r.date.slice(0, 10)));
  let streak = 0;
  const day = new Date();
  for (;;) {
    const key = day.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      day.setDate(day.getDate() - 1);
    } else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) {
      // today not yet studied — streak may still be alive from yesterday
      day.setDate(day.getDate() - 1);
    } else {
      break;
    }
  }

  return { totalSessions: all.length, totalMinutes, currentStreak: streak, subjectsCovered: subjects.size };
}

export function clearSessionHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
