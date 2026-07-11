/**
 * DB-backed reconciliation for the POC (POC-5).
 *
 * Reads the Qodesh registrations + payments from Supabase and runs the tested
 * reconcile() over them. Server-only (uses the service_role key). The row->domain
 * mapping is pure and unit-tested with an injected fetcher; the default fetcher hits
 * PostgREST.
 */

import {
  reconcile,
  type ReconciliationResult,
  type RegistrationRow,
  type PaymentRow,
} from "../reconcile";

export type DbRegistration = {
  id: string;
  full_name: string;
  phone_raw: string | null;
  phone_e164: string | null;
};

export type DbPayment = {
  reference: string;
  payer_name: string | null;
  payer_phone_e164: string | null;
  amount_minor: number | string;
  currency: string | null;
  paid_at: string | null;
  status: string | null;
};

export function mapRegistrations(rows: DbRegistration[]): RegistrationRow[] {
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone_e164 ?? r.phone_raw,
  }));
}

export function mapPayments(rows: DbPayment[]): PaymentRow[] {
  return rows.map((p) => ({
    reference: p.reference,
    payerName: p.payer_name,
    payerPhone: p.payer_phone_e164,
    amountMinor: Number(p.amount_minor),
    currency: p.currency ?? "GHS",
    paidAt: p.paid_at ?? "",
  }));
}

export type Fetcher = <T>(pathAndQuery: string) => Promise<T[]>;

export function supabaseRestFetcher(): Fetcher {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return async <T,>(pathAndQuery: string): Promise<T[]> => {
    const r = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Supabase ${pathAndQuery}: ${r.status} ${await r.text()}`);
    return (await r.json()) as T[];
  };
}

export type DbOptOut = { phone_e164: string | null };

/** E.164 phones that must never be messaged — the consent gate before any send. */
export async function loadOptOuts(fetcher: Fetcher = supabaseRestFetcher()): Promise<Set<string>> {
  const rows = await fetcher<DbOptOut>("opt_outs?select=phone_e164&limit=5000");
  return new Set(rows.map((r) => r.phone_e164).filter((p): p is string => Boolean(p)));
}

export async function loadReconciliation(
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<ReconciliationResult> {
  const [regs, pays] = await Promise.all([
    fetcher<DbRegistration>("registrations?select=id,full_name,phone_raw,phone_e164&limit=5000"),
    fetcher<DbPayment>(
      "payments?select=reference,payer_name,payer_phone_e164,amount_minor,currency,paid_at,status&status=eq.Successful&limit=5000",
    ),
  ]);
  return reconcile(mapRegistrations(regs), mapPayments(pays));
}
