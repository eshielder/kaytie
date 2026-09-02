export interface VocabEntry {
  term: string;
  note?: string;
  date: string;
}

const VOCAB_KEY = "kt-vocab";

export function getVocabulary(): VocabEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VOCAB_KEY);
    const parsed = raw ? (JSON.parse(raw) as VocabEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addVocabTerms(terms: string[], note?: string): number {
  const clean = terms.map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 80);
  if (clean.length === 0) return 0;
  const existing = new Set(getVocabulary().map((v) => v.term.toLowerCase()));
  const fresh = clean
    .filter((t) => !existing.has(t.toLowerCase()))
    .map((t) => ({ term: t, note, date: new Date().toISOString() }));
  if (fresh.length === 0) return 0;
  const all = [...fresh, ...getVocabulary()].slice(0, 500);
  try {
    localStorage.setItem(VOCAB_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return fresh.length;
}

export function removeVocabTerm(term: string): void {
  try {
    const all = getVocabulary().filter((v) => v.term !== term);
    localStorage.setItem(VOCAB_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Export the notebook as CSV (Anki-importable: front,back). */
export function vocabularyToCsv(): string {
  const rows = getVocabulary().map((v) => [v.term, v.note ?? "", v.date]);
  return ["term,note,date", ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
}
