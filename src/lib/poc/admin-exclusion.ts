/**
 * BENMP admin exclusion — loads the benmp_admins table and provides
 * helpers to filter admins out of giver insights and reconciliation.
 *
 * Server-only: uses the service role key, same pattern as src/lib/hub/db.ts.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type BenmpAdmin = {
  id: string;
  fullName: string;
  nameKey: string;
  phoneE164: string | null;
};

type AdminRow = {
  id: string;
  full_name: string;
  name_key: string;
  phone_e164: string | null;
};

function normalizeNameKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Cached admin set — loaded once per request cycle. */
let cachedAdmins: BenmpAdmin[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Load all admins from the benmp_admins table. Returns an empty array
 * when the table doesn't exist yet (graceful — the migration may not
 * have been applied). Cached for 1 minute to avoid a PostgREST call
 * on every reconciliation.
 */
export async function loadAdmins(): Promise<BenmpAdmin[]> {
  if (cachedAdmins && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedAdmins;
  }

  if (!SUPABASE_URL || !KEY) {
    cachedAdmins = [];
    return cachedAdmins;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/benmp_admins?select=id,full_name,name_key,phone_e164&order=full_name.asc&limit=500`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      // Table doesn't exist yet (404) or other error — return empty
      cachedAdmins = [];
      return cachedAdmins;
    }

    const rows = (await res.json()) as AdminRow[];
    cachedAdmins = rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      nameKey: r.name_key ?? normalizeNameKey(r.full_name),
      phoneE164: r.phone_e164,
    }));
    cacheTime = Date.now();
    return cachedAdmins;
  } catch {
    cachedAdmins = [];
    return cachedAdmins;
  }
}

/** Clear the admin cache (e.g. after inserting a new admin). */
export function clearAdminCache(): void {
  cachedAdmins = null;
  cacheTime = 0;
}

/**
 * Check whether a name matches any admin (case/whitespace-insensitive).
 * Also checks partial matches — "Pamela Quarshie" should match
 * "Pamela Dede Quarshie" if either is a substring of the other after
 * normalization.
 */
export function isAdminName(name: string, admins: BenmpAdmin[]): boolean {
  const key = normalizeNameKey(name);
  if (!key) return false;
  return admins.some((admin) => {
    if (admin.nameKey === key) return true;
    // Partial match: admin name contains the giver name or vice versa
    // (handles "Pamela Quarshie" vs "Pamela Dede Quarshie")
    return admin.nameKey.includes(key) || key.includes(admin.nameKey);
  });
}

/** Check whether a phone matches any admin. */
export function isAdminPhone(phone: string | null, admins: BenmpAdmin[]): boolean {
  if (!phone) return false;
  return admins.some((admin) => admin.phoneE164 === phone);
}

/**
 * Filter a list of givers, removing any whose name or phone matches an admin.
 * Pure function — used by the reconciliation pipeline.
 */
export function filterOutAdmins<T extends { name: string; phone?: string | null }>(
  givers: T[],
  admins: BenmpAdmin[],
): T[] {
  if (admins.length === 0) return givers;
  return givers.filter(
    (g) => !isAdminName(g.name, admins) && !isAdminPhone(g.phone ?? null, admins),
  );
}