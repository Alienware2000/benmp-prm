/**
 * Hub platform seed loader (HP-1, Decision 0018): scripts/data/ghana-hubs-churches.json
 * -> `hubs`, `hub_churches`, `hub_accounts`. Sibling to load-poc-data.ts /
 * load-region-partners.ts (same raw-PostgREST style, service role, run via tsx).
 *
 * Idempotent by design, and safe to re-run after the office edits the church list:
 *  - hubs upsert on hub_number (leader/country refresh in place)
 *  - churches upsert on (hub_id, name_key); churches removed from the seed are
 *    reported but NOT deleted (partners may reference them — removal is a
 *    deliberate manual step)
 *  - accounts are created only if missing. A re-run never touches password_hash or
 *    must_change_password, so re-seeding can't silently reset a hub's password.
 *
 * Run: npx tsx --env-file=.env.local scripts/load-hub-seed.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeChurchKey, parseHubSeed } from "../src/lib/hub/seed";
import { hashPassword, initialHubPassword } from "../src/lib/hub/password";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const doc = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "data/ghana-hubs-churches.json"), "utf8"),
  );
  const seed = parseHubSeed(doc);
  console.log(`seed parsed: ${seed.hubs.length} hubs, ${seed.churchCount} churches`);

  // Hubs: upsert on hub_number.
  const hubRows = seed.hubs.map((h) => ({
    hub_number: h.hubNumber,
    leader_name: h.leader,
    country: "Ghana",
  }));
  const hubs = await rest<{ id: string; hub_number: number }[]>(
    "hubs?on_conflict=hub_number",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(hubRows),
    },
  );
  const hubIdByNumber = new Map(hubs.map((h) => [h.hub_number, h.id]));
  console.log(`hubs upserted: ${hubs.length}`);

  // Churches: upsert on (hub_id, name_key); report seed-removed ones, never delete.
  let churchUpserts = 0;
  for (const h of seed.hubs) {
    const hubId = hubIdByNumber.get(h.hubNumber)!;
    const rows = h.churches.map((name) => ({
      hub_id: hubId,
      name,
      name_key: normalizeChurchKey(name),
    }));
    const upserted = await rest<{ name_key: string }[]>(
      "hub_churches?on_conflict=hub_id,name_key",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(rows),
      },
    );
    churchUpserts += upserted.length;

    const seedKeys = new Set(rows.map((r) => r.name_key));
    const existing = await rest<{ name: string; name_key: string }[]>(
      `hub_churches?hub_id=eq.${hubId}&select=name,name_key`,
    );
    for (const e of existing) {
      if (!seedKeys.has(e.name_key)) {
        console.warn(
          `hub ${h.hubNumber}: church "${e.name}" exists in DB but not in the seed — left in place, remove manually if intended`,
        );
      }
    }
  }
  console.log(`churches upserted: ${churchUpserts}`);

  // Accounts: create only the missing ones; never rewrite password_hash on re-run.
  const existingAccounts = await rest<{ username: string }[]>(
    "hub_accounts?select=username",
  );
  const have = new Set(existingAccounts.map((a) => a.username));
  const newAccounts = seed.hubs
    .filter((h) => !have.has(String(h.hubNumber)))
    .map((h) => ({
      hub_id: hubIdByNumber.get(h.hubNumber)!,
      username: String(h.hubNumber),
      password_hash: hashPassword(initialHubPassword(h.hubNumber)),
      must_change_password: true,
    }));
  if (newAccounts.length > 0) {
    await rest("hub_accounts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(newAccounts),
    });
  }
  console.log(
    `accounts created: ${newAccounts.length} (existing untouched: ${have.size})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
