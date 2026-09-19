/**
 * Named-region seed loader for the Paul GTWC submissions (Decision 0025):
 * scripts/data/<region>-hubs-churches.json -> `regions`, `hubs`,
 * `hub_churches` (incl. branch pastor leader fields), `hub_accounts`.
 *
 * Sibling of load-uj-seed.ts, generalised: one script serves every
 * name-identified region, picked by argument. Same safety posture:
 *  - hubs upsert on (region_id, name_key); leader/display/country refresh
 *  - churches upsert on (hub_id, name_key); seed-removed churches are
 *    reported but NEVER deleted (partners may reference them)
 *  - accounts are created only if missing, so a re-run cannot reset a
 *    password an admin has already chosen
 *
 * The initial password is the HUB NAME exactly as the login picker shows it
 * (Decision 0020 item 6), with must_change_password forcing a real one on
 * first sign-in.
 *
 * Run: npx tsx --env-file=.env.local scripts/load-region-hubs-seed.ts africa
 *      npx tsx --env-file=.env.local scripts/load-region-hubs-seed.ts europe
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeChurchKey,
  normalizeHubKey,
  parseNamedHubSeed,
} from "../src/lib/hub/seed";
import { hashPassword, initialNamedHubPassword } from "../src/lib/hub/password";

const REGIONS = {
  africa: {
    code: "AFRICA",
    name: "Africa",
    file: "africa-hubs-churches.json",
    sortOrder: 3,
    defaultCountry: "Africa",
  },
  europe: {
    code: "EUROPE",
    name: "Europe",
    file: "europe-hubs-churches.json",
    sortOrder: 4,
    defaultCountry: "Europe",
  },
} as const;

const which = process.argv[2] as keyof typeof REGIONS;
const config = REGIONS[which];

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

async function main() {
  if (!config) {
    throw new Error(
      `usage: load-region-hubs-seed.ts <${Object.keys(REGIONS).join("|")}>`,
    );
  }
  if (!SUPABASE_URL || !KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const doc = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "data", config.file),
      "utf8",
    ),
  );
  const seed = parseNamedHubSeed(doc);
  console.log(
    `${config.name}: seed parsed, ${seed.hubs.length} hubs, ${seed.churchCount} churches`,
  );

  // Region row: additive upsert, same pattern as UJ (Decision 0020).
  const regions = await rest<{ id: string }[]>("regions?on_conflict=code", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([
      {
        code: config.code,
        name: config.name,
        hub_identifier: "name",
        sort_order: config.sortOrder,
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
    country: h.country || config.defaultCountry,
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

  // Churches: upsert on (hub_id, name_key), carrying the branch pastor.
  // Seed-removed churches are reported, never deleted.
  let churchUpserts = 0;
  for (const h of seed.hubs) {
    const hubId = hubIdByKey.get(normalizeHubKey(h.name))!;
    const rows = h.churches.map((c) => ({
      hub_id: hubId,
      name: c.name,
      name_key: normalizeChurchKey(c.name),
      leader_name: c.leaderName,
      leader_phone: c.leaderPhone,
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

  // Accounts: create only the missing ones; never rewrite password_hash.
  const existingAccounts = await rest<{ username: string; hub_id: string }[]>(
    `hub_accounts?select=username,hub_id`,
  );
  const haveHubIds = new Set(existingAccounts.map((a) => a.hub_id));
  const newAccounts = seed.hubs
    .map((h) => ({ h, hubId: hubIdByKey.get(normalizeHubKey(h.name))! }))
    .filter(({ hubId }) => !haveHubIds.has(hubId))
    .map(({ h, hubId }) => ({
      hub_id: hubId,
      // Vestigial since the login picker submits a hub id, but the column is
      // unique and NOT NULL; namespaced per region, same shape as UJ's.
      username: `${config.code.toLowerCase()}:${normalizeHubKey(h.name).toLowerCase().replace(/\s+/g, "-")}`,
      password_hash: hashPassword(initialNamedHubPassword(h.displayName)),
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
    `accounts created: ${newAccounts.length} (existing untouched: ${haveHubIds.size})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
