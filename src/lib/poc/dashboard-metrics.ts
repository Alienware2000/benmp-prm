/**
 * Dashboard metrics for the POC overview — the 4 headline tiles.
 *
 * Reads directly from the Supabase partners + contributions tables via
 * PostgREST (same service-role pattern as src/lib/hub/db.ts). All money is
 * integer minor units; GHS and USD are both displayed.
 *
 * Geography grouping (Decision: user instruction 2026-09-23):
 *   Ghana | Africa | Europe | North America | Others
 * Partners with no country (NULL/empty) are counted as Ghana.
 */

// ---------------------------------------------------------------------------
// Geography mapping
// ---------------------------------------------------------------------------

export type Geography = "Ghana" | "Africa" | "Europe" | "North America" | "Others";

export const GEOGRAPHIES: Geography[] = ["Ghana", "Africa", "Europe", "North America", "Others"];

/** African countries excluding Ghana (Ghana is its own group). */
const AFRICAN_COUNTRIES = new Set([
  "Kenya", "South Africa", "Gabon", "Malawi", "Namibia", "Senegal",
  "Guinea Conakry", "Equatorial Guinea", "Rwanda", "Guinea-Bissau",
  "Chad", "Niger", "Seychelles", "Mali", "Lesotho", "São Tomé",
  "Nigeria", "Cote d'Ivoire", "Ivory Coast", "Cameroon", "Togo",
  "Burkina Faso", "Liberia", "Sierra Leone", "Uganda", "Tanzania",
  "Zambia", "Zimbabwe", "Botswana", "Mozambique", "Angola",
  "Democratic Republic of Congo", "Congo", "Madagascar", "Mauritius",
  "Comoros", "Cape Verde", "Gambia", "Mauritania", "Burundi",
  "South Sudan", "Sudan", "Egypt", "Libya", "Tunisia", "Algeria",
  "Morocco", "Eswatini", "Djibouti", "Eritrea", "Somalia",
  "Central African Republic", "Sao Tome and Principe",
]);

const EUROPEAN_COUNTRIES = new Set([
  "United Kingdom", "UK", "England", "Scotland", "Wales", "Ireland",
  "Germany", "France", "Italy", "Spain", "Portugal", "Netherlands",
  "Belgium", "Switzerland", "Austria", "Sweden", "Norway", "Denmark",
  "Finland", "Iceland", "Poland", "Czech Republic", "Hungary", "Romania",
  "Bulgaria", "Greece", "Croatia", "Slovenia", "Slovakia", "Estonia",
  "Latvia", "Lithuania", "Luxembourg", "Malta", "Cyprus",
]);

const NORTH_AMERICAN_COUNTRIES = new Set([
  "United States", "USA", "US", "Canada", "Mexico",
  "Greenland", "Bermuda", "Bahamas", "Jamaica", "Trinidad and Tobago",
  "Barbados", "Saint Lucia", "Grenada", "Saint Vincent and the Grenadines",
  "Dominica", "Antigua and Barbuda", "Saint Kitts and Nevis",
]);

export function toGeography(country: string | null | undefined): Geography {
  if (!country || country.trim() === "") return "Ghana"; // unassigned → Ghana
  const c = country.trim();
  if (c.toLowerCase() === "ghana") return "Ghana";
  if (AFRICAN_COUNTRIES.has(c)) return "Africa";
  if (EUROPEAN_COUNTRIES.has(c)) return "Europe";
  if (NORTH_AMERICAN_COUNTRIES.has(c)) return "North America";
  return "Others";
}

