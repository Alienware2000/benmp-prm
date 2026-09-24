/**
 * Dashboard metrics for the POC overview — the 4 headline tiles.
 *
 * Reads directly from the Supabase partners + POC payments tables via
 * PostgREST (same service-role pattern as src/lib/hub/db.ts). All money is
 * integer minor units; GHS and USD are both displayed.
 *
 * Geography grouping (Decision: user instruction 2026-09-23):
 *   Ghana | Africa | Europe | North America | Others
 * Partners with no country (NULL/empty) are counted as Ghana.
 */

import { ghanaLastNineKey } from "./payment-upload";

// ---------------------------------------------------------------------------
// Geography mapping
// ---------------------------------------------------------------------------
export type Geography =
  | "Ghana"
  | "Africa"
  | "United Kingdom"
  | "Europe"
  | "North America"
  | "South America"
  | "Pacific/Asia"
  | "Unlisted";

export const GEOGRAPHIES: Geography[] = [
  "Ghana",
  "Africa",
  "United Kingdom",
  "Europe",
  "North America",
  "South America",
  "Pacific/Asia",
  "Unlisted",
];

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

const UK_COUNTRIES = new Set([
  "United Kingdom", "UK", "England", "Scotland", "Wales", "Northern Ireland",
]);

/** European countries excluding UK (UK is its own group). */
const EUROPEAN_COUNTRIES = new Set([
  "Ireland", "Germany", "France", "Italy", "Spain", "Portugal",
  "Netherlands", "Belgium", "Switzerland", "Austria", "Sweden",
  "Norway", "Denmark", "Finland", "Iceland", "Poland", "Czech Republic",
  "Hungary", "Romania", "Bulgaria", "Greece", "Croatia", "Slovenia",
  "Slovakia", "Estonia", "Latvia", "Lithuania", "Luxembourg", "Malta",
  "Cyprus", "Russia", "Ukraine", "Belarus", "Moldova", "Serbia",
  "Bosnia and Herzegovina", "Montenegro", "North Macedonia", "Albania",
  "Norway", "Andorra", "Liechtenstein", "Monaco", "San Marino",
  "Vatican City", "Faroe Islands", "Isle of Man", "Jersey", "Guernsey",
]);

const NORTH_AMERICAN_COUNTRIES = new Set([
  "United States", "USA", "US", "Canada", "Mexico",
  "Greenland", "Bermuda", "Bahamas", "Jamaica", "Trinidad and Tobago",
  "Barbados", "Saint Lucia", "Grenada", "Saint Vincent and the Grenadines",
  "Dominica", "Antigua and Barbuda", "Saint Kitts and Nevis",
  "Dominican Republic", "Haiti", "Cuba", "Puerto Rico",
  "Saint Martin", "Anguilla", "British Virgin Islands",
  "Cayman Islands", "Turks and Caicos Islands",
]);

const SOUTH_AMERICAN_COUNTRIES = new Set([
  "Brazil", "Argentina", "Colombia", "Peru", "Venezuela", "Chile",
  "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Guyana", "Suriname",
  "French Guiana", "Falkland Islands",
]);

const PACIFIC_ASIA_COUNTRIES = new Set([
  "Australia", "New Zealand", "China", "Japan", "South Korea",
  "North Korea", "India", "Pakistan", "Bangladesh", "Sri Lanka",
  "Nepal", "Bhutan", "Maldives", "Afghanistan", "Iran", "Iraq",
  "Saudi Arabia", "UAE", "United Arab Emirates", "Qatar", "Kuwait",
  "Bahrain", "Oman", "Yemen", "Jordan", "Lebanon", "Syria",
  "Israel", "Palestine", "Turkey", "Georgia", "Armenia", "Azerbaijan",
  "Kazakhstan", "Uzbekistan", "Turkmenistan", "Kyrgyzstan", "Tajikistan",
  "Thailand", "Vietnam", "Cambodia", "Laos", "Myanmar", "Malaysia",
  "Singapore", "Indonesia", "Philippines", "Brunei", "Timor-Leste",
  "Papua New Guinea", "Fiji", "Solomon Islands", "Vanuatu",
  "Samoa", "Tonga", "Kiribati", "Tuvalu", "Nauru", "Palau",
  "Micronesia", "Marshall Islands", "Cook Islands", "Niue",
  "Taiwan", "Hong Kong", "Macao",
]);

