import { NextRequest, NextResponse } from "next/server";
import { getAssemblyAIConfig, LLM_GATEWAY_URL } from "@/lib/assemblyai/config";
import type { SessionSummaryData, SummaryMessage } from "@/types/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = process.env.KT_SUMMARY_MODEL || "gpt-5.2";

function heuristicSummary(messages: SummaryMessage[]): SessionSummaryData {
  const firstUser = messages.find((m) => m.speaker === "user");
  const topic = firstUser
    ? firstUser.text.replace(/^(kt[, ]+|hey kt[, ]+)/i, "").slice(0, 80) || "What we talked about"
    : "What we talked about";

  const learned = messages
    .filter((m) => m.speaker === "kt" && m.text.trim().length > 0)
    .slice(0, 3)
    .map((m) => m.text.slice(0, 120));

  return { topic, learned: learned.length > 0 ? learned : ["A conversation on this topic"] };
}

/**
 * Generates the end-of-session summary ("Topic / What you learned")
 * using AssemblyAI's LLM Gateway, with a local heuristic fallback.
 */
export async function POST(req: NextRequest) {
  let messages: SummaryMessage[];
  try {
    const body = (await req.json()) as { messages?: SummaryMessage[] };
    messages = (body.messages ?? []).filter(
      (m) => (m.speaker === "user" || m.speaker === "kt") && typeof m.text === "string"
    );
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Invalid request body." },
      { status: 400 }
    );
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { topic: "A short session", learned: ["You started a learning session."] }
    );
  }

  let apiKey: string;
  try {
    apiKey = getAssemblyAIConfig().apiKey;
  } catch {
    // Fall back to a client-friendly heuristic rather than failing the flow.
    return NextResponse.json(heuristicSummary(messages));
  }

  const transcript = messages
    .map((m) => `${m.speaker === "user" ? "Learner" : "KT"}: ${m.text}`)
    .join("\n");

  try {
    const res = await fetch(LLM_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You summarize short voice tutoring sessions. Reply with ONLY valid JSON in this exact shape: {\"topic\": string, \"learned\": string[]}. topic = the main subject the learner asked about, at most 6 words. learned = 3 short bullet phrases describing what the learner was taught, at most 10 words each. Never add any other keys or commentary.",
          },
          { role: "user", content: `Session transcript:\n\n${transcript}` },
        ],
        temperature: 0.2,
      }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`LLM Gateway responded ${res.status}`);

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in LLM Gateway response");

    const parsed = JSON.parse(jsonMatch[0]) as SessionSummaryData;
    return NextResponse.json({
      topic: typeof parsed.topic === "string" ? parsed.topic : "What we talked about",
      learned: Array.isArray(parsed.learned)
        ? parsed.learned.slice(0, 5).filter((l) => typeof l === "string")
        : [],
    });
  } catch (err) {
    console.error("Summary generation failed, using heuristic:", err);
    return NextResponse.json(heuristicSummary(messages));
  }
}
