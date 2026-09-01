import { buildSystemPrompt, KT_GREETING } from "@/lib/tutor/prompt";
import { VOICE_AGENT_WS_URL } from "@/lib/assemblyai/config";
import type { SessionState, VoiceErrorKind } from "@/types/voice";

const OUTPUT_SAMPLE_RATE = 24000;

export interface VoiceAgentSessionCallbacks {
  onStateChange: (state: SessionState, message?: string) => void;
  onUserPartial: (text: string) => void;
  onUserFinal: (text: string) => void;
  onAgentFinal: (text: string) => void;
  onProtocolError?: (code: string, message: string) => void;
}

/**
 * Real-time voice session with the AssemblyAI Voice Agent API
 * (wss://agents.assemblyai.com/v1/ws).
 *
 * Handles: microphone capture + resample to 24 kHz PCM16, streaming,
 * turn detection events, streamed PCM16 playback, barge-in flush,
 * mute, and clean session termination (session.end before close).
 */
export class VoiceAgentSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private sinkGain: GainNode | null = null;
  micAnalyser: AnalyserNode | null = null;
  outAnalyser: AnalyserNode | null = null;

  private outputSources = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  private sessionReady = false;
  private endedByUser = false;
  private cleanedUp = false;
  private muted = false;

  constructor(private callbacks: VoiceAgentSessionCallbacks) {}

  get isMuted() {
    return this.muted;
  }

  async start(subject?: string): Promise<void> {
    this.callbacks.onStateChange("connecting");

    // 1. Mint a single-use token server-side (API key stays on the server).
    let token: string;
    try {
      const res = await fetch("/api/voice/token", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.message || "Could not start a session.");
      }
      token = data.token as string;
    } catch {
      this.fail("config", "KT isn't configured yet. The AssemblyAI API key is missing or invalid.");
      return;
    }

    // 2. Audio context + mic. Must happen inside the user-gesture call stack.
    try {
      this.audioCtx = new AudioContext();
      await this.audioCtx.resume();
      await this.audioCtx.audioWorklet.addModule("/pcm-processor.js");
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      this.handleMicError(err);
      return;
    }

    // 3. Connect the WebSocket to the Voice Agent.
    try {
      await this.connectWebSocket(token, subject);
    } catch {
      this.fail(
        "connection_failed",
        "I couldn't reach the voice service. Please check your internet connection and try again."
      );
    }
  }

  private handleMicError(err: unknown): void {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      this.fail(
        "microphone_denied",
        "I need your microphone to hear you. Please allow microphone access and try again."
      );
    } else if (name === "NotFoundError") {
      this.fail(
        "microphone_denied",
        "I couldn't find a microphone on this device. Please connect one and try again."
      );
    } else {
      this.fail(
        "connection_failed",
        "I couldn't start the microphone. Please check your audio settings and try again."
      );
    }
  }

  private connectWebSocket(token: string, subject?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${VOICE_AGENT_WS_URL}?token=${encodeURIComponent(token)}`);
      this.ws = ws;

      const rejectAndCleanup = (err: unknown) => {
        ws.close();
        this.ws = null;
        reject(err);
      };

      ws.onerror = () => rejectAndCleanup(new Error("websocket error"));

      ws.onopen = () => {
        // Inline agent configuration (agent_id binding is also supported;
        // inline keeps this MVP serverless with nothing to provision).
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: buildSystemPrompt(subject),
              greeting: KT_GREETING,
              input: {
                format: { encoding: "audio/pcm", sample_rate: 24000 },
                turn_detection: { interrupt_response: true },
              },
              output: { format: { encoding: "audio/pcm", sample_rate: 24000 } },
            },
          })
        );
        this.startMicCapture();
        window.setTimeout(() => {
          if (!this.sessionReady && this.ws === ws) {
            rejectAndCleanup(new Error("session handshake timeout"));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          this.handleMessage(JSON.parse(event.data as string));
        } catch {
          console.error("Failed to parse voice agent message");
        }
      };

      ws.onclose = () => {
        if (!this.cleanedUp) {
          if (!this.sessionReady && !this.endedByUser) {
            rejectAndCleanup(new Error("websocket closed before ready"));
          } else {
            this.cleanup();
            if (!this.endedByUser) {
              this.fail(
                "network",
                "The connection was interrupted and your session ended. Please start again when ready."
              );
            }
          }
        }
      };

      const checkReady = window.setInterval(() => {
        if (this.sessionReady && this.ws === ws) {
          window.clearInterval(checkReady);
          resolve();
        } else if (this.ws !== ws) {
          window.clearInterval(checkReady);
        }
      }, 50);
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "session.ready":
        console.debug("[KT] session.ready — streaming mic audio to the agent");
        this.sessionReady = true;
        this.callbacks.onStateChange("listening");
        break;

      case "session.error": {
        const code = String(msg.error_code ?? msg.code ?? "unknown");
        console.error("session.error:", code, msg.message);
        this.callbacks.onProtocolError?.(code, String(msg.message ?? ""));
        if (code === "unauthorized") {
          this.fail("config", "Your session token expired. Please start a new session.");
        } else {
          this.fail(
            "connection_failed",
            "Something went wrong with the voice session. Please try again."
          );
        }
        break;
      }

      case "input.speech.started":
        // Barge-in: the user started speaking while KT was talking.
        this.flushOutput();
        this.callbacks.onStateChange("listening");
        break;

      case "transcript.user.delta":
        this.callbacks.onUserPartial(String(msg.text ?? msg.delta ?? ""));
        break;

      case "input.speech.stopped":
        this.callbacks.onStateChange("thinking");
        break;

      case "transcript.user":
        this.callbacks.onUserFinal(String(msg.text ?? msg.transcript ?? ""));
        break;

      case "reply.started":
        this.callbacks.onStateChange("thinking");
        break;

      case "reply.audio": {
        const data = String(msg.data ?? msg.audio ?? "");
        if (data) {
          this.callbacks.onStateChange("speaking");
          this.playPcmChunk(data);
        }
        break;
      }

      case "transcript.agent":
        this.callbacks.onAgentFinal(String(msg.text ?? msg.transcript ?? ""));
        break;

      case "reply.done":
        if (msg.status === "interrupted") this.flushOutput();
        this.callbacks.onStateChange("listening");
        break;

      case "session.ended":
        this.cleanup();
        break;

      default:
        break;
    }
  }

  private startMicCapture(): void {
    const ctx = this.audioCtx!;
    this.micSource = ctx.createMediaStreamSource(this.micStream!);
    this.micAnalyser = ctx.createAnalyser();
    this.micAnalyser.fftSize = 256;

    this.worklet = new AudioWorkletNode(ctx, "pcm-processor", {
      processorOptions: {
        inputSampleRate: ctx.sampleRate,
        targetSampleRate: 24000,
      },
    });

    this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (this.muted || !this.sessionReady) return;
      this.sendAudioChunk(event.data);
    };

    this.micSource.connect(this.micAnalyser);
    this.micSource.connect(this.worklet);

    // Output path: KT's speech goes through an analyser (for the voice
    // visualizer) and then to the speakers.
    this.outAnalyser = ctx.createAnalyser();
    this.outAnalyser.fftSize = 256;
    this.outAnalyser.connect(ctx.destination);
    // The worklet needs a path to the destination to keep processing,
    // but with zero gain so the mic is never audible (prevents echo).
    this.sinkGain = ctx.createGain();
    this.sinkGain.gain.value = 0;
    this.worklet.connect(this.sinkGain);
    this.sinkGain.connect(ctx.destination);
  }

  private sendAudioChunk(buffer: ArrayBuffer): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    this.ws.send(JSON.stringify({ type: "input.audio", audio: btoa(binary) }));
  }

  private playPcmChunk(base64: string): void {
    const ctx = this.audioCtx;
    if (!ctx) return;
    try {
      const binary = atob(base64);
      const pcm = new Int16Array(binary.length / 2);
      for (let i = 0; i < pcm.length; i++) {
        pcm[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
      }
      if (pcm.length === 0) return;

      const float = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768;

      const buffer = ctx.createBuffer(1, float.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(float, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outAnalyser!);
      this.outputSources.add(source);
      source.onended = () => this.outputSources.delete(source);

      const now = ctx.currentTime;
      if (this.nextPlayTime < now) this.nextPlayTime = now;
      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }

  /** Immediately discard all queued KT speech (barge-in / interruption). */
  private flushOutput(): void {
    this.outputSources.forEach((src) => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    });
    this.outputSources.clear();
    this.nextPlayTime = 0;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  /** Cleanly ends the session: session.end first, then close. */
  end(): void {
    this.endedByUser = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "session.end" }));
      // Safety: if the server doesn't confirm within 3s, tear down anyway.
      window.setTimeout(() => {
        if (!this.cleanedUp) this.cleanup();
      }, 3000);
    } else {
      this.cleanup();
    }
  }

  private fail(kind: VoiceErrorKind, message: string): void {
    this.cleanup();
    this.callbacks.onStateChange("error", message);
    void kind;
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    this.sessionReady = false;
    this.flushOutput();

    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.close();
    } catch {
      /* ignore */
    }
    this.ws = null;

    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micSource?.disconnect();
    this.worklet?.disconnect();
    this.sinkGain?.disconnect();
    this.micAnalyser = null;
    this.outAnalyser?.disconnect();
    this.outAnalyser = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }

}
