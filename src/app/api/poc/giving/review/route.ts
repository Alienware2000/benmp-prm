import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  buildPaymentRows,
  parseJsonObject,
  type NormalizedPaymentRow,
  type PartnerForPaymentMatch,
} from "@/lib/poc/payment-upload";

export const dynamic = "force-dynamic";

type PartnerRow = {
  id: string;
  full_name: string;
  momo_phone_number: string | null;
  whatsapp_number: string | null;
  church: string | null;
  country: string | null;
};

type ReviewRow = {
  id: string;
  payment_reference: string | null;
  normalized_row: NormalizedPaymentRow;
  raw_row: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is not configured.");
  return { url, key };
}

async function rest<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase ${pathAndQuery}: ${response.status} ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

function toPartner(row: PartnerRow): PartnerForPaymentMatch {
  return {
    id: row.id,
    fullName: row.full_name,
    momoPhoneNumber: row.momo_phone_number,
    whatsappNumber: row.whatsapp_number,
    church: row.church,
    country: row.country,
  };
}

async function loadPartners(): Promise<PartnerForPaymentMatch[]> {
  const rows = await rest<PartnerRow[]>(
    "partners?select=id,full_name,momo_phone_number,whatsapp_number,church,country&order=full_name.asc&limit=50000",
  );
  return rows.map(toPartner);
}

async function createPartner(name: string): Promise<PartnerForPaymentMatch> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("New partner name is required.");
  const rows = await rest<PartnerRow[]>("partners?select=id,full_name,momo_phone_number,whatsapp_number,church,country", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ full_name: cleanName, country: "Ghana", source: "payment_import_review", status: "active" }]),
  });
  return toPartner(rows[0]);
}

async function updateReviewRow(id: string, status: string, partnerId: string | null) {
  await rest<void>(`payment_import_rows?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ match_status: status, partner_id: partnerId, resolved_at: new Date().toISOString() }),
  });
}

export async function GET() {
  try {
    const [rows, partners] = await Promise.all([
      rest<ReviewRow[]>(
        "payment_import_rows?select=id,payment_reference,normalized_row,raw_row,notes,created_at&match_status=eq.needs_review&order=created_at.desc&limit=500",
      ),
      loadPartners(),
    ]);
    return NextResponse.json({ ok: true, rows, partnerOptions: partners.map((p) => ({ id: p.id, name: p.fullName, phone: p.momoPhoneNumber ?? p.whatsappNumber, church: p.church })) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Review load failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const id = String(form.get("id") ?? "");
    const rowJson = String(form.get("row") ?? "");
    const decision = parseJsonObject(String(form.get("decision") ?? "")) as { action?: string; partnerId?: string; name?: string };
    if (!id) return NextResponse.json({ ok: false, error: "Missing review row id." }, { status: 400 });
    const row = parseJsonObject(rowJson) as unknown as NormalizedPaymentRow;
    if (decision.action === "dismiss") {
      await updateReviewRow(id, "dismissed", null);
      return NextResponse.json({ ok: true });
    }
    let partner: PartnerForPaymentMatch | null = null;
    if (decision.action === "match" && decision.partnerId) {
      const partners = await loadPartners();
      partner = partners.find((p) => p.id === decision.partnerId) ?? null;
      if (!partner) throw new Error("Selected partner was not found.");
    } else if (decision.action === "create") {
      partner = await createPartner(decision.name || row.payerName || "New Partner");
    }
    if (!partner) return NextResponse.json({ ok: false, error: "Choose match, create, or dismiss." }, { status: 400 });
    await rest<void>("payments?on_conflict=reference", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(buildPaymentRows([{ row, partner }])),
    });
    await updateReviewRow(id, "promoted", partner.id);
    revalidateTag("poc-giving", "max");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Review save failed." }, { status: 500 });
  }
}
