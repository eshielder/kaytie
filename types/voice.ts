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
}

export type VoiceErrorKind =
  | "microphone_denied"
  | "connection_failed"
  | "network"
  | "config"
  | "playback"
  | "timeout";
