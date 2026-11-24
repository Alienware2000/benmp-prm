// src/lib/cash/db.ts
import { normalizePhone } from "../phone";
import { inListChunks } from "../poc/in-list";
import { pageAll } from "../poc/paging";
import type { MemberMark } from "./validation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(): Record<string, string> {
  if (!SUPABASE_URL || !KEY) {
    throw new Error("Supabase is not configured (URL / service role key missing)");
  }
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// --- Cascading dropdown data ---

export type RegionOption = {
  id: string;
  code: string;
  name: string;
  hub_identifier: string;
  /** The Ghana regions (Decision 0026); only they report cash on the form (Decision 0039). */
  momo_required: boolean;
};

export async function listAllRegions(): Promise<RegionOption[]> {
  return rest<RegionOption[]>(
    "regions?select=id,code,name,hub_identifier,momo_required&order=sort_order.asc",
  );
}

export type HubOption = { id: string; label: string };

export async function listHubsInRegion(regionCode: string): Promise<HubOption[]> {
  const rows = await rest<
    { id: string; hub_number: number | null; name: string; regions: { code: string } | null }[]
  >(
    "hubs?select=id,hub_number,name,regions!inner(code)" +
      `&regions.code=eq.${encodeURIComponent(regionCode)}` +
      "&order=hub_number.asc.nullslast,name.asc",
  );
  return rows.map((h) => ({
    id: h.id,
    label: h.hub_number ? `Hub ${h.hub_number} - ${h.name}` : h.name,
  }));
}

export type ChurchOption = { id: string; name: string };

export async function listChurchesInHub(hubId: string): Promise<ChurchOption[]> {
  return rest<ChurchOption[]>(
    `hub_churches?hub_id=eq.${encodeURIComponent(hubId)}&select=id,name&order=name.asc`,
  );
}

// --- The church's members, for marking on the form (Decision 0047) ---

export type ChurchMember = { id: string; name: string };

/**
 * The church's members by name, alphabetically, leaving out anyone removed on an
 * earlier form. Names only: the form is public, so no phone numbers.
 */
export async function listChurchMembers(churchId: string): Promise<ChurchMember[]> {
  const church = encodeURIComponent(churchId);
  const rows = await pageAll((offset, limit) =>
    rest<{ id: string; full_name: string }[]>(
      `partners?church_id=eq.${church}&removed_at=is.null&select=id,full_name` +
        `&order=full_name.asc,id.asc&limit=${limit}&offset=${offset}`,
    ),
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name.trim() }));
}

