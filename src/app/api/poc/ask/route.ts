import { NextResponse } from "next/server";
import { loadReconciliationCached } from "@/lib/poc/cached-data";
import { askAiDetailed, type AskHistoryTurn } from "@/lib/poc/ask";
import { createGeminiClient } from "@/lib/ai/gemini-client";
import { filterReconciliationByPeriod } from "@/lib/poc/reporting-period";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    question?: unknown;
    from?: unknown;
    to?: unknown;
    history?: unknown;
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
  if (question.length > 1_000) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please keep the question under 1,000 characters.",
        },
      },
      { status: 400 },
    );
  }

  const from = typeof body.from === "string" ? body.from.slice(0, 10) : "";
  const to = typeof body.to === "string" ? body.to.slice(0, 10) : "";
  const history: AskHistoryTurn[] = Array.isArray(body.history)
    ? body.history
        .flatMap((turn) => {
          if (!turn || typeof turn !== "object") return [];
          const candidate = turn as { question?: unknown; answer?: unknown };
          if (
            typeof candidate.question !== "string" ||
            typeof candidate.answer !== "string"
          ) {
            return [];
          }
          return [
            {
              question: candidate.question.trim().slice(0, 500),
              answer: candidate.answer.trim().slice(0, 1_000),
            },
          ];
        })
        .filter((turn) => turn.question && turn.answer)
        .slice(-6)
    : [];
  const result = filterReconciliationByPeriod(
    await loadReconciliationCached(),
    { from, to },
  );
  const model = createGeminiClient() ?? undefined;
  const answer = await askAiDetailed(question, result, { model, history });
  return NextResponse.json({
    ok: true,
    data: answer,
  });
}
