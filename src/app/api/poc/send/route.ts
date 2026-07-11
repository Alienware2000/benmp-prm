import { NextResponse } from "next/server";
import { loadReconciliation } from "@/lib/poc/db";
import { planMessages } from "@/lib/messages";
import { summarizePlan, filterByKind, type PlanKind } from "@/lib/poc/dispatch";
import { sendPlanned } from "@/lib/send";
import { getMessagingAdapter } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/**
 * Preview or send this period's thank-yous and reminders.
 *
 * POST { confirm?: boolean, kind?: "thank_you" | "reminder" | "all" }
 *  - confirm falsy (default): PREVIEW — plan the messages and return a summary, no sending.
 *  - confirm true: SEND — dispatch through the configured messaging adapter (mock until
 *    BENMP_MESSAGING_PROVIDER=twilio) and return the send report.
 *  - kind (default "all"): restrict the preview/send to one queue so the Message Center
 *    can operate thank-yous and reminders independently.
 *
 * Reminders are event-driven: only planned when the due date has passed. For the POC the
 * period's due date is treated as already passed.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown; kind?: unknown };
  const confirm = body.confirm === true;
  const kind: PlanKind = body.kind === "thank_you" || body.kind === "reminder" ? body.kind : "all";

  const asOf = new Date().toISOString().slice(0, 10);
  const result = await loadReconciliation();
  const messages = filterByKind(planMessages(result, { asOf, dueDate: "1970-01-01" }), kind);

  if (!confirm) {
    return NextResponse.json({
      ok: true,
      data: { mode: "preview", summary: summarizePlan(messages) },
    });
  }

  const report = await sendPlanned(messages, { adapter: getMessagingAdapter() });
  return NextResponse.json({ ok: true, data: { mode: "sent", report } });
}
