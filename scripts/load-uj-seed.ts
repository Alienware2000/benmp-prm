/**
 * UJ Ghana seed loader (Decision 0020): scripts/data/uj-hubs-churches.json
 * -> `regions`, `hubs`, `hub_churches`, `hub_accounts`.
 *
 * Sibling of load-hub-seed.ts, which does the same job for UD Ghana. The one
 * real difference is identity: UD hubs are numbers, UJ hubs are names, so every
 * upsert here keys on (region_id, name_key) instead of hub_number.
 *
 * Idempotent, with the same safety posture as its sibling:
 *  - hubs upsert on (region_id, name_key); leader/display name refresh in place
 *  - churches upsert on (hub_id, name_key); churches dropped from the seed are
 *    reported but NEVER deleted (partners may reference them)
 *  - accounts are created only if missing, so a re-run cannot reset a password
 *    an admin has already chosen
 *
 * Initial passwords are RANDOM and printed once, here, at creation time. They
 * are not derived from the hub name: a hub name is public (it is in the login
 * dropdown), so a name-derived password would be no password at all. Every
 * account still carries must_change_password.
 *
 * Run: npx tsx --env-file=.env.local scripts/load-uj-seed.ts
 */
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeChurchKey,
  normalizeHubKey,
  parseNamedHubSeed,
} from "../src/lib/hub/seed";
import { hashPassword } from "../src/lib/hub/password";

const REGION_CODE = "UJ_GHANA";
const REGION_NAME = "UJ Ghana";

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
    throw new Error(
      `${init?.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

/**
 * Readable one-time password: two short words and two digits, e.g.
 * "river-stone-47". It is read aloud down a phone line to a hub admin once, so
 * it has to survive being spoken; it is replaced on first login regardless.
 */
const WORDS = [
  "river",
  "stone",
  "cedar",
  "amber",
  "harbor",
  "meadow",
  "falcon",
  "copper",
  "lantern",
  "summit",
  "willow",
  "anchor",
  "garnet",
  "juniper",
  "compass",
  "thicket",
  "beacon",
  "marble",
  "cotton",
  "orchard",
  "saffron",
  "timber",
];
function issuePassword(): string {
  const a = WORDS[randomInt(WORDS.length)];
  let b = WORDS[randomInt(WORDS.length)];
  while (b === a) b = WORDS[randomInt(WORDS.length)];
  return `${a}-${b}-${randomInt(10, 100)}`;
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const doc = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "data/uj-hubs-churches.json",
      ),
      "utf8",
    ),
  );
  const seed = parseNamedHubSeed(doc);
  console.log(
    `seed parsed: ${seed.hubs.length} hubs, ${seed.churchCount} churches`,
  );

  // Region (created by migration 0010; upserted here so the script also works
  // against a database where only the earlier migrations have run).
  const regions = await rest<{ id: string }[]>("regions?on_conflict=code", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([
      {
        code: REGION_CODE,
        name: REGION_NAME,
        hub_identifier: "name",
        sort_order: 2,
      },
    ]),
  });
  const regionId = regions[0].id;

  // Hubs: upsert on (region_id, name_key).
  const hubRows = seed.hubs.map((h) => ({
    region_id: regionId,
    hub_number: null,
    name: h.displayName,
    name_key: normalizeHubKey(h.name),
    leader_name: h.leader,
    country: "Ghana",
  }));
  const hubs = await rest<{ id: string; name_key: string }[]>(
    "hubs?on_conflict=region_id,name_key",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(hubRows),
    },
  );
  const hubIdByKey = new Map(hubs.map((h) => [h.name_key, h.id]));
  console.log(`hubs upserted: ${hubs.length}`);

  // Churches: upsert on (hub_id, name_key); report seed-removed ones, never delete.
  let churchUpserts = 0;
  for (const h of seed.hubs) {
    const hubId = hubIdByKey.get(normalizeHubKey(h.name))!;
    const rows = h.churches.map((name) => ({
      hub_id: hubId,
      name,
      name_key: normalizeChurchKey(name),
    }));
    const upserted = await rest<{ name_key: string }[]>(
      "hub_churches?on_conflict=hub_id,name_key",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
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
          `${h.name}: church "${e.name}" exists in DB but not in the seed — left in place, remove manually if intended`,
        );
      }
    }
  }
  console.log(`churches upserted: ${churchUpserts}`);

  // Accounts: only the missing ones. Existing password hashes are never touched.
  const hubIds = [...hubIdByKey.values()];
  const existingAccounts = await rest<{ hub_id: string }[]>(
    `hub_accounts?hub_id=in.(${hubIds.join(",")})&select=hub_id`,
  );
  const have = new Set(existingAccounts.map((a) => a.hub_id));

  const issued: { hub: string; leader: string; password: string }[] = [];
  const newAccounts = seed.hubs
    .filter((h) => !have.has(hubIdByKey.get(normalizeHubKey(h.name))!))
    .map((h) => {
      const password = issuePassword();
      issued.push({ hub: h.displayName, leader: h.leader, password });
      return {
        hub_id: hubIdByKey.get(normalizeHubKey(h.name))!,
        // Vestigial since the login picker submits a hub id, but the column is
        // unique and NOT NULL; namespaced so it can never collide with a UD number.
        username: `uj:${normalizeHubKey(h.name).toLowerCase().replace(/\s+/g, "-")}`,
        password_hash: hashPassword(password),
        must_change_password: true,
      };
    });

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

  if (issued.length > 0) {
    console.log(
      "\nInitial passwords — printed ONCE, not recoverable. Hand these to the hub admins;\n" +
        "each is forced to replace it on first login.\n",
    );
    const pad = Math.max(...issued.map((i) => i.hub.length));
    for (const i of issued) {
      console.log(
        `  ${i.hub.padEnd(pad)}  ${i.password.padEnd(20)} ${i.leader || "(admin name unknown)"}`,
      );
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
