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
