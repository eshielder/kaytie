/** English voices available in the AssemblyAI Voice Agent API. */
export interface VoiceOption {
  id: string;
  label: string;
  accent: "US" | "UK";
}

export const VOICES: VoiceOption[] = [
  { id: "alba", label: "Alba", accent: "US" },
  { id: "eve", label: "Eve", accent: "US" },
  { id: "george", label: "George", accent: "US" },
  { id: "jane", label: "Jane", accent: "US" },
  { id: "jean", label: "Jean", accent: "US" },
  { id: "mary", label: "Mary", accent: "US" },
  { id: "michael", label: "Michael", accent: "US" },
  { id: "anna", label: "Anna", accent: "UK" },
  { id: "charles", label: "Charles", accent: "UK" },
  { id: "paul", label: "Paul", accent: "UK" },
  { id: "vera", label: "Vera", accent: "UK" },
];

const VOICE_KEY = "kt-voice";
export const DEFAULT_VOICE = "jane";

/** Persisted voice choice (localStorage — remembered across visits). */
export function getSelectedVoice(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  try {
    const v = localStorage.getItem(VOICE_KEY);
    return VOICES.some((o) => o.id === v) ? (v as string) : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export function setSelectedVoice(id: string): void {
  try {
    if (VOICES.some((o) => o.id === id)) {
      localStorage.setItem(VOICE_KEY, id);
    }
  } catch {
    /* ignore */
  }
}

/** Practice language for language-tutor mode (null = normal subject tutor). */
export type LanguageMode = "spanish" | "french" | "german" | "italian" | "portuguese" | null;

const LANGUAGE_KEY = "kt-language";

export function getLanguageMode(): LanguageMode {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LANGUAGE_KEY);
    if (v === "spanish" || v === "french" || v === "german" || v === "italian" || v === "portuguese") {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

export function setLanguageMode(mode: LanguageMode): void {
  try {
    if (mode) localStorage.setItem(LANGUAGE_KEY, mode);
    else localStorage.removeItem(LANGUAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Native-accent voice for each language-tutor mode. */
export const LANGUAGE_VOICES: Record<Exclude<LanguageMode, null>, string> = {
  spanish: "lola",
  french: "estelle",
  german: "juergen",
  italian: "giovanni",
  portuguese: "rafael",
};

const DIFFICULTY_KEY = "kt-difficulty";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export function getDifficulty(): Difficulty {
  if (typeof window === "undefined") return "intermediate";
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY);
    if (v === "beginner" || v === "intermediate" || v === "advanced") return v;
    return "intermediate";
  } catch {
    return "intermediate";
  }
}

export function setDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    /* ignore */
  }
}

/** Allow interrupting KT mid-sentence (barge-in). Desktop users usually want this. */
const BARGE_IN_KEY = "kt-barge-in";

export function getBargeIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BARGE_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBargeIn(on: boolean): void {
  try {
    localStorage.setItem(BARGE_IN_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** UI text size ("normal" | "large"), persisted. */
const TEXT_SIZE_KEY = "kt-text-size";

export function getTextSize(): "normal" | "large" {
  if (typeof window === "undefined") return "normal";
  try {
    return localStorage.getItem(TEXT_SIZE_KEY) === "large" ? "large" : "normal";
  } catch {
    return "normal";
  }
}

export function setTextSize(size: "normal" | "large"): void {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.style.fontSize = size === "large" ? "112.5%" : "";
  }
}
