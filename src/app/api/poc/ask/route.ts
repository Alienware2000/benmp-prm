import { NextResponse } from "next/server";
import { loadReconciliation } from "@/lib/poc/db";
import { askAi } from "@/lib/poc/ask";
import { createGeminiClient } from "@/lib/ai/gemini-client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "question is required" } },
      { status: 400 },
    );
  }

  const result = await loadReconciliation();
  const model = createGeminiClient() ?? undefined; // Gemini when a key is set, else deterministic
  const answer = await askAi(question, result, { model });
  return NextResponse.json({ ok: true, data: { answer, usedModel: Boolean(model) } });
}
