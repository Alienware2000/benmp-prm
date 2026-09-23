import { PocShell } from "../../nav";
import { GivingReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  payment_reference: string | null;
  normalized_row: {
    sourceRowId: string;
    transactionDate: string;
    amountMinor: number;
    currency: string;
    payerName: string | null;
    payerPhoneOrAccount: string | null;
  };
  raw_row: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

type PartnerOption = { id: string; name: string; phone: string | null; church: string | null };

async function loadInitialReview(): Promise<{ rows: ReviewRow[]; partnerOptions: PartnerOption[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { rows: [], partnerOptions: [] };
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [rowsRes, ...partnerPages] = await Promise.all([
    fetch(`${url}/rest/v1/payment_import_rows?select=id,payment_reference,normalized_row,raw_row,notes,created_at&match_status=eq.needs_review&order=created_at.desc&limit=500`, { headers, cache: "no-store" }),
    // First page of partners (1000 rows); the client component fetches full list via loadPartners()
    fetch(`${url}/rest/v1/partners?select=id,full_name,momo_phone_number,whatsapp_number,church&order=full_name.asc&limit=1000&offset=0`, { headers, cache: "no-store" }),
  ]);
  const rows = rowsRes.ok ? ((await rowsRes.json()) as ReviewRow[]) : [];
  const partners = partnerPages[0].ok
    ? ((await partnerPages[0].json()) as Array<{ id: string; full_name: string; momo_phone_number: string | null; whatsapp_number: string | null; church: string | null }>).map((p) => ({
        id: p.id,
        name: p.full_name,
        phone: p.momo_phone_number ?? p.whatsapp_number,
        church: p.church,
      }))
    : [];
  return { rows, partnerOptions: partners };
}

export default async function GivingReviewPage() {
  const initial = await loadInitialReview();
  return (
    <PocShell
      title="Review uploaded giving"
      subtitle="Resolve MoMo and Ecobank statement rows that could not be safely matched during upload."
    >
      <GivingReviewClient initialRows={initial.rows} initialPartnerOptions={initial.partnerOptions} />
    </PocShell>
  );
}
