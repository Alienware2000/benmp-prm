import { NextResponse } from "next/server";
import { loadReconciliationCached } from "@/lib/poc/cached-data";
import { askAi } from "@/lib/poc/ask";
import { createGeminiClient } from "@/lib/ai/gemini-client";
import { filterReconciliationByPeriod } from "@/lib/poc/reporting-period";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    question?: unknown;
    from?: unknown;
    to?: unknown;
  };
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "question is required" },
      },
      { status: 400 },
    );
  }

  const from = typeof body.from === "string" ? body.from.slice(0, 10) : "";
  const to = typeof body.to === "string" ? body.to.slice(0, 10) : "";
  const result = filterReconciliationByPeriod(
    await loadReconciliationCached(),
    { from, to },
  );
  const model = createGeminiClient() ?? undefined; // Gemini when a key is set, else deterministic
  const answer = await askAi(question, result, { model });
  return NextResponse.json({
    ok: true,
    data: { answer, usedModel: Boolean(model) },
  });
}
