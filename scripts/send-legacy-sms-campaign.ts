/**
 * Legacy Ghana SMS campaign — personalised, paced, resumable (Decisions 0019–0021).
 *
 * Sends the MOMO-change notice to the archived pre-hub Ghana contacts over FlashSMS.
 * SMS rather than WhatsApp because Meta's 24-hour window rejects every cold recipient
 * and no approved template exists (Decision 0020).
 *
 * Personalisation forces one request per recipient: FlashSMS /sms/send takes a single
 * `message` for the whole `phones` array, with no per-recipient merge. sendBulk() stays
 * available for an unpersonalised send; this script deliberately does not use it.
 *
 * SAFETY — this sends real messages to ~10.8k real people:
 *  - Dry run by default; nothing sends without --confirm.
 *  - Cost is checked against the live balance BEFORE the first send, using the longest
 *    rendered message in the run. Refuses to start if the account cannot cover it.
 *  - `last_sent_at` is stamped as each send succeeds, so an interruption resumes rather
 *    than restarting. Only dispatched outcomes are stamped (wasDispatched, Decision
 *    0021) — a skip or provider failure stays eligible for a retry.
 *  - Opt-outs are re-read at start and skipped.
 *  - BENMP_SEND_ALLOWLIST still applies: set it to one number for a live rehearsal.
 *  - Paced under the account's requests/min limit, with backoff on RATE_LIMITED (429).
 *  - Every attempt emits a structured log line and an audit row in sent_messages.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/send-legacy-sms-campaign.ts --plan
 *   npx tsx --env-file=.env.local scripts/send-legacy-sms-campaign.ts --limit 5
 *   npx tsx --env-file=.env.local scripts/send-legacy-sms-campaign.ts --confirm
 *
 * --plan       counts, cost and a rendered sample; no sending, no writes
 * --limit N    only the first N recipients (a small live rehearsal)
 * --confirm    actually send
 * --rate N     requests per minute (default 300)
 */
import { FlashSmsMessagingAdapter } from "../src/lib/messaging/flashsms-adapter";
import { greetingName } from "../src/lib/poc/greeting-name";
import {
  loadLegacyGhanaContacts,
  markLegacyContactsSent,
} from "../src/lib/poc/legacy-contacts";
import { loadOptOuts, recordSentMessages } from "../src/lib/poc/db";
import { parseAllowlist } from "../src/lib/send";

/** {name} is replaced per recipient; everything else is fixed. */
const TEMPLATE =
  "Dear {name}, we thank God and we thank you for standing with the Healing Jesus Campaign. From 31st August 2026, this is the new MOMO number all partners in Ghana should use for all BENMP MOMO contributions: 055 809 2692. Kindly save this number. God bless you. BENMP OFFICE";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const has = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const render = (name: string) => TEMPLATE.replace("{name}", name);

