/**
 * Partner directory — search the full partners table and message specific people.
 *
 * Distinct from src/lib/poc/db.ts on purpose. db.ts reads the Qodesh event tables
 * (registrations + payments) and drives period reconciliation; this module reads
 * `partners` (15k rows across ~100 branches), which is the standing directory staff
 * search when they want ONE person rather than a whole reconciliation bucket.
 *
 * Phones live in `whatsapp_number` (already E.164); `church` is the branch.
 *
 * Server-only — the fetcher uses the service_role key. The query building and the
 * row->domain mapping are pure and unit-tested; only the fetch is I/O.
 */

import { normalizePhone } from "../phone";
import type { Fetcher } from "./db";
import { supabaseRestFetcher } from "./db";

/** A row as it comes back from PostgREST. */
export type DbPartner = {
  id: string;
  full_name: string | null;
  whatsapp_number: string | null;
  church: string | null;
  country: string | null;
  status: string | null;
};

export type DirectoryPartner = {
  id: string;
  /** Display name; never empty (see displayName). */
  name: string;
  /** E.164, or null when the row has no usable phone -> not messageable. */
  phone: string | null;
  branch: string;
  country: string;
  /** Total given to date in minor units, matched by phone. */
  givenMinor: number;
  /** False when there is no phone to send to. */
  messageable: boolean;
};

export type DirectoryQuery = {
  /** Free-text name search. */
  q?: string;
  /**
   * Every raw spelling of the chosen branch. One branch can be spelled several ways in
   * the data, so filtering on a single value would silently hide most of its partners.
   */
  branchVariants?: string[];
  page?: number;
  pageSize?: number;
};

export const DEFAULT_PAGE_SIZE = 25;
/** PostgREST refuses absurd ranges and the UI can't use them either. */
export const MAX_PAGE_SIZE = 100;

/**
 * The import carries literal "No Name" placeholders (and some blanks) where the source
 * sheet had no name. Both must read as unknown rather than greeting someone as "No".
 */
export function displayName(raw: string | null | undefined): string {
  return isSensibleName(raw) ? (raw ?? "").trim() : "Unknown";
}

/**
 * Sense gate for a partner name.
 *
 * A person's name is not a number and not a reference code. The import left three kinds
 * of non-name in `full_name`: the literal "No Name" placeholder (14), a bare row number
 * (`"1.0"`), and sheet reference codes (`"FL73"`, `"FL1061"` — 44 of them, from the same
 * column-shifted rows whose real names ended up in `whatsapp_number`).
 *
 * Anything rejected here shows as "Unknown" and is greeted neutrally, so no one is
 * addressed as "Hi 1.0" or "Hi FL73". Kept deliberately narrow — it must never reject a
 * real name, so only these shapes fail.
 */
export function isSensibleName(raw: string | null | undefined): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "no name") return false;

  // A name needs letters, and more than one — "1.0", "233242743986.0", "-" are not names.
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length < 2) return false;

  // A short prefix followed by digits is a reference code, not a person: FL73, AB1234.
  // Real names don't end in a number, so this can't catch one.
  if (/^[A-Za-z]{1,3}[-\s]?\d+$/.test(trimmed)) return false;

  return true;
}

/** True when we have a real name to put in a greeting. */
export function hasRealName(raw: string | null | undefined): boolean {
  return displayName(raw) !== "Unknown";
}

/** Shown for a partner whose branch is missing or unusable. */
export const NO_BRANCH = "Unassigned";

/**
 * 45 rows arrived from the import with their columns shifted one place: the row number
 * landed in full_name, the phone landed in church ("233242743986.0"), and the real name
 * landed in whatsapp_number. A phone number is not a branch, so it must not appear in the
 * branch column or the branch filter. Detected by shape rather than by a fixed list, so a
 * future bad import is caught too.
 */
export function isValidBranch(raw: string | null | undefined): boolean {
  const b = (raw ?? "").trim();
  if (!b) return false;
  // Digits, dots, plus and spaces only -> a mangled phone, not a place.
  if (/^[\d.+\s]+$/.test(b)) return false;
  return true;
}

/** Branch for display: the real value, or the Unassigned label when it is unusable. */
export function branchLabel(raw: string | null | undefined): string {
  return isValidBranch(raw) ? (raw ?? "").trim() : NO_BRANCH;
}

/**
 * Match key for a branch name.
 *
 * The source sheets spell one branch many ways — "Mankessim"/"MANKESSIM",
 * "Kent City"/"KENT CITY"/"Kent CITY"/"KEnt CITY"/"kent City"/"Kent city",
 * "Tema Comm 22"/"Tema Comm. 22". Treating those as distinct branches splits one
 * congregation across several filter entries and several giving subtotals. Case,
 * accents, punctuation and repeated spaces are all noise; the letters and digits are
 * the branch.
 */
