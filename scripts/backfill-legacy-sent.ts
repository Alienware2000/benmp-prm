/**
 * Repair `legacy_ghana_contacts.last_sent_at` from the `sent_messages` audit trail.
 *
 * Why this exists: the first legacy Ghana broadcast (2026-08-30) dispatched 503
 * messages, but the caller only stamped contacts whose outcome was "sent". Every
 * provider here returns "queued" on success, so nothing was stamped and all 503 were
 * left exposed to a duplicate send. `wasDispatched()` fixes the rule going forward;
 * this repairs the rows already affected.
 *
 * The audit trail is the source of truth — every attempt landed in `sent_messages`
 * with its provider_message_id — so the repair is reconstruction, not guesswork.
 *
 * Idempotent: only fills rows where last_sent_at IS NULL, and uses each contact's
 * earliest dispatch time rather than "now", so the record reflects when the message
 * actually went out.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/backfill-legacy-sent.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/backfill-legacy-sent.ts --confirm
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISPATCHED = new Set(["sent", "queued"]);

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

/** Page past PostgREST's 1,000-row truncation. */
async function all<T>(path: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest<T[]>(
      `${path}&order=${order}&limit=1000&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const [audit, contacts] = await Promise.all([
    all<{ partner_ref: string; status: string; created_at: string }>(
      "sent_messages?select=partner_ref,status,created_at",
      "created_at.asc",
    ),
    all<{ id: string; last_sent_at: string | null }>(
      "legacy_ghana_contacts?select=id,last_sent_at",
      "id.asc",
    ),
  ]);

  // Earliest successful dispatch per contact — the audit trail can hold several
  // attempts for one person if a batch was retried.
  const dispatchedAt = new Map<string, string>();
  for (const row of audit) {
    if (!DISPATCHED.has(row.status)) continue;
    const seen = dispatchedAt.get(row.partner_ref);
    if (!seen || row.created_at < seen) {
      dispatchedAt.set(row.partner_ref, row.created_at);
    }
  }

  const unmarked = contacts.filter(
    (c) => c.last_sent_at === null && dispatchedAt.has(c.id),
  );
  const alreadyMarked = contacts.filter((c) => c.last_sent_at !== null).length;
  // Audit rows whose partner_ref is not a legacy contact — other audiences share the
  // same table, so this is expected, not an error.
  const otherAudiences = [...dispatchedAt.keys()].filter(
    (ref) => !contacts.some((c) => c.id === ref),
  ).length;

  console.log(
    [
      `audit rows:                     ${audit.length}`,
      `dispatched (sent or queued):    ${dispatchedAt.size}`,
      `  of those, other audiences:    ${otherAudiences}`,
      `legacy contacts:                ${contacts.length}`,
      `already marked:                 ${alreadyMarked}`,
      `to backfill:                    ${unmarked.length}`,
    ].join("\n"),
  );

  if (unmarked.length === 0) {
    console.log("\nnothing to do.");
    return;
  }
  if (!process.argv.includes("--confirm")) {
    console.log("\ndry run — add --confirm to write.");
    return;
  }

  // One PATCH per distinct timestamp keeps the real send time on each row.
  const byTime = new Map<string, string[]>();
  for (const c of unmarked) {
    const at = dispatchedAt.get(c.id)!;
    byTime.set(at, [...(byTime.get(at) ?? []), c.id]);
  }

  let written = 0;
  for (const [at, ids] of byTime) {
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      await rest(`legacy_ghana_contacts?id=in.(${slice.join(",")})`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_sent_at: at }),
      });
      written += slice.length;
    }
  }
  console.log(`\n✓ backfilled ${written} contacts.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
