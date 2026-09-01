/**
 * Legacy Ghana broadcast — batched sender (Decision 0019).
 *
 * The composer's `legacy-ghana` audience can PREVIEW all ~11.6k contacts, but a
 * confirmed send is capped at 2,000 (MAX_IMMEDIATE_RECIPIENTS) because dispatch runs
 * inside one web request. This script does the same send outside that request, one
 * fixed chunk at a time, so a campaign this size can go out without a browser tab
 * holding the connection open.
 *
 * Sibling to load-hub-seed.ts / export-ghana-archive.ts: raw PostgREST, service role,
 * run via tsx. Deliberately NOT a UI button.
 *
 * SAFETY — this thing sends real messages to real people, so:
 *  - Dry run by default. Nothing dispatches without --confirm.
 *  - Chunks are stable: sorted by id, so batch 3 is the same 2,000 people every run.
 *  - Anyone with `last_sent_at` set is excluded before chunking, so a re-run or a
 *    crash mid-batch cannot message the same person twice.
 *  - Opt-outs are re-read from public.opt_outs at send time and skipped.
 *  - Unusable phones are dropped up front (the archive carries Excel debris such as
 *    ";233...", "'024...", and a bare ".").
 *  - BENMP_SEND_ALLOWLIST still applies — set it to your own number for a live test.
 *  - `last_sent_at` is written per recipient as each send succeeds, not in one write
 *    at the end, so an interrupted batch resumes correctly.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/send-legacy-ghana-broadcast.ts --plan
 *   npx tsx --env-file=.env.local scripts/send-legacy-ghana-broadcast.ts --batch 1 --message "..."
 *   npx tsx --env-file=.env.local scripts/send-legacy-ghana-broadcast.ts --batch 1 --message "..." --confirm
 *
 * --plan     show the chunk table and exit (no provider call, no writes)
 * --batch N  1-based chunk to work on
 * --message  the text; {name} is replaced per recipient
 * --confirm  actually dispatch (otherwise it is a dry run)
 * --size N   override the 2,000 chunk size
 */
import { buildDirectMessages } from "../src/lib/poc/direct-message";
import {
  loadLegacyGhanaContacts,
  markLegacyContactsSent,
} from "../src/lib/poc/legacy-contacts";
import {
  isValidBatchNumber,
  legacyBatchRecipients,
  planLegacyBatches,
} from "../src/lib/poc/legacy-batches";
import { loadOptOuts } from "../src/lib/poc/db";
import { getMessagingAdapter } from "../src/lib/messaging";
import { sendPlanned, parseAllowlist, wasDispatched } from "../src/lib/send";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_CHUNK = 2_000;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  if (!SUPABASE_URL || !KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const chunkSize = Number(arg("size") ?? DEFAULT_CHUNK);
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error("--size must be a positive integer");
  }

  const [contacts, optedOut] = await Promise.all([
    loadLegacyGhanaContacts(),
    loadOptOuts(),
  ]);

  // Batching is shared with the composer's batch selector (src/lib/poc/legacy-batches)
  // so a batch number means the same thing in both places. Contacts already messaged
  // keep their slot rather than being filtered out first — dropping them would reslide
  // every later boundary, and "batch 3" would name different people run to run.
  const plan = planLegacyBatches(contacts, chunkSize);

  console.log(
    [
      `contacts in table:      ${plan.totalContacts}`,
      `unusable phone:         ${plan.unusablePhone}`,
      `already sent:           ${contacts.filter((c) => c.lastSentAt).length}`,
      `opted out (of total):   ${contacts.filter((c) => c.phone && optedOut.has(c.phone)).length}`,
      `remaining to send:      ${plan.batches.reduce((n, b) => n + b.remaining, 0)}`,
      `chunk size:             ${plan.batchSize}`,
      `batches:                ${plan.batches.length}`,
      "",
    ].join("\n"),
  );
  for (const b of plan.batches) {
    const done = b.remaining === 0 ? " (all sent)" : "";
    console.log(
      `  batch ${b.number}: ${b.remaining} to send of ${b.size}${done}`,
    );
  }

  if (has("plan")) return;

  const batch = Number(arg("batch"));
  if (!isValidBatchNumber(batch, plan)) {
    throw new Error(`--batch must be between 1 and ${plan.batches.length}`);
  }
  const message = arg("message");
  if (!message || !message.trim()) throw new Error("--message is required");

  const recipients = legacyBatchRecipients(contacts, batch, chunkSize);
  if (recipients.length === 0) {
    console.log(`\nbatch ${batch} has nobody left to send to.`);
    return;
  }
  const planned = buildDirectMessages(recipients, message);
  const confirm = has("confirm");

  console.log(
    `\nbatch ${batch}/${plan.batches.length}: ${recipients.length} recipients — ${
      confirm ? "SENDING" : "dry run (add --confirm to send)"
    }`,
  );
  console.log(
    `sample: ${planned[0]?.to} -> ${planned[0]?.body.slice(0, 80)}\n`,
  );

  if (!confirm) return;

  const adapter = getMessagingAdapter();
  const report = await sendPlanned(planned, {
    adapter,
    optedOut,
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
    log: (e) => console.info(JSON.stringify({ ...e, batch })),
  });

  // Mark only what actually went out — a skip or a failure stays eligible for a retry.
  await markLegacyContactsSent(
    report.outcomes.filter((o) => wasDispatched(o.status)).map((o) => o.partnerRef),
  );

  console.log(
    JSON.stringify(
      {
        evt: "legacy_broadcast_batch_done",
        batch,
        provider: adapter.provider,
        total: report.total,
        sent: report.sent,
        skipped: report.skipped,
        failed: report.failed,
        skippedByReason: report.skippedByReason,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
