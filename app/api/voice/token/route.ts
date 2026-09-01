import { NextResponse } from "next/server";
import {
  getAssemblyAIConfig,
  AGENTS_BASE_URL,
  TOKEN_EXPIRES_IN_SECONDS,
  MAX_SESSION_DURATION_SECONDS,
} from "@/lib/assemblyai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a short-lived, single-use Voice Agent token for the browser.
 * The permanent ASSEMBLYAI_API_KEY never leaves the server.
 */
export async function GET() {
  let apiKey: string;
  try {
    apiKey = getAssemblyAIConfig().apiKey;
  } catch {
    return NextResponse.json(
      {
        error: "config",
        message:
          "KT isn't set up yet. The ASSEMBLYAI_API_KEY environment variable is missing.",
      },
      { status: 503 }
    );
  }

  try {
    const url = new URL(`${AGENTS_BASE_URL}/token`);
    url.searchParams.set("expires_in_seconds", String(TOKEN_EXPIRES_IN_SECONDS));
    url.searchParams.set(
      "max_session_duration_seconds",
      String(MAX_SESSION_DURATION_SECONDS)
    );

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Voice agent token request failed:", res.status, detail);
      return NextResponse.json(
        {
          error: res.status === 401 ? "invalid_key" : "upstream",
          message:
            res.status === 401
              ? "The configured AssemblyAI API key was rejected. Please check ASSEMBLYAI_API_KEY."
              : "We couldn't start a learning session right now. Please try again in a moment.",
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { token: string; expires_in_seconds: number };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Voice agent token request error:", err);
    return NextResponse.json(
      {
        error: "network",
        message:
          "We couldn't reach the voice service. Check your connection and try again.",
      },
      { status: 502 }
    );
  }
}
