import { normalizePhone } from "@/lib/phone";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  buildPaymentRows,
  ghanaLastNineKey,
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
  const allRows: PartnerRow[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const rows = await rest<PartnerRow[]>(
      `partners?select=id,full_name,momo_phone_number,whatsapp_number,church,country&order=full_name.asc&limit=${pageSize}&offset=${offset}`,
    );
    if (!rows || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return allRows.map(toPartner);
}

async function createPartner(name: string): Promise<PartnerForPaymentMatch> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("New partner name is required.");
  const rows = await rest<PartnerRow[]>("partners?select=id,full_name,momo_phone_number,whatsapp_number,church,country", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ full_name: cleanName, country: "Ghana", church: "Unlisted", denomination: "Unlisted", source: "payment_import_review", status: "active" }]),
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
    const contentType = req.headers.get("content-type") ?? "";

    // Accept-all: JSON payload with { action: "accept_all" }
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { action?: string };
      if (body.action === "accept_all") {
        return await handleAcceptAll();
      }
      return NextResponse.json({ ok: false, error: "Unknown JSON action." }, { status: 400 });
    }

    // Single-row: FormData
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

/**
 * Accept all: create a partner for each unmatched row (using payer name + phone
 * for deduplication), promote every row into payments, and mark them resolved.
 * Rows whose payer name matches an existing partner (by exact name or last-9 phone)
 * are linked to that partner instead of creating a duplicate.
 */
async function handleAcceptAll(): Promise<NextResponse> {
  const [reviewRows, existingPartners] = await Promise.all([
    rest<ReviewRow[]>(
      "payment_import_rows?select=id,payment_reference,normalized_row,raw_row,notes,created_at&match_status=eq.needs_review&order=created_at.desc&limit=5000",
    ),
    loadPartners(),
  ]);

  if (reviewRows.length === 0) {
    return NextResponse.json({ ok: true, created: 0, promoted: 0 });
  }

  // Build lookup maps from existing partners
  const partnerByLast9 = new Map<string, PartnerForPaymentMatch>();
  const partnerByName = new Map<string, PartnerForPaymentMatch>();
  for (const p of existingPartners) {
    for (const phone of [p.momoPhoneNumber, p.whatsappNumber]) {
      const normalized = normalizePhone(phone);
      if (normalized) {
        const last9 = ghanaLastNineKey(normalized);
        if (last9 && !partnerByLast9.has(last9)) partnerByLast9.set(last9, p);
      }
    }
    const nameKey = p.fullName.trim().toLowerCase();
    if (nameKey && !partnerByName.has(nameKey)) partnerByName.set(nameKey, p);
  }

  // Deduplicate new partners by name (lowercased) to avoid creating duplicates
  const newPartnersByName = new Map<string, PartnerForPaymentMatch>();
  const payments: Array<{ row: NormalizedPaymentRow; partner: PartnerForPaymentMatch }> = [];
  const promotedIds: string[] = [];

  for (const reviewRow of reviewRows) {
    const row = reviewRow.normalized_row;
    const payerName = (row.payerName ?? "").trim() || "Unknown Giver";

    // Try to match existing partner by phone or name
    let partner: PartnerForPaymentMatch | undefined;
    const phone = normalizePhone(row.payerPhoneOrAccount);
    if (phone) {
      const last9 = ghanaLastNineKey(phone);
      if (last9) partner = partnerByLast9.get(last9);
    }
    if (!partner) {
      const nameKey = payerName.toLowerCase();
      partner = partnerByName.get(nameKey);
    }

    // If no existing match, create or reuse a new partner for this name
    if (!partner) {
      partner = newPartnersByName.get(payerName.toLowerCase());
      if (!partner) {
        partner = await createPartner(payerName);
        // Add to lookups so later rows with same name or phone find this partner
        partnerByName.set(payerName.toLowerCase(), partner);
        newPartnersByName.set(payerName.toLowerCase(), partner);
        if (partner.momoPhoneNumber || partner.whatsappNumber) {
          for (const phone of [partner.momoPhoneNumber, partner.whatsappNumber]) {
            const normalized = normalizePhone(phone);
            if (normalized) {
              const last9 = ghanaLastNineKey(normalized);
              if (last9 && !partnerByLast9.has(last9)) partnerByLast9.set(last9, partner);
            }
          }
        }
      }
    }

    payments.push({ row, partner });
    promotedIds.push(reviewRow.id);
  }

  // Insert all payments (ignore duplicates)
  if (payments.length > 0) {
    await rest<void>("payments?on_conflict=reference", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(buildPaymentRows(payments)),
    });
  }

  // Mark all review rows as promoted
  for (let i = 0; i < promotedIds.length; i += 100) {
    const chunk = promotedIds.slice(i, i + 100);
    const list = chunk.map((id) => encodeURIComponent(id)).join(",");
    await rest<void>(`payment_import_rows?id=in.(${list})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ match_status: "promoted", resolved_at: new Date().toISOString() }),
    });
  }

  revalidateTag("poc-giving", "max");
  return NextResponse.json({
    ok: true,
    promoted: promotedIds.length,
    created: newPartnersByName.size,
  });
}