/** Keep the form's mark for each member. */
export async function insertMemberMarks(
  submissionId: string,
  marks: Map<string, MemberMark>,
): Promise<void> {
  const rows = [...marks].map(([partner_id, status]) => ({
    submission_id: submissionId,
    partner_id,
    status,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await rest<void>("cash_submission_members", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
}

/**
 * Take members marked "remove" off the church's list. Nobody is deleted: the
 * partner is stamped with when and by which form, and the hub can restore them.
 */
export async function removeMembers(
  partnerIds: string[],
  submissionId: string,
): Promise<void> {
  const body = JSON.stringify({
    removed_at: new Date().toISOString(),
    removed_via_submission: submissionId,
  });
  for (const list of inListChunks(partnerIds)) {
    await rest<void>(`partners?id=in.(${list})&removed_at=is.null`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body,
    });
  }
}

/** Undo `removeMembers` for one form, e.g. when a later step of the submission fails. */
export async function restoreRemovedBy(submissionId: string): Promise<void> {
  await rest<void>(
    `partners?removed_via_submission=eq.${encodeURIComponent(submissionId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ removed_at: null, removed_via_submission: null }),
    },
  );
}

// --- Chain integrity validation ---

export async function validateChain(
  regionCode: string,
  hubId: string,
  churchId: string,
): Promise<boolean> {
  const [hub, church] = await Promise.all([
    rest<{ id: string; region_id: string; regions: { code: string } | null }[]>(
      `hubs?select=id,region_id,regions(code)&id=eq.${encodeURIComponent(hubId)}&limit=1`,
    ),
    rest<{ id: string; hub_id: string }[]>(
      `hub_churches?select=id,hub_id&id=eq.${encodeURIComponent(churchId)}&limit=1`,
    ),
  ]);
  if (!hub[0] || !hub[0].regions || hub[0].regions.code !== regionCode) return false;
  if (!church[0] || church[0].hub_id !== hubId) return false;
  return true;
}

// --- Submission insert ---

export type SubmissionInsert = {
  region_id: string;
  hub_id: string;
  church_id: string;
  reporting_month: string;
  total_registered: number;
  active_partners: number;
  new_registrations: number;
  lapsed: number;
  total_cash_minor: number;
  /** The month's giving as a US-dollar equivalent, in cents (Decision 0047). */
  given_usd_cents: number;
  deposits_total_minor: number;
  currency: string;
  givers_file_path: string | null;
  givers_file_name: string | null;
};

export async function insertSubmission(submission: SubmissionInsert): Promise<string> {
  const rows = await rest<{ id: string }[]>(
    "cash_submissions?select=id",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(submission),
    },
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !row.id) throw new Error("Submission insert returned no id.");
  return row.id;
}

/** Remove a submission (its givers and deposits cascade), e.g. when a later step fails. */
export async function deleteSubmission(submissionId: string): Promise<void> {
  await rest<void>(`cash_submissions?id=eq.${encodeURIComponent(submissionId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function submissionExistsForMonth(
  churchId: string,
  reportingMonth: string,
): Promise<boolean> {
  const rows = await rest<{ id: string }[]>(
    `cash_submissions?select=id&church_id=eq.${encodeURIComponent(churchId)}&reporting_month=eq.${encodeURIComponent(reportingMonth)}&limit=1`,
  );
  return rows.length > 0;
}

// --- Promotion ---

export type CashSubmissionRow = {
  id: string;
  region_id: string;
  hub_id: string;
  church_id: string;
  submitted_at: string;
  status: string;
};

export type CashGiverRow = {
  id: string;
  submission_id: string;
  giver_name: string | null;
  giver_phone: string | null;
  amount_minor: number;
  transaction_ref: string | null;
};

export async function getSubmissionForPromote(
  submissionId: string,
): Promise<{ submission: CashSubmissionRow; givers: CashGiverRow[] } | null> {
  const [subs, givers] = await Promise.all([
    rest<CashSubmissionRow[]>(
      `cash_submissions?select=id,region_id,hub_id,church_id,submitted_at,status&id=eq.${encodeURIComponent(submissionId)}&limit=1`,
    ),
    rest<CashGiverRow[]>(
      `cash_submission_givers?select=id,submission_id,giver_name,giver_phone,amount_minor,transaction_ref&submission_id=eq.${encodeURIComponent(submissionId)}&order=row_index.asc`,
    ),
  ]);
  if (!subs[0]) return null;
  return { submission: subs[0], givers };
}

export type CashPaymentRow = {
  reference: string;
  paid_at: string;
  status: "Successful";
  payer_name: string | null;
  payer_phone_e164: string | null;
  amount_minor: number;
  currency: string;
  payment_method: string;
  raw_row: Record<string, unknown>;
};

export function buildCashPaymentRows(
  submission: CashSubmissionRow,
  givers: CashGiverRow[],
): CashPaymentRow[] {
  return givers.map((g) => ({
    reference: `cash_submission:${submission.id}:${g.id}`,
    paid_at: submission.submitted_at,
    status: "Successful" as const,
    payer_name: g.giver_name,
    payer_phone_e164: normalizePhone(g.giver_phone, null),
    amount_minor: g.amount_minor,
    currency: "GHS",
    payment_method: "cash",
    raw_row: {
      source: "cash_submission",
      submission_id: submission.id,
      church_id: submission.church_id,
      hub_id: submission.hub_id,
      region_id: submission.region_id,
      transaction_ref: g.transaction_ref,
      _payment_method: "cash",
    },
  }));
}

export async function insertCashPayments(rows: CashPaymentRow[]): Promise<void> {
  if (rows.length === 0) return;
  await rest<void>("payments?on_conflict=reference", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  const references = rows.map((r) => r.reference);
  const encoded = references.map((r) => encodeURIComponent(r)).join(",");
  const existing = await rest<{ reference: string }[]>(
    `payments?select=reference&reference=in.(${encoded})&limit=${references.length}`,
  );
  const present = new Set(existing.map((r) => r.reference));
  const missing = references.filter((r) => !present.has(r));
  if (missing.length > 0) {
    throw new Error(`Cash payment insert incomplete; missing ${missing.length} reference(s).`);
  }
}

export async function markSubmissionPromoted(submissionId: string): Promise<void> {
  await rest<void>(
    `cash_submissions?id=eq.${encodeURIComponent(submissionId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "promoted",
        promoted_at: new Date().toISOString(),
      }),
    },
  );
}