export function toGeography(country: string | null | undefined): Geography {
  if (!country || country.trim() === "") return "Ghana"; // unassigned → Ghana
  const c = country.trim();
  if (c.toLowerCase() === "unlisted") return "Unlisted";
  if (c.toLowerCase() === "ghana") return "Ghana";
  if (c.toLowerCase() === "europe") return "Europe"; // broad country label used in DB
  if (AFRICAN_COUNTRIES.has(c)) return "Africa";
  if (UK_COUNTRIES.has(c)) return "United Kingdom";
  if (EUROPEAN_COUNTRIES.has(c)) return "Europe";
  if (NORTH_AMERICAN_COUNTRIES.has(c)) return "North America";
  if (SOUTH_AMERICAN_COUNTRIES.has(c)) return "South America";
  if (PACIFIC_ASIA_COUNTRIES.has(c)) return "Pacific/Asia";
  return "Ghana"; // unknown country → Ghana (per user instruction: unassigned counts as Ghana)
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
  /** Distinct partners who donated (per-period for monthly; all-time for cumulative). */
  donorCount: number;
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
  activeThisMonth: number;
  activeThisYear: number;
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

export type DashboardPartnerRow = {
  id: string;
  country: string | null;
  last_contribution_date: string | null;
  momo_phone_number: string | null;
  whatsapp_number: string | null;
};
export type DashboardPaymentRow = {
  reference: string;
  payer_phone_e164: string | null;
  amount_minor: number;
  currency: string | null;
  paid_at: string | null;
  status: string | null;
  raw_row?: Record<string, unknown> | null;
};

async function fetchAllPartners(): Promise<DashboardPartnerRow[]> {
  if (!SUPABASE_URL || !KEY) return [];
  const out: DashboardPartnerRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?select=id,country,last_contribution_date,momo_phone_number,whatsapp_number&order=id.asc&limit=1000&offset=${offset}`,
      { headers: restHeaders(), cache: "no-store" },
    );
    if (!res.ok) break;
    const rows = (await res.json()) as DashboardPartnerRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function fetchAllPayments(): Promise<DashboardPaymentRow[]> {
  if (!SUPABASE_URL || !KEY) return [];
  const out: DashboardPaymentRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?select=reference,payer_phone_e164,amount_minor,currency,paid_at,status,raw_row&status=eq.Successful&order=paid_at.desc&limit=1000&offset=${offset}`,
      { headers: restHeaders(), cache: "no-store" },
    );
    if (!res.ok) break;
    const rows = (await res.json()) as DashboardPaymentRow[];
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
    m.set(g, { geography: g, partnerCount: 0, donorCount: 0, amountMinor: 0, currency: "GHS" });
  }
  return m;
}

