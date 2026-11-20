/**
 * Loads everything the office Admins tab needs (Decision 0036), server-side with
 * the service role, the same way the Money by Church and cash monitoring routes
 * do. Only the selected month's Monthly Summary Forms are read.
 */

import type { AdminsInput } from "./admins-overview";
import { formsInMonth, type FormRow } from "./admins-metrics";
import { monthsEndingAt } from "../hub/monthly";

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

/** How many months the Admins charts show, ending at the chosen month. */
export const CHART_MONTHS = 12;

/**
 * Everything for `month` plus the Monthly Summary Forms of the `CHART_MONTHS`
 * months ending at it (Decision 0045); the month's filing comes from the same
 * rows.
 */
export async function loadAdminsInput(
  month: string,
): Promise<AdminsInput & { forms: FormRow[]; months: string[] }> {
  const months = monthsEndingAt(month, CHART_MONTHS);
  const [regions, hubs, accounts, churches, partners, forms] =
    await Promise.all([
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
      fetchAll<FormRow>(
        `cash_submissions?select=church_id,hub_id,region_id,reporting_month,total_registered,active_partners,new_registrations,lapsed,total_cash_minor,status` +
          `&reporting_month=gte.${months[0]}-01&reporting_month=lte.${month}-01&order=id.asc`,
      ),
    ]);
  return {
    regions,
    hubs,
    accounts,
    churches,
    partners,
    cashSubmissions: formsInMonth(forms, month),
    forms,
    months,
  };
}