// ---------------------------------------------------------------------------
// PostgREST helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restHeaders(): Record<string, string> {
  if (!SUPABASE_URL || !KEY) {
    throw new Error("Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeographyBreakdown = {
  geography: Geography;
  partnerCount: number;
  amountMinor: number;
  currency: string;
};

export type MonthlyBreakdown = {
  month: string; // YYYY-MM
  amountMinor: number;
  currency: string;
  byGeography: GeographyBreakdown[];
};

export type DashboardTiles = {
  totalPartners: number;
  activePartners: number;
  mostRecentMonth: {
    month: string;
    amountMinor: number;
    currency: string;
    byGeography: GeographyBreakdown[];
  } | null;
  cumulative: {
    amountMinor: number;
    currency: string;
    byGeography: GeographyBreakdown[];
    byMonth: MonthlyBreakdown[];
  };
};

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

type PartnerRow = { id: string; country: string | null; last_contribution_date: string | null };
type ContributionRow = {
  id: string;
  partner_id: string | null;
  amount_minor: number;
  currency: string;
  contribution_date: string;
};

async function fetchAllPartners(): Promise<PartnerRow[]> {
  if (!SUPABASE_URL || !KEY) return [];
  const out: PartnerRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?select=id,country,last_contribution_date&order=id.asc&limit=1000&offset=${offset}`,
      { headers: restHeaders(), cache: "no-store" },
    );
    if (!res.ok) break;
    const rows = (await res.json()) as PartnerRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function fetchAllContributions(): Promise<ContributionRow[]> {
  if (!SUPABASE_URL || !KEY) return [];
  const out: ContributionRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/contributions?select=id,partner_id,amount_minor,currency,contribution_date&status=eq.succeeded&order=contribution_date.desc&limit=1000&offset=${offset}`,
      { headers: restHeaders(), cache: "no-store" },
    );
    if (!res.ok) break;
    const rows = (await res.json()) as ContributionRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function emptyGeoBreakdown(): Map<Geography, GeographyBreakdown> {
  const m = new Map<Geography, GeographyBreakdown>();
  for (const g of GEOGRAPHIES) {
    m.set(g, { geography: g, partnerCount: 0, amountMinor: 0, currency: "GHS" });
  }
  return m;
}

export async function getDashboardTiles(): Promise<DashboardTiles> {
  const [partners, contributions] = await Promise.all([
    fetchAllPartners(),
    fetchAllContributions(),
  ]);

  // Build partner geography map
  const partnerGeo = new Map<string, Geography>();
  for (const p of partners) {
    partnerGeo.set(p.id, toGeography(p.country));
  }

  // Tile 1: Total partners
  const totalPartners = partners.length;

  // Tile 2: Active partners (given at least once — last_contribution_date not null)
  const activePartners = partners.filter(
    (p) => p.last_contribution_date !== null,
  ).length;

  // Aggregate contributions
  const cumByGeo = emptyGeoBreakdown();
  const monthMap = new Map<string, Map<Geography, GeographyBreakdown>>();
  let cumulativeMinor = 0;
  let cumulativeCurrency = "GHS";

  // Partner counts by geography (from the partners table, not contributions)
  const partnerCountByGeo = new Map<Geography, number>();
  for (const p of partners) {
    const g = partnerGeo.get(p.id) ?? "Ghana";
    partnerCountByGeo.set(g, (partnerCountByGeo.get(g) ?? 0) + 1);
  }

  for (const c of contributions) {
    const geo = c.partner_id
      ? (partnerGeo.get(c.partner_id) ?? "Ghana") // unassigned partner → Ghana
      : "Ghana"; // unassigned giving (no partner_id) → Ghana
    const amount = c.amount_minor;
    cumulativeMinor += amount;
    cumulativeCurrency = c.currency || "GHS";

    const cum = cumByGeo.get(geo)!;
    cum.amountMinor += amount;

    const month = c.contribution_date.slice(0, 7); // YYYY-MM
    if (!monthMap.has(month)) {
      monthMap.set(month, emptyGeoBreakdown());
    }
    const m = monthMap.get(month)!;
    m.get(geo)!.amountMinor += amount;
  }

  // Set partner counts in cumulative geography breakdown
  for (const [geo, count] of partnerCountByGeo) {
    cumByGeo.get(geo)!.partnerCount = count;
  }

  const byGeography: GeographyBreakdown[] = Array.from(cumByGeo.values());

  // Monthly breakdown
  const sortedMonths = Array.from(monthMap.keys()).sort().reverse();
  const byMonth: MonthlyBreakdown[] = sortedMonths.map((month) => {
    const geoMap = monthMap.get(month)!;
    return {
      month,
      amountMinor: Array.from(geoMap.values()).reduce((s, g) => s + g.amountMinor, 0),
      currency: "GHS",
      byGeography: Array.from(geoMap.values()),
    };
  });

  // Tile 3: Most recent month
  const mostRecentMonth = byMonth.length > 0 ? {
    month: byMonth[0].month,
    amountMinor: byMonth[0].amountMinor,
    currency: byMonth[0].currency,
    byGeography: byMonth[0].byGeography,
  } : null;

  return {
    totalPartners,
    activePartners,
    mostRecentMonth,
    cumulative: {
      amountMinor: cumulativeMinor,
      currency: cumulativeCurrency,
      byGeography,
      byMonth,
    },
  };
}