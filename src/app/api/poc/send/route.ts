import { NextResponse } from "next/server";
import { loadReconciliation, loadOptOuts } from "@/lib/poc/db";
import { planMessages } from "@/lib/messages";
import { summarizePlan, filterByKind, type PlanKind } from "@/lib/poc/dispatch";
import { sendPlanned, parseAllowlist } from "@/lib/send";
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
 * Consent + safety gates on every send: Supabase opt_outs are skipped (also surfaced in
 * the preview summary), and when BENMP_SEND_ALLOWLIST is set only those numbers are
 * dispatched — the training wheels for going live with real sends.
 *
 * Reminders are event-driven: only planned when the due date has passed. For the POC the
 * period's due date is treated as already passed.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown; kind?: unknown };
  const confirm = body.confirm === true;
  const kind: PlanKind = body.kind === "thank_you" || body.kind === "reminder" ? body.kind : "all";

  const asOf = new Date().toISOString().slice(0, 10);
  const [result, optedOut] = await Promise.all([loadReconciliation(), loadOptOuts()]);
  const messages = filterByKind(planMessages(result, { asOf, dueDate: "1970-01-01" }), kind);

  if (!confirm) {
    return NextResponse.json({
      ok: true,
      data: { mode: "preview", summary: summarizePlan(messages, { optedOut }) },
    });
  }

  const report = await sendPlanned(messages, {
    adapter: getMessagingAdapter(),
    optedOut,
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
  });
  return NextResponse.json({ ok: true, data: { mode: "sent", report } });
}
