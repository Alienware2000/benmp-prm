import { NextResponse } from "next/server";
import { loadReconciliation } from "@/lib/poc/db";
import { planMessages } from "@/lib/messages";
import { summarizePlan } from "@/lib/poc/dispatch";
import { sendPlanned } from "@/lib/send";
import { getMessagingAdapter } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/**
 * Preview or send this period's thank-yous and reminders.
 *
 * POST { confirm?: boolean, includeReminders?: boolean }
 *  - confirm falsy (default): PREVIEW — plan the messages and return a summary, no sending.
 *  - confirm true: SEND — dispatch through the configured messaging adapter (mock until
 *    BENMP_MESSAGING_PROVIDER=twilio) and return the send report.
 *
 * Reminders are event-driven: only planned when the due date has passed. For the POC,
 * includeReminders (default true) treats the period's due date as already passed.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    confirm?: unknown;
    includeReminders?: unknown;
  };
  const confirm = body.confirm === true;
  const includeReminders = body.includeReminders !== false;

  const asOf = new Date().toISOString().slice(0, 10);
  // A due date in the past includes reminders; equal to asOf excludes them.
  const dueDate = includeReminders ? "1970-01-01" : asOf;

  const result = await loadReconciliation();
  const messages = planMessages(result, { asOf, dueDate });

  if (!confirm) {
    return NextResponse.json({
      ok: true,
      data: { mode: "preview", summary: summarizePlan(messages) },
    });
  }

  const report = await sendPlanned(messages, { adapter: getMessagingAdapter() });
  return NextResponse.json({ ok: true, data: { mode: "sent", report } });
}