async function main() {
  const rate = Number(arg("rate") ?? 300);
  if (!Number.isFinite(rate) || rate < 1)
    throw new Error("--rate must be >= 1");
  const gapMs = 60_000 / rate;

  const adapter = new FlashSmsMessagingAdapter();
  const [contacts, optedOut] = await Promise.all([
    loadLegacyGhanaContacts(),
    loadOptOuts(),
  ]);
  const allowlist = parseAllowlist(process.env.BENMP_SEND_ALLOWLIST);

  let recipients = contacts
    // smsSentAt, NOT lastSentAt: the 2026-08-30 WhatsApp run must not exclude anyone
    // from this campaign. Different channel, different campaign — and those 503 came
    // back only "queued" before the Wali device disconnected, so even their delivery
    // is uncertain.
    .filter((c) => c.messageable && c.smsSentAt === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const limit = Number(arg("limit") ?? 0);
  if (Number.isSafeInteger(limit) && limit > 0) {
    recipients = recipients.slice(0, limit);
  }

  const rendered = recipients.map((c) => ({
    contact: c,
    name: greetingName(c.name),
    body: render(greetingName(c.name)),
  }));
  // Cost is driven by the LONGEST message — a long name can push a borderline
  // template over a part boundary and silently double the campaign's price.
  const longest = rendered.reduce(
    (a, b) => (b.body.length > a.body.length ? b : a),
    rendered[0],
  );

  console.log(
    [
      `contacts in table:     ${contacts.length}`,
      `already sent by SMS:   ${contacts.filter((c) => c.smsSentAt).length}`,
      `(messaged on WhatsApp:  ${contacts.filter((c) => c.lastSentAt).length}, not excluded)`,
      `unusable phone:        ${contacts.filter((c) => !c.messageable).length}`,
      `opted out:             ${recipients.filter((c) => c.phone && optedOut.has(c.phone)).length}`,
      `to send this run:      ${recipients.length}`,
      `personalised:          ${rendered.filter((r) => r.name !== "Partner").length}`,
      `fallback to "Partner": ${rendered.filter((r) => r.name === "Partner").length}`,
      `longest message:       ${longest?.body.length ?? 0} chars`,
      allowlist ? `ALLOWLIST ACTIVE:      ${allowlist.size} number(s)` : "",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (recipients.length === 0) {
    console.log("nothing to send.");
    return;
  }

  const estimate = await adapter.estimate([recipients[0].phone!], longest.body);
  if ("error" in estimate) throw new Error(estimate.error);
  const needed = estimate.creditsNeeded * recipients.length;
  console.log(
    [
      `parts per message:     ${estimate.partsPerMessage}`,
      `credits per recipient: ${estimate.creditsNeeded}`,
      `credits needed:        ${needed}`,
      `balance:               ${estimate.currentBalance}`,
      `after this run:        ${estimate.currentBalance - needed}`,
      "",
      `sample: ${rendered[0].contact.phone} -> ${rendered[0].body}`,
      "",
    ].join("\n"),
  );

  if (needed > estimate.currentBalance) {
    throw new Error(
      `Insufficient credits: need ${needed}, have ${estimate.currentBalance}. Buy ${needed - estimate.currentBalance} more or shorten the message.`,
    );
  }
  if (has("plan") || !has("confirm")) {
    console.log(
      has("plan") ? "plan only." : "dry run — add --confirm to send.",
    );
    return;
  }

  console.log(`sending at ~${rate}/min (${gapMs.toFixed(0)}ms apart)…\n`);
  const started = Date.now();
  let sent = 0,
    failed = 0,
    skipped = 0;
  const pendingMarks: string[] = [];
  const auditRows: Parameters<typeof recordSentMessages>[0] = [];

  const flush = async () => {
    if (pendingMarks.length) {
      await markLegacyContactsSent(pendingMarks.splice(0), "sms_sent_at");
    }
    if (auditRows.length) {
      await recordSentMessages(auditRows.splice(0));
    }
  };

  for (const [i, r] of rendered.entries()) {
    const phone = r.contact.phone!;
    if (optedOut.has(phone) || (allowlist && !allowlist.has(phone))) {
      skipped++;
      continue;
    }

    let result = await adapter.send({
      channel: "sms",
      to: phone,
      body: r.body,
      category: "utility",
      partnerId: r.contact.id,
    });
    // Back off and retry once on a rate limit rather than burning the recipient.
    if (
      result.status === "failed" &&
      /RATE_LIMITED|429/.test(result.errorMessage ?? "")
    ) {
      await sleep(5_000);
      result = await adapter.send({
        channel: "sms",
        to: phone,
        body: r.body,
        category: "utility",
        partnerId: r.contact.id,
      });
    }

    const ok = result.status !== "failed";
    if (ok) {
      sent++;
      pendingMarks.push(r.contact.id);
    } else {
      failed++;
    }
    auditRows.push({
      partner_ref: r.contact.id,
      kind: "direct",
      to_phone: phone,
      body: r.body,
      status: result.status,
      reason: result.errorMessage ?? null,
      provider_message_id: result.providerMessageId || null,
    });
    console.info(
      JSON.stringify({
        evt: "legacy_sms",
        n: i + 1,
        to: phone,
        status: result.status,
        ...(result.errorMessage ? { reason: result.errorMessage } : {}),
      }),
    );

    // Write progress in batches so a crash loses at most 100 markers, not the run.
    if (pendingMarks.length >= 100) await flush();
    if (i % 250 === 0 && i > 0) {
      const rate = (i / ((Date.now() - started) / 60_000)).toFixed(0);
      console.log(
        `… ${i}/${rendered.length} (${rate}/min, ${sent} sent, ${failed} failed)`,
      );
    }
    await sleep(gapMs);
  }
  await flush();

  console.log(
    JSON.stringify(
      {
        evt: "legacy_sms_done",
        attempted: rendered.length,
        sent,
        failed,
        skipped,
        minutes: +((Date.now() - started) / 60_000).toFixed(1),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