export function normalizeBranchKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Branch spellings confirmed by BENMP staff (2026-07-21) to be the same place, where
 * normalization alone can't tell: real misspellings, transposed letters, and a qualifier
 * that is decoration rather than a distinct congregation.
 *
 * Deliberately an explicit list, NOT fuzzy matching. A distance threshold that merges
 * "MIGTHY"/"MIGHTY" also merges "NEW TAFO"/"OLD TAFO", "Savelugu north"/"south",
 * "ENCHI"/"Wenchi" and "BEREKUM"/"Berekuso" — separate branches that must stay separate.
 * Every entry here was confirmed by a human; add only with the same confirmation.
 *
 * Each row lists the normalized keys that mean one branch. The displayed name is still
 * the most-used spelling in the data, not a value invented here.
 */
const BRANCH_MERGES: string[][] = [
  ["KORLE GONNO", "KORLEGONNO"],
  ["SOWUTUOM", "SOWUTIOM"],
  ["HOHOE MISSION", "HOHOE"],
  ["TAMALE APARCHE", "TAMALA APARCHE"],
  ["SWEDRU APARCHE", "SWEDRU APACHE"],
  ["SUSUANKYI", "SUSANKYI"],
  // Berekuso is a different branch and is intentionally absent.
  ["BEREKUM", "BEREKU", "BBEREKUM"],
  ["SARBENG AKROFUOM", "SARBENG AKFROFUOM", "SARBEBG AKROFUOM", "SARBENG AKROFOUM"],
  ["ABLEKUMA MAIN", "ABLEKUMAN MAIN"],
  ["ASSIN FOSU", "ASSIN FOSO"],
  ["BUNKPURUGU MISSION", "BUNKPURUGU"],
  ["MIGHTY GOD CATHEDRAL", "MIGTHY GOD CATHEDRAL"],
];

/** variant key -> canonical key. */
const BRANCH_ALIASES: Map<string, string> = new Map(
  BRANCH_MERGES.flatMap(([canonical, ...variants]) =>
    variants.map((v) => [v, canonical] as [string, string]),
  ),
);

/** Resolve a normalized branch key through the confirmed merge list. */
export function resolveBranchKey(key: string): string {
  return BRANCH_ALIASES.get(key) ?? key;
}

export type BranchGroup = {
  /** Normalized match key. */
  key: string;
  /** How the branch is shown to staff — the spelling most people are recorded under. */
  label: string;
  /** Every raw spelling in the data, so a filter can match all of them. */
  variants: string[];
  /** Partners across all spellings. */
  count: number;
};

/**
 * Collapse raw branch values (with repeats, one per partner) into canonical groups.
 *
 * The display label is the most-used spelling rather than an invented "correct" one —
 * staff recognise what they typed. Ties break alphabetically so the result is stable.
 */
export function groupBranches(values: Array<string | null | undefined>): BranchGroup[] {
  const counts = new Map<string, Map<string, number>>();

  for (const v of values) {
    if (!isValidBranch(v)) continue;
    const raw = (v ?? "").trim();
    const key = resolveBranchKey(normalizeBranchKey(raw));
    if (!key) continue;
    const spellings = counts.get(key) ?? new Map<string, number>();
    spellings.set(raw, (spellings.get(raw) ?? 0) + 1);
    counts.set(key, spellings);
  }

  const groups: BranchGroup[] = [];
  for (const [key, spellings] of counts) {
    const variants = [...spellings.keys()].sort((a, b) => a.localeCompare(b));
    let label = variants[0];
    let best = -1;
    for (const v of variants) {
      const n = spellings.get(v) ?? 0;
      if (n > best) {
        best = n;
        label = v;
      }
    }
    groups.push({
      key,
      label,
      variants,
      count: [...spellings.values()].reduce((s, n) => s + n, 0),
    });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * PostgREST treats , . ( ) : as syntax inside a filter value. A partner searching for
 * "O'Brien, Kwame" must not be able to smuggle in filter syntax, so strip the
 * structural characters rather than escaping them.
 */
export function sanitizeSearch(raw: string | undefined | null): string {
  return (raw ?? "").replace(/[,.()*:"\\]/g, " ").trim().slice(0, 80);
}

export function clampPageSize(size: number | undefined): number {
  if (!size || !Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(size), MAX_PAGE_SIZE);
}

export function clampPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) return 1;
  return Math.trunc(page);
}

const SELECT = "id,full_name,whatsapp_number,church,country,status";

/**
 * PostgREST caps every response at its configured max-rows (1000 on Supabase) and does so
 * SILENTLY — `limit=20000` returns 1000 rows with no error. Anything that must see the
 * whole partners table (15k rows) has to page explicitly, or it quietly works off the
 * first 1000 rows and produces answers that look plausible and are wrong.
 */
export const PAGE_LIMIT = 1000;

/** Hard stop so a mistaken path can't spin forever. */
const MAX_ROWS = 50_000;

/**
 * Read every row of `basePath` by paging with limit/offset.
 *
 * The caller's path MUST impose a stable sort (PostgREST paging without an ORDER BY can
 * repeat or skip rows between requests); `order` is appended here when absent.
 */
export async function fetchAllRows<T>(
  fetcher: Fetcher,
  basePath: string,
  orderBy = "id.asc",
): Promise<T[]> {
  const path = basePath.includes("order=") ? basePath : `${basePath}&order=${orderBy}`;
  const all: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_LIMIT) {
    const batch = await fetcher<T>(`${path}&limit=${PAGE_LIMIT}&offset=${offset}`);
    all.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
  }
  return all;
}

/**
 * Build the PostgREST path for a directory search. Pure so the filter/paging rules are
 * testable without a network round trip.
 */
export function buildDirectoryPath(query: DirectoryQuery): string {
  const params: string[] = [`select=${SELECT}`, "order=full_name.asc"];

  const q = sanitizeSearch(query.q);
  if (q) params.push(`full_name=ilike.*${encodeURIComponent(q)}*`);

  const variants = (query.branchVariants ?? []).filter((v) => v.trim());
  if (variants.length > 0) {
    // PostgREST in.() needs each value double-quoted: branch names contain spaces, dots
    // and hyphens, any of which would otherwise be read as list syntax.
    const list = variants.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",");
    params.push(`church=in.(${encodeURIComponent(list)})`);
  }

  return `partners?${params.join("&")}`;
}

