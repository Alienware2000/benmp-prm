/**
 * Loads everything the office Admins tab needs (Decision 0036), server-side with
 * the service role, the same way the Money by Church and cash monitoring routes
 * do. Only the selected month's payments and cash submissions are read.
 */

import type { AdminsInput } from "./admins-overview";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchAll<T>(path: string): Promise<T[]> {
  if (!SUPABASE_URL || !KEY) throw new Error("Supabase is not configured.");
  const all: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`,
      {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Fetch failed: ${path} -> ${res.status}`);
    const rows = (await res.json()) as T[];
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

/** First day of the month after "YYYY-MM", as "YYYY-MM-01". */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export async function loadAdminsInput(month: string): Promise<AdminsInput> {
  const start = `${month}-01`;
  const [
    regions,
    hubs,
    accounts,
    churches,
    partners,
    payments,
    cashSubmissions,
  ] = await Promise.all([
    fetchAll<AdminsInput["regions"][number]>(
      "regions?select=id,code,name&order=sort_order.asc",
    ),
    fetchAll<AdminsInput["hubs"][number]>(
      "hubs?select=id,name,hub_number,region_id,leader_name&order=id.asc",
    ),
    fetchAll<AdminsInput["accounts"][number]>(
      "hub_accounts?select=hub_id,last_login_at&order=id.asc",
    ),
    fetchAll<AdminsInput["churches"][number]>(
      "hub_churches?select=id,name,hub_id,leader_name&order=id.asc",
    ),
    fetchAll<AdminsInput["partners"][number]>(
      "partners?select=id,hub_id,church_id,country&order=id.asc",
    ),
    fetchAll<AdminsInput["payments"][number]>(
      `payments?select=amount_minor,payment_method,raw_row,paid_at&status=eq.Successful` +
        `&paid_at=gte.${start}&paid_at=lt.${nextMonthStart(month)}&order=id.asc`,
    ),
    fetchAll<AdminsInput["cashSubmissions"][number]>(
      `cash_submissions?select=church_id,total_cash_minor,status&reporting_month=eq.${start}&order=id.asc`,
    ),
  ]);
  return {
    regions,
    hubs,
    accounts,
    churches,
    partners,
    payments,
    cashSubmissions,
  };
}
