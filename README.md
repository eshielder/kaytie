# KT — Learn by talking.

KT is a voice-first AI tutor. Press **Start Learning**, speak naturally ("KT, explain photosynthesis"), and KT listens, teaches, and responds with natural speech — like Alexa, but built to teach you.

Built with Next.js (App Router), React, TypeScript, Tailwind CSS, and **AssemblyAI's Voice Agent API** for real-time, barge-in-capable voice conversation.

## How it works

```
Browser                          Next.js (serverless)              AssemblyAI
───────                          ────────────────────              ──────────
/tutor ── GET /api/voice/token ──► mints single-use token ────────► GET /v1/token
   │        (API key stays here)     (agents.assemblyai.com)
   ▼
WSS wss://agents.assemblyai.com/v1/ws?token=... ◄───────────────────► Voice Agent
  • streams mic audio (24 kHz PCM16, base64)                           STT + LLM + TTS
  • receives streamed PCM16 speech, transcripts, turn events           (realtime,
  • barge-in: user speech interrupts KT instantly                      managed)
```

- **STT / LLM / TTS**: AssemblyAI Voice Agent (turn detection, semantic barge-in, streaming TTS are handled server-side by AssemblyAI).
- **Session summaries** ("Topic / What you learned") are generated with AssemblyAI's **LLM Gateway** at `POST /api/voice/summary`, with a local fallback.
- No database, no auth — nothing is stored.

## Setup

```bash
npm install
cp .env.local.example .env.local   # add your ASSEMBLYAI_API_KEY
npm run dev
```

Open http://localhost:3000, click **Start Learning**, allow the microphone, and talk.

> Microphone access requires **HTTPS or localhost**. Chrome/Edge recommended.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | yes | Server-side only. Mints session tokens; never sent to the browser. |
| `KT_SUMMARY_MODEL` | no | LLM Gateway model for summaries (default `gpt-5.2`). |

## Project structure

```
app/
  page.tsx                 # Landing: "What would you like to learn?"
  tutor/page.tsx           # Voice screen: states, transcript, session controls
  api/voice/token/route.ts # Mints single-use Voice Agent tokens (server-side)
  api/voice/summary/route.ts # Session summary via AssemblyAI LLM Gateway
components/
  KTLogo.tsx  VoiceButton.tsx  VoiceVisualizer.tsx  Conversation.tsx  SessionSummary.tsx
lib/
  assemblyai/config.ts     # Server config + validated API endpoints
  assemblyai/client.ts     # Browser Voice Agent WebSocket session
  tutor/prompt.ts          # KT tutor persona + system prompt
public/pcm-processor.js    # AudioWorklet: mic -> 24 kHz PCM16
types/voice.ts
```

## Voice session details (AssemblyAI Voice Agent API)

- Connect: `wss://agents.assemblyai.com/v1/ws?token=<single-use-token>`
- First message: `session.update` with the inline agent (system prompt, greeting, 24 kHz PCM in/out) — `agent_id` binding is also supported if you prefer a stored agent.
- Mic capture via AudioWorklet, resampled to mono 24 kHz PCM16, sent as base64 `input.audio` chunks (~real-time pace).
- Turn detection events (`input.speech.started/stopped`, `transcript.user(.delta)`) drive the UI states: **Listening -> Thinking -> Speaking -> Listening**.
- Barge-in: on `input.speech.started` during a reply (or `reply.done` with `status: "interrupted"`), all queued playback is flushed.
- Clean shutdown: `session.end` before closing the socket (avoids the billable 30s resume grace window), plus a `pagehide` handler for tab closes.

## Error handling

Friendly messages for: denied/missing microphone, missing or invalid API key, connection failures/network drops, playback errors, and session timeouts. No technical errors are surfaced to the user.

## Deploy (Vercel)

1. Push to GitHub and import into Vercel.
2. Add `ASSEMBLYAI_API_KEY` (and optionally `KT_SUMMARY_MODEL`) in project environment variables.
3. Deploy — the voice token route and summary route run as serverless functions.
