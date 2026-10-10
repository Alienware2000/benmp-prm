import { normalizePhone } from "@/lib/phone";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  assertPaymentRowsExist,
  buildPaymentRows,
  parseJsonObject,
  type NormalizedPaymentRow,
  type PartnerForPaymentMatch,
} from "@/lib/poc/payment-upload";
import { planAcceptAll } from "@/lib/poc/accept-all";
import { inListChunks } from "@/lib/poc/in-list";

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

function countryForPaymentSource(source: NormalizedPaymentRow["source"]): string {
  return source === "momo" || source === "ecobank" ? "Ghana" : "Unknown";
}

async function createPartner(
  name: string,
  phone: string | null = null,
  country = "Unknown",
): Promise<PartnerForPaymentMatch> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("New partner name is required.");
  const normalizedPhone = normalizePhone(phone);
  const rows = await rest<PartnerRow[]>("partners?select=id,full_name,momo_phone_number,whatsapp_number,church,country", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        full_name: cleanName,
        momo_phone_number: normalizedPhone,
        country,
        church: "Unlisted",
        denomination: "Unlisted",
        source: "payment_import_review",
        status: "active",
      },
    ]),
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
      partner = await createPartner(
        decision.name || row.payerName || "New Partner",
        row.payerPhoneOrAccount,
        countryForPaymentSource(row.source),
      );
    }
    if (!partner) return NextResponse.json({ ok: false, error: "Choose match, create, or dismiss." }, { status: 400 });
    const paymentRows = buildPaymentRows([{ row, partner }]);
    await rest<void>("payments?on_conflict=reference", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(paymentRows),
    });
    await updateReviewRow(id, "promoted", partner.id);
    revalidateTag("poc-giving", "max");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Review save failed." }, { status: 500 });
  }
}

/**
 * Accept all: admit every waiting row into the ledger. Each row is linked to an
 * existing partner or to a new Unlisted partner per `planAcceptAll` (phone is the
 * identity when present — Decision 0028), then promoted and marked resolved with
 * its partner.
 */
async function handleAcceptAll(): Promise<NextResponse> {
  const [reviewRows, existingPartners] = await Promise.all([
    rest<ReviewRow[]>(
      "payment_import_rows?select=id,payment_reference,normalized_row,raw_row,notes,created_at&match_status=eq.needs_review&order=created_at.asc&limit=5000",
    ),
    loadPartners(),
  ]);

  if (reviewRows.length === 0) {
    return NextResponse.json({ ok: true, created: 0, linked: 0, promoted: 0 });
  }

  const plan = planAcceptAll(
    reviewRows.map((reviewRow) => ({ id: reviewRow.id, row: reviewRow.normalized_row })),
    existingPartners,
  );
  const partnersById = new Map(existingPartners.map((partner) => [partner.id, partner]));
  const created = new Map<string, PartnerForPaymentMatch>();
  for (const spec of plan.newPartners) {
    created.set(spec.key, await createPartner(spec.name, spec.phone, spec.country));
  }

  const resolved = plan.assignments.map((assignment) => {
    const partner =
      "partnerId" in assignment
        ? partnersById.get(assignment.partnerId)
        : created.get(assignment.newPartnerKey);
    if (!partner) throw new Error("Accept-all partner was not resolved.");
    return { reviewRowId: assignment.reviewRowId, row: assignment.row, partner };
  });

  const paymentRows = buildPaymentRows(resolved);
  await rest<void>("payments?on_conflict=reference", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(paymentRows),
  });
  await assertPaymentRowsExist(paymentRows, (path) => rest<Array<{ reference: string }>>(path));

  // Mark rows promoted with the partner each was resolved to.
  const idsByPartner = new Map<string, string[]>();
  for (const { reviewRowId, partner } of resolved) {
    idsByPartner.set(partner.id, [...(idsByPartner.get(partner.id) ?? []), reviewRowId]);
  }
  const resolvedAt = new Date().toISOString();
  for (const [partnerId, ids] of idsByPartner) {
    for (const list of inListChunks(ids)) {
      await rest<void>(`payment_import_rows?id=in.(${list})`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ match_status: "promoted", partner_id: partnerId, resolved_at: resolvedAt }),
      });
    }
  }

  console.info(
    JSON.stringify({
      event: "review_accept_all",
      promoted: resolved.length,
      created: created.size,
      linked: plan.assignments.filter((a) => "partnerId" in a).length,
    }),
  );
  revalidateTag("poc-giving", "max");
  return NextResponse.json({
    ok: true,
    promoted: resolved.length,
    created: created.size,
    linked: plan.assignments.filter((a) => "partnerId" in a).length,
  });
}
