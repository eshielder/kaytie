export type SessionState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export interface TranscriptEntry {
  speaker: "user" | "kt";
  text: string;
  /** true while the user is still speaking (partial transcript) */
  partial?: boolean;
}

export interface SummaryMessage {
  speaker: "user" | "kt";
  text: string;
}

export interface SessionSummaryData {
  topic: string;
  learned: string[];
  key_terms?: string[];
  quiz?: { question: string; answer: string }[];
  exercise?: string;
}

export type VoiceErrorKind =
  | "microphone_denied"
  | "connection_failed"
  | "network"
  | "config"
  | "playback"
  | "timeout";

/** A finished learning session, stored in localStorage for progress tracking. */
export interface SessionRecord {
  /** AssemblyAI session id, when known (enables recording playback). */
  sessionId?: string;
  date: string; // ISO timestamp
  subject?: string;
  difficulty?: string;
  topic: string;
  learned: string[];
  turns: number;
  durationSeconds: number;
}
