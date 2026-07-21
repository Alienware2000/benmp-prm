import { NextResponse } from "next/server";
import { z } from "zod";
import { buildThankYouMessage, type PlannedMessage } from "@/lib/messages";
import { getMessagingAdapter } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import {
  findSentMessageByPartnerRef,
  loadOptOuts,
  recordSentMessages,
  toSentMessageRows,
} from "@/lib/poc/db";
import { parseAllowlist, sendPlanned } from "@/lib/send";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  idempotencyKey: z.uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  amountGhs: z.coerce.number().positive().max(10_000_000),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "Check the donor, destination, and gift amount." },
      },
      { status: 400 },
    );
  }

  const to = normalizePhone(parsed.data.phone);
  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "Enter the full international WhatsApp number." },
      },
      { status: 400 },
    );
  }

  const amountMinor = Math.round(parsed.data.amountGhs * 100);
  const body = buildThankYouMessage(parsed.data.fullName, amountMinor);
  const partnerRef = `gift-test:${parsed.data.idempotencyKey}:${to}`;
  const previous = await findSentMessageByPartnerRef(partnerRef);

  if (
    previous &&
    (previous.status === "queued" || previous.status === "sent")
  ) {
    if (previous.body !== body) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Start a new test before changing a sent message.",
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      ok: true,
      data: {
        to,
        body,
        audited: true,
        idempotentReplay: true,
        outcome: {
          status: previous.status,
          providerMessageId: previous.providerMessageId,
        },
      },
    });
  }

  const planned: PlannedMessage = {
    kind: "thank_you",
    to,
    name: parsed.data.fullName,
    body,
    partnerRef,
    channel: "whatsapp",
    category: "utility",
    sendable: true,
  };
  const report = await sendPlanned([planned], {
    adapter: getMessagingAdapter(),
    optedOut: await loadOptOuts(),
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
  });
  const outcome = report.outcomes[0];
  const audited = await recordSentMessages(
    toSentMessageRows([planned], report.outcomes),
  );

  if (outcome.status === "failed" || outcome.status === "skipped") {
    return NextResponse.json(
      {
        ok: false,
        error: { message: outcome.reason ?? "The message was not accepted." },
      },
      { status: outcome.status === "skipped" ? 409 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      to,
      body,
      audited,
      idempotentReplay: false,
      outcome,
    },
  });
}
