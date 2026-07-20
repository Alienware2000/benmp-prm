/**
 * POC "ask" layer (POC-4).
 *
 * Answers the board's headline questions from a ReconciliationResult. The figures
 * come from ./answers (the only source of truth); a model — Gemini 2.5 on Vertex,
 * see src/lib/ai/model-registry — is optional and only *phrases* those grounded
 * figures. With no model (or no credentials) a deterministic answer is returned, so
 * the POC works before Gemini is wired.
 */

import type { ReconciliationResult } from "../reconcile";
import { headlineAnswers, formatGhs, type HeadlineAnswers } from "./answers";

/** Minimal model surface — the real Gemini/Vertex client is injected at POC-5 when creds exist. */
export interface PocModelClient {
  generate(prompt: string): Promise<string>;
}

export type AskOptions = { model?: PocModelClient };

/** How many example names an answer may cite — counts first, never a roll call. */
export const MAX_NAMES_IN_ANSWER = 5;

/** Top examples by amount, e.g. "Kofi (GHS 600), Ama (GHS 500) …and 109 more". */
function sampleNames(a: HeadlineAnswers): string {
  const top = [...a.unregistered]
    .sort((x, y) => y.amountMinor - x.amountMinor)
    .slice(0, MAX_NAMES_IN_ANSWER)
    .map((u) => `${u.name ?? "Unknown"} (GHS ${formatGhs(u.amountMinor)})`);
  const rest = a.unregistered.length - top.length;
  return top.join(", ") + (rest > 0 ? ` …and ${rest} more` : "");
}

/** A compact, factual grounding block the model must answer from — no figures invented. */
export function buildGrounding(a: HeadlineAnswers): string {
  const names = a.unregistered.length > 0 ? sampleNames(a) : "";
  return [
    `Period figures (use ONLY these; do not compute or invent numbers):`,
    `- People who paid: ${a.paidCount} (${a.registeredPaidCount} registered + ${a.unregisteredCount} unregistered).`,
    `- Registered partners who have NOT paid: ${a.unpaidCount}.`,
    `- Paid but not on the register (still included and thanked): ${a.unregisteredCount}. Largest: ${names || "none"}.`,
    `- Total collected: GHS ${a.totalCollectedGhs}.`,
    `- Of that, GHS ${a.statementTotalGhs} arrived as ${a.statementRowCount} bank/interop statement rows (e.g. "Ecobank MobileApp") — real money but not a person, so no thank-you is sent for them.`,
    `- Total people on the register + unregistered payers: ${a.totalPeople}.`,
    ``,
    `Style rules: lead with the number, not a list. Name at most ${MAX_NAMES_IN_ANSWER} people, then say "and N more — the full list is in the partners table". Never enumerate everyone.`,
  ].join("\n");
}

export function answerLocally(question: string, a: HeadlineAnswers): string {
  const q = question.toLowerCase();
  const isUnregistered =
    q.includes("unregist") ||
    q.includes("not on the register") ||
    q.includes("paid but") ||
    (q.includes("regist") && (q.includes("not") || q.includes("isn't") || q.includes("without")));
  const isUnpaid =
    q.includes("haven't") ||
    q.includes("hasn't") ||
    q.includes("didn't") ||
    q.includes("unpaid") ||
    q.includes("not paid") ||
    q.includes("owe") ||
    q.includes("yet to");
  const isTotal =
    q.includes("total") || q.includes("how much") || q.includes("amount") || q.includes("collect") || q.includes("rais");
  const isPaid = q.includes("paid") || q.includes("gave") || q.includes("give");

  if (isUnregistered) {
    const names = a.unregistered.length > 0 ? sampleNames(a) : "";
    const tail =
      a.unregistered.length > MAX_NAMES_IN_ANSWER
        ? " The full list is in the partners table below."
        : "";
    return `${a.unregisteredCount} paid but are not on the register — they are still included and thanked${names ? `. Largest: ${names}.` : "."}${tail}`;
  }
  if (isUnpaid) {
    return `${a.unpaidCount} registered partners have not paid this period yet.`;
  }
  if (isTotal) {
    return `GHS ${a.totalCollectedGhs} collected this period from ${a.paidCount} gifts.`;
  }
  if (isPaid) {
    return `${a.paidCount} people paid this period (${a.registeredPaidCount} registered + ${a.unregisteredCount} unregistered).`;
  }
  return (
    `This period: ${a.paidCount} paid (${a.registeredPaidCount} registered + ${a.unregisteredCount} unregistered), ` +
    `${a.unpaidCount} registered still unpaid, GHS ${a.totalCollectedGhs} collected.`
  );
}

export async function askAi(
  question: string,
  result: ReconciliationResult,
  opts: AskOptions = {},
): Promise<string> {
  const a = headlineAnswers(result);
  if (opts.model) {
    const prompt = `${buildGrounding(a)}\n\nQuestion: ${question}\n\nAnswer in one or two sentences using ONLY the figures above. Lead with the number; never list more than ${MAX_NAMES_IN_ANSWER} names.`;
    try {
      return await opts.model.generate(prompt);
    } catch (err) {
      // A model outage must never break the ask box — fall back to the same
      // grounded deterministic answer used when no model is configured.
      console.error(
        JSON.stringify({ evt: "poc_ask_model_failed", error: err instanceof Error ? err.message : String(err) }),
      );
      return answerLocally(question, a);
    }
  }
  return answerLocally(question, a);
}
