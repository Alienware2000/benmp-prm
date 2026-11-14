/**
 * Backend statement import: the same pipeline as /poc/giving/upload
 * (src/lib/poc/statement-import.ts), for a folder or list of statement files.
 * Real statements stay outside git (OCT/ etc. are gitignored).
 *
 * Dry run (default) parses and matches every file and writes nothing:
 *   npx tsx --env-file=.env.local scripts/ingest-statements.ts OCT
 * Import:
 *   npx tsx --env-file=.env.local scripts/ingest-statements.ts OCT --commit
 *
 * The source is read from the file name (momo/benmo, ecobank, stanbic, zenith,
 * fidelity, paystack[+recurring]); force one with `path=source`.
 *
 * --clear-empty-duplicates: a file whose earlier import recorded 0 rows (the
 * title-row bug fixed alongside this script) is blocked as a duplicate; with this
 * flag that empty batch record is deleted first so the file can import. Only
 * batches with row_count 0 and no import rows qualify.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { inListChunks } from "../src/lib/poc/in-list";
import {
  isPaymentSource,
  type PaymentSource,
} from "../src/lib/poc/payment-upload";
import {
  importPreparedStatement,
  loadPartners,
  paymentReference,
  prepareStatement,
  rest,
  type PreparedStatement,
} from "../src/lib/poc/statement-import";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const clearEmptyDuplicates = args.includes("--clear-empty-duplicates");
const targets = args.filter((arg) => !arg.startsWith("--"));

function sourceFromName(name: string): PaymentSource | null {
  const n = name.toLowerCase();
  if (/paystack/.test(n))
    return /recurring|subscription/.test(n)
      ? "paystack_recurring"
      : "paystack_onetime";
  if (/momo|benmo|mtn/.test(n)) return "momo";
  if (/ecobank/.test(n)) return "ecobank";
  if (/stanbic/.test(n)) return "stanbic";
  if (/zenith/.test(n)) return "zenith";
  if (/fidelity/.test(n)) return "fidelity";
  return null;
}

function expand(
  target: string,
): Array<{ path: string; source: PaymentSource | null }> {
  const [path, forced] = target.split("=");
  if (forced && !isPaymentSource(forced))
    throw new Error(`Unknown source "${forced}" for ${path}`);
  if (statSync(path).isDirectory()) {
    return readdirSync(path)
      .filter(
        (name) => !name.startsWith(".") && /\.(csv|xlsx?|pdf)$/i.test(name),
      )
      .sort()
      .map((name) => ({
        path: join(path, name),
        source: sourceFromName(name),
      }));
  }
  return [
    {
      path,
      source:
        forced && isPaymentSource(forced)
          ? forced
          : sourceFromName(basename(path)),
    },
  ];
}

async function referencesAlreadyInLedger(
  prepared: PreparedStatement,
): Promise<number> {
  const refs = prepared.parsed.rows.map(paymentReference);
  let found = 0;
  for (const list of inListChunks(refs, { maxValues: 100 })) {
    const rows = await rest<Array<{ reference: string }>>(
      `payments?select=reference&reference=in.(${list})&limit=1000`,
    );
    found += rows.length;
  }
  return found;
}

async function clearEmptyBatch(id: string): Promise<boolean> {
  const rows = await rest<Array<{ id: string }>>(
    `payment_import_rows?select=id&import_id=eq.${id}&limit=1`,
  );
  if (rows.length > 0) return false;
  await rest<void>(`payment_imports?id=eq.${id}&row_count=eq.0`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  console.info(JSON.stringify({ event: "empty_batch_cleared", importId: id }));
  return true;
}

const ghs = (minor: number) =>
  `GHS ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

async function main() {
  if (targets.length === 0)
    throw new Error(
      "usage: ingest-statements.ts <folder|file[=source]>... [--commit]",
    );
  const files = targets.flatMap(expand);
  const unknown = files.filter((file) => !file.source);
  if (unknown.length)
    throw new Error(
      `Can't tell the source of: ${unknown.map((f) => f.path).join(", ")} (use path=source)`,
    );

  const partners = await loadPartners();
  console.log(
    `${commit ? "IMPORT" : "DRY RUN"} — ${files.length} file(s), ${partners.length} partners loaded\n`,
  );

  let failures = 0;
  for (const file of files) {
    const name = basename(file.path);
    const bytes = readFileSync(file.path);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    try {
      const prepared = await prepareStatement(
        file.source!,
        name,
        buffer,
        partners,
      );
      const { parsed, matches } = prepared;
      const auto = matches.filter((match) => match.status === "auto");
      const total = parsed.rows.reduce((sum, row) => sum + row.amountMinor, 0);
      const months = [
        ...new Set(parsed.rows.map((row) => row.transactionDate.slice(0, 7))),
      ]
        .sort()
        .join(", ");
      const inLedger = await referencesAlreadyInLedger(prepared);
      console.log(`■ ${name}  [${file.source}]`);
      console.log(
        `  ${parsed.rows.length} credits, ${ghs(total)} (${months || "no rows"}) · auto-match ${auto.length} · review ${matches.length - auto.length}` +
          ` · skipped ${parsed.skipped.length} · rejected ${parsed.rejects.length} · already in ledger ${inLedger}`,
      );
      for (const warning of parsed.warnings ?? [])
        console.log(`  ⚠ ${warning}`);
      for (const reject of parsed.rejects.slice(0, 5))
        console.log(`  ✗ row ${reject.index + 1}: ${reject.reason}`);

      if (!commit) {
        console.log("");
        continue;
      }
      let outcome = await importPreparedStatement(prepared, buffer);
      if (
        !outcome.ok &&
        clearEmptyDuplicates &&
        outcome.duplicate.row_count === 0
      ) {
        if (await clearEmptyBatch(outcome.duplicate.id))
          outcome = await importPreparedStatement(prepared, buffer);
      }
      if (!outcome.ok) {
        console.log(
          `  ↷ already imported as batch ${outcome.duplicate.id} (${outcome.duplicate.row_count} rows, ${outcome.duplicate.created_at.slice(0, 10)}) — skipped\n`,
        );
        continue;
      }
      console.log(
        `  ✓ batch ${outcome.importId}: ${outcome.autoMatched} payments recorded, ${outcome.review.length} in /poc/giving/review\n`,
      );
    } catch (error) {
      failures += 1;
      console.log(
        `■ ${name}  [${file.source}]\n  ✗ ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
