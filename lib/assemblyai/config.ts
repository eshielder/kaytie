/**
 * Server-side AssemblyAI configuration.
 *
 * The API key lives ONLY on the server. The browser never sees it —
 * it receives a short-lived, single-use token minted by /api/voice/token.
 */

export const AGENTS_BASE_URL = "https://agents.assemblyai.com/v1";
export const VOICE_AGENT_WS_URL = "wss://agents.assemblyai.com/v1/ws";
export const LLM_GATEWAY_URL = "https://llm-gateway.assemblyai.com/v1/chat/completions";

/** Token redemption window: client must open the WebSocket within this time. */
export const TOKEN_EXPIRES_IN_SECONDS = 300;
/** Hard cap on a single voice session (60 min). */
export const MAX_SESSION_DURATION_SECONDS = 3600;

export interface AssemblyAIConfig {
  apiKey: string;
}

/**
 * Validates that ASSEMBLYAI_API_KEY is present.
 * Throws a friendly error the API route turns into a 503 response.
 */
export function getAssemblyAIConfig(): AssemblyAIConfig {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "ASSEMBLYAI_API_KEY is not configured. Add it to your environment variables (or .env.local) and restart the server."
    );
  }

  return { apiKey: apiKey.trim() };
}

export function isAssemblyAIConfigured(): boolean {
  return Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
}
