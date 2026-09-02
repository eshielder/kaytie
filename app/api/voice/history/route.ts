import { NextRequest, NextResponse } from "next/server";
import { getAssemblyAIConfig, AGENTS_BASE_URL } from "@/lib/assemblyai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy to the AssemblyAI Voice Agent session-history REST API so the API
 * key never reaches the browser.
 *
 * GET /api/voice/history            → latest sessions (list)
 * GET /api/voice/history?id=sess_x  → one session incl. artifacts (recording)
 */

export async function GET(req: NextRequest) {
  let apiKey: string;
  try {
    apiKey = getAssemblyAIConfig().apiKey;
  } catch {
    return NextResponse.json(
      { error: "config", message: "KT isn't set up yet (missing ASSEMBLYAI_API_KEY)." },
      { status: 503 }
    );
  }

  const sessionId = req.nextUrl.searchParams.get("id");
  const upstreamUrl = sessionId
    ? `${AGENTS_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`
    : `${AGENTS_BASE_URL}/sessions?limit=20`;

  try {
    const res = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Voice agent history request failed:", res.status, detail);
      return NextResponse.json(
        { error: "upstream", message: "Couldn't load session history." },
        { status: res.status === 401 ? 502 : res.status }
      );
    }

    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Voice agent history request error:", err);
    return NextResponse.json(
      { error: "network", message: "Couldn't reach the voice service." },
      { status: 502 }
    );
  }
}
