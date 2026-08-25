/**
 * Cutover step 1 of 2 (HP-4, Decision 0018 item 7): export the pre-hub data
 * to CSV files BEFORE anything is cleared. Writes one CSV per table into a
 * local directory that must stay outside git (real partner data).
 *
 * Exports:
 *  - partners with hub_id IS NULL (pre-hub rows only — hub uploads stay live)
 *  - registrations, payments, sent_messages (all rows)
 *
 * Run: npx tsx --env-file=.env.local scripts/export-ghana-archive.ts [outDir]
 * Default outDir: ../Data/archive-<date> (sibling of the repo, like the other
 * real-data files). Prints row counts — compare them against the counts the
 * cutover SQL reports before running its DELETE step.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { toCsv } from "../src/lib/hub/csv";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function fetchAll(pathAndQuery: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const sep = pathAndQuery.includes("?") ? "&" : "?";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${pathAndQuery}${sep}limit=${page}&offset=${offset}`,
      { headers: H },
    );
    if (!res.ok) throw new Error(`${pathAndQuery}: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = resolve(process.argv[2] ?? `../Data/archive-${stamp}`);
  mkdirSync(outDir, { recursive: true });

  const exports: [string, string][] = [
    ["partners-pre-hub", "partners?hub_id=is.null&order=created_at.asc"],
    ["registrations", "registrations?order=id.asc"],
    ["payments", "payments?order=reference.asc"],
    ["sent_messages", "sent_messages?order=id.asc"],
  ];

  for (const [name, query] of exports) {
    const rows = await fetchAll(query);
    writeFileSync(join(outDir, `${name}.csv`), toCsv(rows));
    console.log(`${name}: ${rows.length} rows -> ${join(outDir, `${name}.csv`)}`);
  }
  console.log(
    "\nKeep this folder OUT of git. Next: run scripts/sql/archive-ghana-cutover.sql " +
      "in the Supabase SQL editor and compare its reported counts to the numbers above.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
