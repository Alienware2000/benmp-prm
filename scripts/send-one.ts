/**
 * Send ONE message through whatever provider is configured — the fastest way to prove a
 * provider swap works before pointing a campaign at it.
 *
 * Unlike send-test.mjs (Twilio-specific, hits the REST API directly), this goes through
 * `getMessagingAdapter()`, so it exercises exactly the path a real send takes: the same
 * adapter, the same credential names, the same response parsing. If this works, the
 * composer will work; if it fails, the error is the one production would have hit.
 *
 * Touches nothing else — no database reads, no last_sent_at, no audit rows. It cannot
 * affect the legacy broadcast's batch state.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/send-one.ts +233XXXXXXXXX "Test from BENMP"
 *
 * Set BENMP_MESSAGING_PROVIDER (and that provider's keys) in the env file first.
 * With `mock` it prints what would be sent without calling anyone.
 */
import { getMessagingAdapter } from "../src/lib/messaging";
import { messagingConfiguration } from "../src/lib/messaging/configuration";
import { normalizePhone } from "../src/lib/phone";

const [rawTo, ...rest] = process.argv.slice(2);
const body = rest.join(" ") || "BENMP PRM test message — the system can send.";

async function main() {
  if (!rawTo) {
    throw new Error(
      'Usage: npx tsx --env-file=.env.local scripts/send-one.ts <+E164> "message"',
    );
  }
  // The composer normalizes before dispatch, so a test that skips it would prove less.
  const to = normalizePhone(rawTo);
  if (!to) {
    throw new Error(`"${rawTo}" is not a usable phone number.`);
  }

  const adapter = getMessagingAdapter();
  const config = messagingConfiguration();
  console.log(`provider:   ${adapter.provider}`);
  console.log(`ready:      ${config.ready}`);
  if (config.note) console.log(`note:       ${config.note}`);
  console.log(`to:         ${to}`);
  console.log(`body:       ${body}\n`);

  if (adapter.provider === "mock") {
    console.log(
      "mock provider — nothing was sent. Set BENMP_MESSAGING_PROVIDER.",
    );
  }

  const result = await adapter.send({
    channel: "whatsapp",
    to,
    body,
    category: "utility",
  });

  console.log(JSON.stringify(result, null, 2));
  // "queued" is a success for every WhatsApp provider here — the message is accepted,
  // delivery happens asynchronously. Only "failed" means it did not leave.
  if (result.status === "failed") {
    console.error(
      `\n✗ send failed: ${result.errorMessage ?? "no reason given"}`,
    );
    process.exit(1);
  }
  console.log(`\n✓ accepted by ${result.provider} (${result.status})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
