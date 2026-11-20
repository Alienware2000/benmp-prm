// src/lib/poc/giver-contacts-db.ts
// Loads one month's statement givers for the office's contact CSV (Decision
// 0044) and records each download. Server-only, service role.
import { fetchAll, supabaseRestFetcher, supabaseRestInserter } from "./db";
import { inListChunks } from "./in-list";
import type { GiverContactInput } from "./giver-contacts";

/** First day of the month after "YYYY-MM", as "YYYY-MM-01". */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Every successful payment in `month` ("YYYY-MM") and the partners linked to them. */
export async function getGiverContactInput(
  month: string,
): Promise<GiverContactInput> {
  const fetcher = supabaseRestFetcher();
  const payments = await fetchAll<GiverContactInput["payments"][number]>(
    fetcher,
    `payments?select=partner_id:raw_row->>matched_partner_id,payer_name,payer_phone_e164,paid_at,amount_minor,payment_method,raw_method:raw_row->>_payment_method,raw_source:raw_row->>source` +
      `&status=eq.Successful&paid_at=gte.${month}-01&paid_at=lt.${nextMonthStart(month)}` +
      `&order=paid_at.asc,reference.asc`,
  );
  const ids = [
    ...new Set(payments.flatMap((p) => (p.partner_id ? [p.partner_id] : []))),
  ];
  const partners = (
    await Promise.all(
      inListChunks(ids).map((list) =>
        fetchAll<GiverContactInput["partners"][number]>(
          fetcher,
          `partners?id=in.(${list})&select=id,full_name,momo_phone_number,whatsapp_number&order=id.asc`,
        ),
      ),
    )
  ).flat();
  return { partners, payments };
}

/** Record a contact-list download in audit_log (month, how many). */
export async function auditGiverExport(entry: {
  month: string;
  contacts: number;
}): Promise<void> {
  await supabaseRestInserter()("audit_log", [
    {
      action: "giver_contacts_export",
      entity_table: "payments",
      entity_id: null,
      after_data: {
        exported_by: "office",
        month: entry.month,
        contacts: entry.contacts,
      },
    },
  ]);
}