export function buildDashboardTiles({
  partners,
  payments,
}: {
  partners: DashboardPartnerRow[];
  payments: DashboardPaymentRow[];
}): DashboardTiles {
  // Build partner geography map
  const partnerGeo = new Map<string, Geography>();
  const partnerIdByLastNine = new Map<string, string>();
  for (const p of partners) {
    partnerGeo.set(p.id, toGeography(p.country));
    for (const phone of [p.momo_phone_number, p.whatsapp_number]) {
      const key = ghanaLastNineKey(phone);
      if (key && !partnerIdByLastNine.has(key)) partnerIdByLastNine.set(key, p.id);
    }
  }

  // Tile 1: Total partners
  const totalPartners = partners.length;

  const paidPartnerIds = new Set<string>();

  // Aggregate contributions
  const cumByGeo = emptyGeoBreakdown();
  const monthMap = new Map<string, Map<Geography, GeographyBreakdown>>();
  // Distinct donor partner IDs per geography: cumulative (all-time) and per-month.
  const cumDonorByGeo = new Map<Geography, Set<string>>();
  const monthDonorMap = new Map<string, Map<Geography, Set<string>>>();
  let cumulativeMinor = 0;
  let cumulativeCurrency = "GHS";

  // Partner counts by geography (from the partners table, not contributions)
  const partnerCountByGeo = new Map<Geography, number>();
  for (const p of partners) {
    const g = partnerGeo.get(p.id) ?? "Ghana";
    partnerCountByGeo.set(g, (partnerCountByGeo.get(g) ?? 0) + 1);
  }

  for (const payment of payments) {
    const matchedPartnerIdFromRaw =
      typeof payment.raw_row?.matched_partner_id === "string"
        ? payment.raw_row.matched_partner_id
        : null;
    const lastNine = ghanaLastNineKey(payment.payer_phone_e164);
    const partnerId = matchedPartnerIdFromRaw ?? (lastNine ? partnerIdByLastNine.get(lastNine) : null);
    if (partnerId) paidPartnerIds.add(partnerId);
    const geo = partnerId ? (partnerGeo.get(partnerId) ?? "Ghana") : "Ghana";
    const amount = Number(payment.amount_minor);
    cumulativeMinor += amount;
    cumulativeCurrency = payment.currency || "GHS";

    const cum = cumByGeo.get(geo)!;
    cum.amountMinor += amount;

    // Track distinct donors per geography (cumulative + per-month)
    if (partnerId) {
      let cumSet = cumDonorByGeo.get(geo);
      if (!cumSet) {
        cumSet = new Set<string>();
        cumDonorByGeo.set(geo, cumSet);
      }
      cumSet.add(partnerId);
    }

    const month = (payment.paid_at ?? "").slice(0, 7); // YYYY-MM
    if (!month) continue;
    if (!monthMap.has(month)) {
      monthMap.set(month, emptyGeoBreakdown());
    }
    const m = monthMap.get(month)!;
    m.get(geo)!.amountMinor += amount;

    if (partnerId) {
      let monthGeoMap = monthDonorMap.get(month);
      if (!monthGeoMap) {
        monthGeoMap = new Map<Geography, Set<string>>();
        monthDonorMap.set(month, monthGeoMap);
      }
      let monthSet = monthGeoMap.get(geo);
      if (!monthSet) {
        monthSet = new Set<string>();
        monthGeoMap.set(geo, monthSet);
      }
      monthSet.add(partnerId);
    }
  }

  // Tile 2: Active partners (paid at least once in the POC payments ledger)
  const activePartners = paidPartnerIds.size;

  // Tile 2 sub-counts: partners active this calendar month / this year (last 12 months)
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let activeThisMonth = 0;
  let activeThisYear = 0;
  for (const p of partners) {
    const raw = p.last_contribution_date;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (d >= monthStart) activeThisMonth++;
    if (d >= yearStart) activeThisYear++;
  }

  // Set partner counts in cumulative geography breakdown (directory totals for tile 1)
  for (const [geo, count] of partnerCountByGeo) {
    cumByGeo.get(geo)!.partnerCount = count;
  }
  // Set donor counts (distinct partners who ever donated per geo, for tile 4 drill-down)
  for (const [geo, donors] of cumDonorByGeo) {
    cumByGeo.get(geo)!.donorCount = donors.size;
  }

  const byGeography: GeographyBreakdown[] = Array.from(cumByGeo.values());

  // Monthly breakdown
  const sortedMonths = Array.from(monthMap.keys()).sort().reverse();
  const byMonth: MonthlyBreakdown[] = sortedMonths.map((month) => {
    const geoMap = monthMap.get(month)!;
    const donorGeoMap = monthDonorMap.get(month);
    // Set per-month donor counts (partners who donated in this month per geo, for tile 3 drill-down)
    if (donorGeoMap) {
      for (const [geo, donors] of donorGeoMap) {
        geoMap.get(geo)!.donorCount = donors.size;
      }
    }
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
    activeThisMonth,
    activeThisYear,
    mostRecentMonth,
    cumulative: {
      amountMinor: cumulativeMinor,
      currency: cumulativeCurrency,
      byGeography,
      byMonth,
    },
  };
}

export async function getDashboardTiles(): Promise<DashboardTiles> {
  const [partners, payments] = await Promise.all([
    fetchAllPartners(),
    fetchAllPayments(),
  ]);
  return buildDashboardTiles({ partners, payments });
}