export function rangeHeader(query: DirectoryQuery): { from: number; to: number } {
  const size = clampPageSize(query.pageSize);
  const page = clampPage(query.page);
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

/**
 * Total given per E.164 phone. The POC ledger is small (a few hundred rows), so summing
 * in memory is honest and simple; if payments grow past a few thousand this becomes a
 * grouped SQL view instead.
 */
export function givingByPhone(
  payments: Array<{ payer_phone_e164: string | null; amount_minor: number | string }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of payments) {
    const phone = normalizePhone(p.payer_phone_e164);
    if (!phone) continue;
    totals.set(phone, (totals.get(phone) ?? 0) + Number(p.amount_minor));
  }
  return totals;
}

export function mapPartners(rows: DbPartner[], giving: Map<string, number>): DirectoryPartner[] {
  return rows.map((r) => {
    const phone = normalizePhone(r.whatsapp_number);
    return {
      id: r.id,
      name: displayName(r.full_name),
      phone,
      branch: branchLabel(r.church),
      country: (r.country ?? "").trim() || "—",
      givenMinor: phone ? (giving.get(phone) ?? 0) : 0,
      messageable: phone !== null,
    };
  });
}

/** Parse PostgREST's "0-24/15329" content-range into the total row count. */
export function parseTotalCount(contentRange: string | null): number {
  if (!contentRange) return 0;
  const total = contentRange.split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

export type DirectoryPage = {
  partners: DirectoryPartner[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Count-aware fetch. The plain Fetcher in db.ts drops response headers, and paging needs
 * the total from Content-Range, so the directory does its own request.
 */
async function fetchWithCount(path: string, from: number, to: number): Promise<{ rows: DbPartner[]; total: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: `${from}-${to}`,
    },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  }
  return {
    rows: (await res.json()) as DbPartner[],
    total: parseTotalCount(res.headers.get("content-range")),
  };
}

export async function searchDirectory(
  query: DirectoryQuery,
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<DirectoryPage> {
  const { from, to } = rangeHeader(query);
  const [{ rows, total }, payments] = await Promise.all([
    fetchWithCount(buildDirectoryPath(query), from, to),
    fetcher<{ payer_phone_e164: string | null; amount_minor: number | string }>(
      "payments?select=payer_phone_e164,amount_minor&status=eq.Successful&limit=5000",
    ),
  ]);

  return {
    partners: mapPartners(rows, givingByPhone(payments)),
    total,
    page: clampPage(query.page),
    pageSize: clampPageSize(query.pageSize),
  };
}

/**
 * Distinct branches for the filter dropdown. PostgREST has no DISTINCT, so this pulls the
 * branch column and reduces it here — fine at 15k rows, and the result is cached per
 * request by the caller.
 */
export async function listBranchGroups(fetcher: Fetcher = supabaseRestFetcher()): Promise<BranchGroup[]> {
  const rows = await fetchAllRows<{ church: string | null }>(fetcher, "partners?select=church,id");
  return groupBranches(rows.map((r) => r.church));
}

/** Look up specific partners by id — the send path re-reads them rather than trusting the client. */
export async function loadPartnersByIds(
  ids: string[],
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<DirectoryPartner[]> {
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (clean.length === 0) return [];
  const rows = await fetcher<DbPartner>(
    `partners?select=${SELECT}&id=in.(${clean.join(",")})&limit=${clean.length}`,
  );
  const payments = await fetcher<{ payer_phone_e164: string | null; amount_minor: number | string }>(
    "payments?select=payer_phone_e164,amount_minor&status=eq.Successful&limit=5000",
  );
  return mapPartners(rows, givingByPhone(payments));
}
