/**
 * Read-only BENMP workspace assistant.
 *
 * Deterministic functions compute every figure and select the small, relevant set
 * of partner records. A configured model can explain those facts conversationally,
 * but it never receives the full directory and cannot mutate or send anything.
 */

import type { ReconciliationResult } from "../reconcile";
import { headlineAnswers, formatGhs, type HeadlineAnswers } from "./answers";
import { giverInsightGroups, type GiverCategory } from "./giver-insights";
import { reportingPeriod } from "./reporting-period";

export interface PocModelClient {
  generate(prompt: string): Promise<string>;
}

export type AskHistoryTurn = {
  question: string;
  answer: string;
};

export type AskOptions = {
  model?: PocModelClient;
  history?: AskHistoryTurn[];
};

export type AskResult = {
  answer: string;
  usedModel: boolean;
  groundedIn: string[];
  periodLabel: string;
};

type PartnerFact = {
  name: string;
  status: "registered giver" | "new giver" | "no gift recorded";
  category: GiverCategory | null;
  amountMinor: number;
  giftCount: number;
  latest: string;
};

export const MAX_NAMES_IN_ANSWER = 5;
const MAX_CONTEXT_RECORDS = 10;

function clean(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateLabel(iso: string): string {
  if (!iso) return "not dated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "not dated";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function categoryLabel(category: GiverCategory | null): string {
  if (category === "consistent") return "repeat giver";
  if (category === "top") return "top giver";
  if (category === "ordinary") return "ordinary giver";
  return "not categorized";
}

function allPartnerFacts(result: ReconciliationResult): PartnerFact[] {
  const groups = giverInsightGroups(result, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const categoryByName = new Map<string, GiverCategory>();
  for (const [category, records] of Object.entries(groups) as Array<
    [GiverCategory, (typeof groups)[GiverCategory]]
  >) {
    for (const record of records) {
      categoryByName.set(clean(record.name), category);
    }
  }

  return [
    ...result.registeredPaid.map((giver) => ({
      name: giver.registration.fullName,
      status: "registered giver" as const,
      category: categoryByName.get(clean(giver.registration.fullName)) ?? null,
      amountMinor: giver.totalMinor,
      giftCount: giver.payments.length,
      latest: giver.payments.reduce(
        (latest, payment) =>
          payment.paidAt > latest ? payment.paidAt : latest,
        "",
      ),
    })),
    ...result.paidUnregistered.map((giver) => {
      const name = giver.suggestedName ?? "Unknown giver";
      return {
        name,
        status: "new giver" as const,
        category: categoryByName.get(clean(name)) ?? null,
        amountMinor: giver.totalMinor,
        giftCount: giver.payments.length,
        latest: giver.payments.reduce(
          (latest, payment) =>
            payment.paidAt > latest ? payment.paidAt : latest,
          "",
        ),
      };
    }),
    ...result.registeredUnpaid.map((registration) => ({
      name: registration.fullName,
      status: "no gift recorded" as const,
      category: null,
      amountMinor: 0,
      giftCount: 0,
      latest: "",
    })),
  ];
}

function factLine(fact: PartnerFact): string {
  const giving =
    fact.amountMinor > 0 || fact.giftCount > 0
      ? `GHS ${formatGhs(fact.amountMinor)}${fact.giftCount > 0 ? ` across ${fact.giftCount} gift${fact.giftCount === 1 ? "" : "s"}` : " recorded"}; latest ${dateLabel(fact.latest)}`
      : "no gift in the selected period";
  return `${fact.name}: ${fact.status}; ${categoryLabel(fact.category)}; ${giving}`;
}

function partnerMatches(facts: PartnerFact[], query: string): PartnerFact[] {
  const normalizedQuery = clean(query);
  if (!normalizedQuery) return [];

  return facts
    .filter((fact) => {
      const name = clean(fact.name);
      if (!name || name === "unknown giver") return false;
      if (normalizedQuery.includes(name)) return true;
      const meaningful = name.split(" ").filter((token) => token.length >= 3);
      return (
        meaningful.length > 0 &&
        meaningful.every((token) => normalizedQuery.includes(token))
      );
    })
    .slice(0, MAX_CONTEXT_RECORDS);
}

/** Top examples by amount, e.g. "Kofi (GHS 600), Ama (GHS 500) ...and 109 more". */
function sampleNames(a: HeadlineAnswers): string {
  const top = [...a.unregistered]
    .sort((x, y) => y.amountMinor - x.amountMinor)
    .slice(0, MAX_NAMES_IN_ANSWER)
    .map((u) => `${u.name ?? "Unknown"} (GHS ${formatGhs(u.amountMinor)})`);
  const rest = a.unregistered.length - top.length;
  return top.join(", ") + (rest > 0 ? ` …and ${rest} more` : "");
}

/** Backwards-compatible headline grounding used by unit tests and simple callers. */
export function buildGrounding(
  a: HeadlineAnswers,
  periodLabel = "the selected giving period",
): string {
  const names = a.unregistered.length > 0 ? sampleNames(a) : "";
  return [
    `Giving figures for ${periodLabel} (use ONLY these; do not compute or invent numbers):`,
    `- People who paid: ${a.paidCount} (${a.registeredPaidCount} registered + ${a.unregisteredCount} unregistered).`,
    `- Registered partners who have NOT paid: ${a.unpaidCount}.`,
    `- Paid but not on the register: ${a.unregisteredCount}. Largest: ${names || "none"}.`,
    `- Total collected: GHS ${a.totalCollectedGhs}.`,
    `- GHS ${a.statementTotalGhs} arrived as ${a.statementRowCount} bank or interoperability statement rows. These count as money, not people.`,
    `- Total people represented: ${a.totalPeople}.`,
    `Style: lead with the number. Never enumerate a large audience; show at most ${MAX_NAMES_IN_ANSWER} examples and direct staff to the relevant workspace group.`,
  ].join("\n");
}

function relevantCategoryLines(
  result: ReconciliationResult,
  query: string,
): string[] {
  const groups = giverInsightGroups(result, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const q = clean(query);
  const sections: string[] = [];

  const append = (label: string, records: typeof groups.top) => {
    sections.push(
      `${label} (${records.length}): ${
        records
          .slice(0, MAX_CONTEXT_RECORDS)
          .map(
            (giver) =>
              `${giver.name} - GHS ${formatGhs(giver.amountMinor)}, ${giver.giftCount} gift${giver.giftCount === 1 ? "" : "s"}`,
          )
          .join("; ") || "none"
      }`,
    );
  };

  if (/top|major|largest|biggest|highest/.test(q))
    append("Top givers", groups.top);
  if (/repeat|consistent|faithful|regular/.test(q))
    append("Repeat givers", groups.consistent);
  if (/ordinary|occasional|one time|one gift/.test(q))
    append("Ordinary givers", groups.ordinary);
  return sections;
}

export function buildWorkspaceGrounding(
  result: ReconciliationResult,
  question: string,
  history: AskHistoryTurn[] = [],
): { prompt: string; groundedIn: string[] } {
  const period = reportingPeriod(result).label;
  const answers = headlineAnswers(result);
  const recentHistory = history.slice(-4);
  const lookupQuery = [
    ...recentHistory.map((turn) => turn.question),
    question,
  ].join(" ");
  const facts = allPartnerFacts(result);
  const matches = partnerMatches(facts, lookupQuery);
  const q = clean(question);
  const sections = [buildGrounding(answers, period)];
  const groundedIn = ["selected giving records", "BENMP workflow guide"];

  if (matches.length > 0) {
    sections.push(
      `Partner records relevant to this conversation:\n${matches.map((fact) => `- ${factLine(fact)}`).join("\n")}`,
    );
    groundedIn.push("relevant partner records");
  }

  const categoryLines = relevantCategoryLines(result, question);
  if (categoryLines.length > 0) {
    sections.push(
      `Relevant giver groups:\n${categoryLines.map((line) => `- ${line}`).join("\n")}`,
    );
    groundedIn.push("giver categories");
  }

  if (/unpaid|not paid|hasn t given|haven t given|remind|no gift/.test(q)) {
    sections.push(
      `Sample registered partners with no gift in this period (${result.registeredUnpaid.length} total):\n${
        result.registeredUnpaid
          .slice(0, MAX_CONTEXT_RECORDS)
          .map((partner) => `- ${partner.fullName}`)
          .join("\n") || "- none"
      }`,
    );
    groundedIn.push("follow-up records");
  }

  sections.push(
    [
      "BENMP workspace guide:",
      "- Dashboard: overview, action shortcuts, attention items, and top/repeat/ordinary giver groups.",
      "- Giving: review verified gifts, choose the giving period, filter by giver name or amount, and prepare acknowledgements.",
      "- Messages: thank givers, remind partners with no gift, send ministry updates, choose a category-based audience, use approved drafts, add attachments, review, then explicitly confirm before sending.",
      "- Calls: a focused list of top and repeat givers for personal follow-up.",
      "- The giving period follows staff across pages. The assistant is read-only and cannot send messages, change records, or make financial decisions.",
    ].join("\n"),
  );

  const conversation = recentHistory.length
    ? `Previous conversation:\n${recentHistory
        .map(
          (turn) =>
            `Staff: ${turn.question.slice(0, 500)}\nAssistant: ${turn.answer.slice(0, 700)}`,
        )
        .join("\n")}`
    : "Previous conversation: none";

  return {
    groundedIn: [...new Set(groundedIn)],
    prompt: [
      "You are BENMP AI, the read-only assistant inside the BENMP Partner Relationship Management workspace.",
      "Answer the staff member's question directly from the supplied records and workspace guide.",
      "Never invent a person, amount, date, status, feature, or completed action. Never claim that you sent or changed anything.",
      "If the records do not contain the requested detail, say so plainly and identify the best page or next staff action.",
      "Use plain language for a non-technical ministry office. Prefer one short paragraph and bullets only when they make a list easier to scan. Do not use markdown tables.",
      "Do not expose phone numbers. Mention at most 10 people and say where the full group can be reviewed.",
      "",
      ...sections,
      "",
      conversation,
      `Current question: ${question}`,
    ].join("\n"),
  };
}

export function answerLocally(
  question: string,
  a: HeadlineAnswers,
  periodLabel = "the selected giving period",
): string {
  const q = clean(question);
  const isUnregistered =
    q.includes("unregist") ||
    q.includes("not on the register") ||
    q.includes("paid but") ||
    (q.includes("regist") && (q.includes("not") || q.includes("without")));
  const isUnpaid =
    q.includes("haven t") ||
    q.includes("hasn t") ||
    q.includes("didn t") ||
    q.includes("unpaid") ||
    q.includes("not paid") ||
    q.includes("owe") ||
    q.includes("yet to");
  const isTotal =
    q.includes("total") ||
    q.includes("how much") ||
    q.includes("amount") ||
    q.includes("collect") ||
    q.includes("rais");
  const isPaid = q.includes("paid") || q.includes("gave") || q.includes("give");

  if (isUnregistered) {
    const names = a.unregistered.length > 0 ? sampleNames(a) : "";
    const tail =
      a.unregistered.length > MAX_NAMES_IN_ANSWER
        ? " The full group is available in Messages."
        : "";
    return `${a.unregisteredCount} people gave but are not yet on the register. They are still included for acknowledgement${names ? `. Largest examples: ${names}.` : "."}${tail}`;
  }
  if (isUnpaid) {
    return `${a.unpaidCount} registered partners have not paid during ${periodLabel}; no gift is recorded for them in that window. Review this group under Messages, then prepare a gentle reminder if appropriate.`;
  }
  if (isTotal) {
    return `GHS ${a.totalCollectedGhs} was recorded during ${periodLabel}. ${a.paidCount} identifiable people gave, alongside ${a.statementRowCount} bank or interoperability statement rows.`;
  }
  if (isPaid) {
    return `${a.paidCount} people gave during ${periodLabel}: ${a.registeredPaidCount} registered partners and ${a.unregisteredCount} new givers not yet linked to the register.`;
  }
  return `During ${periodLabel}, ${a.paidCount} people gave, ${a.unpaidCount} registered partners have no recorded gift, and GHS ${a.totalCollectedGhs} was recorded.`;
}

function answerLocallyFromResult(
  question: string,
  result: ReconciliationResult,
  history: AskHistoryTurn[],
): string {
  const q = clean(question);
  const period = reportingPeriod(result).label;
  const facts = allPartnerFacts(result);
  const lookupQuery = [
    ...history.slice(-3).map((turn) => turn.question),
    question,
  ].join(" ");
  const matches = partnerMatches(facts, lookupQuery);
  const groups = giverInsightGroups(result, {
    limit: Number.MAX_SAFE_INTEGER,
  });

  if (/top|major|largest|biggest|highest/.test(q)) {
    const examples = groups.top
      .slice(0, MAX_NAMES_IN_ANSWER)
      .map((giver) => `${giver.name} (GHS ${formatGhs(giver.amountMinor)})`)
      .join(", ");
    return `${groups.top.length} people are in the top-giver group for ${period}. The leading records are ${examples || "not available"}. Open the Dashboard giver groups for the full list.`;
  }
  if (/repeat|consistent|faithful|regular/.test(q)) {
    return `${groups.consistent.length} people are repeat givers for ${period}. Review the Repeat group on the Dashboard or open Calls for personal follow-up.`;
  }
  if (/ordinary|occasional|one time|one gift/.test(q)) {
    return `${groups.ordinary.length} people are ordinary givers for ${period}. They gave, but are not in the top or repeat groups. The Dashboard shows up to 20 at a time.`;
  }
  if (matches.length > 0) {
    return matches.slice(0, 3).map(factLine).join("\n");
  }
  if (/how.*(thank|message)|send.*message|attachment|draft/.test(q)) {
    return "Open Messages, choose the purpose, select a giver category, review or edit the draft, add an attachment if needed, and confirm the final recipients before sending. The assistant cannot send on your behalf.";
  }
  if (/filter|find.*gift|amount/.test(q) && !/total|how much/.test(q)) {
    return "Open Giving to choose a period and filter verified gifts by giver name, minimum amount, or maximum amount. You can begin an individual or group acknowledgement from those records.";
  }
  if (/where|page|dashboard|what can|how.*work|help/.test(q)) {
    return "Use Dashboard for the overview and giver groups, Giving for verified gifts and amount filters, Messages for acknowledgements and updates, and Calls for top or repeat-giver follow-up. Your selected giving period follows you across all four pages.";
  }
  return answerLocally(question, headlineAnswers(result), period);
}

function normalizeModelAnswer(answer: string): string {
  return answer
    .trim()
    .replace(/^(\s*)\*\s+/gm, "$1- ")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
}

export async function askAiDetailed(
  question: string,
  result: ReconciliationResult,
  opts: AskOptions = {},
): Promise<AskResult> {
  const history = opts.history?.slice(-6) ?? [];
  const grounding = buildWorkspaceGrounding(result, question, history);
  const periodLabel = reportingPeriod(result).label;

  if (opts.model) {
    try {
      const answer = normalizeModelAnswer(
        await opts.model.generate(grounding.prompt),
      );
      if (answer.trim()) {
        return {
          answer,
          usedModel: true,
          groundedIn: grounding.groundedIn,
          periodLabel,
        };
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          evt: "poc_ask_model_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return {
    answer: answerLocallyFromResult(question, result, history),
    usedModel: false,
    groundedIn: grounding.groundedIn,
    periodLabel,
  };
}

/** Simple string-returning compatibility wrapper. */
export async function askAi(
  question: string,
  result: ReconciliationResult,
  opts: AskOptions = {},
): Promise<string> {
  return (await askAiDetailed(question, result, opts)).answer;
}
