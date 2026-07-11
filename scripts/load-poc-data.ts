/**
 * One-time loader: Qodesh registration + MoMo files -> Supabase (POC, Decision 0008).
 * Reuses the tested phone.ts / ingest.ts so phone_e164 matches reconcile.ts exactly.
 * Real data lives in ../Data (outside the repo); nothing here is committed.
 *
 * Run: npx tsx --env-file=.env.local scripts/load-poc-data.ts
 */
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { normalizePhone } from "../src/lib/phone";
import { parseAmountToMinor, collapseDoubledName } from "../src/lib/ingest";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Directory holding the (gitignored, local) Qodesh files:
//   registrations.csv (converted from the members xlsx) and "QODESH MOMO.csv".
const DATA = process.env.POC_DATA_DIR ?? "./Data";

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

function readCsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, "utf8");
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;
}

async function del(table: string, filter: string) {
  const r = await fetch(`${URL}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
  if (!r.ok) throw new Error(`DELETE ${table}: ${r.status} ${await r.text()}`);
}

async function insert(table: string, rows: unknown[], onConflict?: string) {
  const q = onConflict ? `?on_conflict=${onConflict}` : "";
  const prefer = onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal";
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${URL}/rest/v1/${table}${q}`, { method: "POST", headers: { ...H, Prefer: prefer }, body: JSON.stringify(chunk) });
    if (!r.ok) throw new Error(`INSERT ${table} @${i}: ${r.status} ${await r.text()}`);
  }
}

// --- Registrations ---
const regRows = readCsv(`${DATA}/registrations.csv`)
  .filter((r) => (r.name ?? "").trim())
  .map((r) => ({
    source_no: Number.parseInt(r.no, 10) || null,
    full_name: r.name.trim(),
    phone_raw: (r.phone ?? "").trim() || null,
    phone_e164: normalizePhone(r.phone),
  }));

// --- Payments (QODESH MOMO merchant statement) ---
const seen = new Set<string>();
const payRows = readCsv(`${DATA}/QODESH MOMO.csv`)
  .filter((r) => (r.Status ?? "").trim() === "Successful")
  .filter((r) => /qodesh/i.test(r["To name"] ?? "")) // incoming credits to the church
  .map((r) => {
    const reference = (r.Id ?? "").trim();
    const amount_minor = parseAmountToMinor(r.Amount ?? "");
    const fromDigits = (r.From ?? "").match(/FRI:(\d+)\/MSISDN/)?.[1] ?? null;
    return {
      reference,
      paid_at: (r.Date ?? "").trim() || null,
      status: r.Status ?? null,
      payer_name: collapseDoubledName((r["From name"] ?? "").trim()) || null,
      payer_phone_e164: normalizePhone(fromDigits),
      amount_minor,
      currency: "GHS",
      raw_row: r,
    };
  })
  .filter((p) => p.reference && p.amount_minor !== null && !seen.has(p.reference) && seen.add(p.reference));

console.log(`parsed: ${regRows.length} registrations, ${payRows.length} successful incoming payments`);

await del("registrations", "created_at=gt.1970-01-01"); // idempotent reload
await insert("registrations", regRows);
await insert("payments", payRows, "reference");

const matched = regRows.filter((r) => r.phone_e164).length;
console.log(`loaded ✓  registrations=${regRows.length} (normalizable phones=${matched}), payments=${payRows.length}`);
