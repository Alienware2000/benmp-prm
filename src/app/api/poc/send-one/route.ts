import { NextResponse } from "next/server";
import { z } from "zod";
import { buildThankYouMessage, type PlannedMessage } from "@/lib/messages";
import {
  loadOptOuts,
  recordSentMessages,
  toSentMessageRows,
} from "@/lib/poc/db";
import { normalizePhone } from "@/lib/phone";
import { parseAllowlist, sendPlanned } from "@/lib/send";
import { getMessagingAdapter } from "@/lib/messaging";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(8).max(30),
  amountGhs: z.coerce.number().positive().max(10_000_000),
});

/** Send one explicitly previewed thank-you through the configured provider. */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter a valid name, phone, and amount.",
        },
      },
      { status: 400 },
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_PHONE",
          message: "Enter the full international WhatsApp number.",
        },
      },
      { status: 400 },
    );
  }

  const amountMinor = Math.round(parsed.data.amountGhs * 100);
  const planned: PlannedMessage = {
    kind: "thank_you",
    to: phone,
    name: parsed.data.name,
    body: buildThankYouMessage(parsed.data.name, amountMinor),
    partnerRef: `manual:${phone}:${Date.now()}`,
    channel: "whatsapp",
    category: "utility",
    sendable: true,
  };

  const optedOut = await loadOptOuts();
  const report = await sendPlanned([planned], {
    adapter: getMessagingAdapter(),
    optedOut,
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
  });
  const audited = await recordSentMessages(
    toSentMessageRows([planned], report.outcomes),
  );
  const outcome = report.outcomes[0];

  if (outcome.status === "failed" || outcome.status === "skipped") {
    return NextResponse.json(
      {
        ok: false,
        data: { outcome, audited },
        error: {
          code:
            outcome.status === "skipped" ? "SEND_BLOCKED" : "PROVIDER_ERROR",
          message: outcome.reason ?? "The message was not accepted.",
        },
      },
      { status: outcome.status === "skipped" ? 409 : 502 },
    );
  }

  return NextResponse.json({ ok: true, data: { outcome, audited } });
}
