/**
 * One-off for Decision 0046: statement lines held in the old review queue
 * (`payment_import_rows.match_status = 'needs_review'`) are recorded in the
 * ledger under the payer's name and number, as every new import now does.
 * Dismissed lines are left alone. Idempotent: a line whose reference is
 * already in `payments` is only marked promoted.
 *
 * Dry run (default):
 *   npx tsx --env-file=.env.local scripts/record-held-statement-lines.ts
 * Record them:
 *   npx tsx --env-file=.env.local scripts/record-held-statement-lines.ts --commit
 */
import { inListChunks } from "../src/lib/poc/in-list";
import {
  buildPaymentRows,
  type NormalizedPaymentRow,
} from "../src/lib/poc/payment-upload";
import { insertPayments, rest } from "../src/lib/poc/statement-import";

const commit = process.argv.includes("--commit");

type HeldRow = {
  id: string;
  payment_reference: string;
  normalized_row: NormalizedPaymentRow;
};

const ghs = (minor: number) =>
  `GHS ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const held: HeldRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest<HeldRow[]>(
      `payment_import_rows?select=id,payment_reference,normalized_row&match_status=eq.needs_review&order=id.asc&limit=1000&offset=${offset}`,
    );
    held.push(...rows);
    if (rows.length < 1000) break;
  }

  const inLedger = new Set<string>();
  for (const list of inListChunks(held.map((r) => r.payment_reference))) {
    const rows = await rest<{ reference: string }[]>(
      `payments?select=reference&reference=in.(${list})&limit=1000`,
    );
    for (const r of rows) inLedger.add(r.reference);
  }
  const toRecord = held.filter((r) => !inLedger.has(r.payment_reference));

  const bySourceMonth = new Map<string, { n: number; minor: number }>();
  for (const r of toRecord) {
    const key = `${r.normalized_row.source} ${r.normalized_row.transactionDate.slice(0, 7)}`;
    const t = bySourceMonth.get(key) ?? { n: 0, minor: 0 };
    t.n += 1;
    t.minor += r.normalized_row.amountMinor;
    bySourceMonth.set(key, t);
  }
  console.log(
    `${commit ? "RECORD" : "DRY RUN"} — ${held.length} held lines; ${held.length - toRecord.length} already in the ledger; ${toRecord.length} to record`,
  );
  for (const [key, t] of [...bySourceMonth].sort()) {
    console.log(
      `  ${key.padEnd(26)} ${String(t.n).padStart(4)}  ${ghs(t.minor)}`,
    );
  }
  console.log(
    `  ${"total".padEnd(26)} ${String(toRecord.length).padStart(4)}  ${ghs(toRecord.reduce((s, r) => s + r.normalized_row.amountMinor, 0))}`,
  );
  if (!commit) return;

  await insertPayments(
    buildPaymentRows(
      toRecord.map((r) => ({ row: r.normalized_row, partner: null })),
    ),
  );
  for (const list of inListChunks(held.map((r) => r.id))) {
    await rest<void>(`payment_import_rows?id=in.(${list})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        match_status: "promoted",
        notes: "Recorded by payer name and number (Decision 0046)",
        resolved_at: new Date().toISOString(),
      }),
    });
  }
  for (const r of toRecord) {
    console.info(
      JSON.stringify({
        event: "statement_row",
        source: r.normalized_row.source,
        reference: r.payment_reference,
        amountMinor: r.normalized_row.amountMinor,
        match: "unlinked",
        status: "promoted",
      }),
    );
  }
  console.log(
    `Recorded ${toRecord.length} lines; ${held.length} import rows marked promoted.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
