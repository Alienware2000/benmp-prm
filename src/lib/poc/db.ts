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

/** Row shape for the sent_messages audit table (supabase/poc/schema.sql). */
export type SentMessageRow = {
  partner_ref: string;
  kind: string;
  to_phone: string | null;
  body: string;
  status: string;
  reason: string | null;
  provider_message_id: string | null;
};

/**
 * Zip the planned messages with their send outcomes into audit rows.
 * sendPlanned emits exactly one outcome per planned message, in order.
 */
export function toSentMessageRows(
  messages: Array<{ partnerRef: string; kind: string; to: string | null; body: string }>,
  outcomes: Array<{ status: string; reason?: string; providerMessageId?: string }>,
): SentMessageRow[] {
  return messages.map((m, i) => ({
    partner_ref: m.partnerRef,
    kind: m.kind,
    to_phone: m.to,
    body: m.body,
    status: outcomes[i]?.status ?? "unknown",
    reason: outcomes[i]?.reason ?? null,
    provider_message_id: outcomes[i]?.providerMessageId ?? null,
  }));
}

export type Inserter = (table: string, rows: unknown[]) => Promise<void>;

export function supabaseRestInserter(): Inserter {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return async (table, rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(rows.slice(i, i + 500)),
      });
      if (!r.ok) throw new Error(`Supabase insert ${table}: ${r.status} ${await r.text()}`);
    }
  };
}

/**
 * Persist send outcomes to the sent_messages audit table. Never throws — an audit
 * failure must not turn a successful send into an error response; it is reported
 * back as false and logged for follow-up.
 */
export async function recordSentMessages(
  rows: SentMessageRow[],
  inserter?: Inserter,
): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    await (inserter ?? supabaseRestInserter())("sent_messages", rows);
    return true;
  } catch (err) {
    console.error(JSON.stringify({ evt: "poc_audit_write_failed", error: err instanceof Error ? err.message : String(err) }));
    return false;
  }
}

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
