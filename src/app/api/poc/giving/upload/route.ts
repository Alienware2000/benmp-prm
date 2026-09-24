import { normalizePhone } from "@/lib/phone";
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { revalidateTag } from "next/cache";
import {
  buildPaymentRows,
  matchNormalizedRows,
  parseEcobankRows,
  parseJsonArray,
  parseJsonObject,
  parseMomoRows,
  parsePaystackOnetimeRows,
  parsePaystackRecurringRows,
  type NormalizedPaymentRow,
  type PartnerForPaymentMatch,
  type PaymentSource,
} from "@/lib/poc/payment-upload";

export const dynamic = "force-dynamic";

type CommitDecision =
  | { action: "match"; partnerId: string }
  | { action: "create"; name: string }
  | { action: "dismiss" };

type PartnerRow = {
  id: string;
  full_name: string;
  momo_phone_number: string | null;
  whatsapp_number: string | null;
  church: string | null;
  country: string | null;
};

type ImportRow = { id: string };

function paymentReference(row: NormalizedPaymentRow): string {
  return `${row.source}:${row.providerReference}`;
}

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
  if (!response.ok) {
    throw new Error(`Supabase ${pathAndQuery}: ${response.status} ${await response.text()}`);
  }
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

async function createPartner(name: string, phone: string | null = null): Promise<PartnerForPaymentMatch> {
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
        country: "Ghana",
        church: "Unlisted",
        denomination: "Unlisted",
        source: "payment_upload_review",
        status: "active",
      },
    ]),
  });
  return toPartner(rows[0]);
}

async function insertPayments(rows: ReturnType<typeof buildPaymentRows>): Promise<void> {
  if (rows.length === 0) return;
  await rest<void>("payments?on_conflict=reference", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function createImportBatch({
  provider,
  filename,
  rowCount,
  matchedCount,
  ambiguousCount,
}: {
  provider: string;
  filename: string;
  rowCount: number;
  matchedCount: number;
  ambiguousCount: number;
}): Promise<string> {
  const rows = await rest<ImportRow[]>("payment_imports?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        provider,
        filename,
        status: "processed",
        row_count: rowCount,
        matched_count: matchedCount,
        ambiguous_count: ambiguousCount,
      },
    ]),
  });
  return rows[0].id;
}

async function insertImportRows({
  importId,
  matches,
}: {
  importId: string;
  matches: ReturnType<typeof matchNormalizedRows>;
}): Promise<void> {
  if (matches.length === 0) return;
  const refs = matches.map((match) => paymentReference(match.row));
  const existingRefs = await existingImportPaymentReferences(refs);
  const newMatches = matches.filter((match) => !existingRefs.has(paymentReference(match.row)));
  if (newMatches.length === 0) return;
  await rest<void>("payment_import_rows", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      newMatches.map((match) => ({
        import_id: importId,
        partner_id: match.partner?.id ?? null,
        payment_reference: paymentReference(match.row),
        raw_row: match.row.rawRow,
        normalized_row: serializeRow(match.row),
        match_status: match.status === "auto" ? "promoted" : "needs_review",
        match_confidence: match.status === "auto" ? 100 : 0,
        notes: match.reason,
        resolved_at: match.status === "auto" ? new Date().toISOString() : null,
      })),
    ),
  });
}

async function existingImportPaymentReferences(refs: string[]): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const existing = new Set<string>();
  for (let index = 0; index < refs.length; index += 100) {
    const chunk = refs.slice(index, index + 100);
    const list = chunk.map((ref) => encodeURIComponent(ref)).join(",");
    const rows = await rest<Array<{ payment_reference: string | null }>>(
      `payment_import_rows?select=payment_reference&payment_reference=in.(${list})&limit=1000`,
    );
    for (const row of rows) if (row.payment_reference) existing.add(row.payment_reference);
  }
  return existing;
}

async function updateImportRowStatus(
  paymentReferences: string[],
  status: "promoted" | "dismissed" | "needs_review",
  partnerId?: string | null,
): Promise<void> {
  if (paymentReferences.length === 0) return;
  const list = paymentReferences.map((ref) => encodeURIComponent(ref)).join(",");
  await rest<void>(`payment_import_rows?payment_reference=in.(${list})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      match_status: status,
      ...(partnerId !== undefined ? { partner_id: partnerId } : {}),
      resolved_at: status === "needs_review" ? null : new Date().toISOString(),
    }),
  });
}

function parseCsv(text: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => String(value ?? "").trim(),
  });
  if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message);
  return parsed.data;
}

function parseWorkbook(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames.includes("ReportSheet")
    ? "ReportSheet"
    : workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");
  return XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });
}

async function parseUploadedRows(file: File, source: PaymentSource): Promise<ReturnType<typeof parseMomoRows>> {
  if (source === "momo") return parseMomoRows(parseCsv(await file.text()));
  if (source === "ecobank") return parseEcobankRows(parseWorkbook(Buffer.from(await file.arrayBuffer())));
  if (source === "paystack_onetime") return parsePaystackOnetimeRows(parseCsv(await file.text()));
  if (source === "paystack_recurring") return parsePaystackRecurringRows(parseCsv(await file.text()));
  throw new Error(`Unknown source: ${source}`);
}

function serializeRow(row: NormalizedPaymentRow) {
  return {
    source: row.source,
    sourceRowId: row.sourceRowId,
    transactionDate: row.transactionDate,
    amountMinor: row.amountMinor,
    currency: row.currency,
    payerName: row.payerName,
    payerPhoneOrAccount: row.payerPhoneOrAccount,
    providerReference: row.providerReference,
    rawRow: row.rawRow,
  };
}

function isNormalizedPaymentRow(value: unknown): value is NormalizedPaymentRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    "sourceRowId" in value &&
    "transactionDate" in value &&
    "amountMinor" in value &&
    "currency" in value &&
    "providerReference" in value &&
    "rawRow" in value
  );
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const action = String(form.get("action") ?? "preview");
    if (action === "commitDeferred") {
      const rowsJson = String(form.get("rows") ?? "[]");
      const decisions = parseJsonObject(String(form.get("decisions") ?? "")) as Record<string, CommitDecision>;
      const rows = parseJsonArray(rowsJson).filter(isNormalizedPaymentRow);
      const partners = await loadPartners();
      const partnersById = new Map(partners.map((partner) => [partner.id, partner]));
      const accepted: Array<{ row: NormalizedPaymentRow; partner: PartnerForPaymentMatch | null }> = [];
      let dismissed = 0;
      let created = 0;
      let manualMatched = 0;
      let deferred = 0;

      for (const row of rows) {
        const decision = decisions[row.sourceRowId];
        if (!decision) {
          deferred += 1;
          continue;
        }
        if (decision.action === "dismiss") {
          dismissed += 1;
          continue;
        }
        if (decision.action === "match") {
          const partner = partnersById.get(decision.partnerId);
          if (!partner) throw new Error("Selected partner was not found.");
          accepted.push({ row, partner });
          manualMatched += 1;
        } else if (decision.action === "create") {
          const partner = await createPartner(decision.name || row.payerName || "New Partner", row.payerPhoneOrAccount);
          accepted.push({ row, partner });
          created += 1;
        }
      }

      await insertPayments(buildPaymentRows(accepted));
      await updateImportRowStatus(
        accepted.map(({ row }) => paymentReference(row)),
        "promoted",
      );
      await updateImportRowStatus(
        rows
          .filter((row) => decisions[row.sourceRowId]?.action === "dismiss")
          .map(paymentReference),
        "dismissed",
      );
      revalidateTag("poc-giving", "max");
      return NextResponse.json({
        ok: true,
        counts: {
          insertedOrAlreadyPresent: accepted.length,
          autoMatched: 0,
          manualMatched,
          created,
          dismissed,
          deferred,
          rejected: 0,
          skipped: 0,
        },
      });
    }

    const source = String(form.get("source") ?? "") as PaymentSource;
    const file = form.get("file");
    if (source !== "momo" && source !== "ecobank" && source !== "paystack_onetime" && source !== "paystack_recurring") {
      return NextResponse.json({ ok: false, error: "Choose a statement type." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Upload a statement file." }, { status: 400 });
    }

    const [parsed, partners] = await Promise.all([parseUploadedRows(file, source), loadPartners()]);
    const matches = matchNormalizedRows(parsed.rows, partners);

    if (action === "import") {
      const accepted = matches
        .filter((match) => match.status === "auto")
        .map((match) => ({ row: match.row, partner: match.partner }));
      const reviewMatches = matches.filter((match) => match.status === "review");
      const importId = await createImportBatch({
        provider: source,
        filename: file.name || `${source}-upload`,
        rowCount: parsed.rows.length,
        matchedCount: accepted.length,
        ambiguousCount: reviewMatches.length,
      });
      await insertImportRows({ importId, matches });
      await insertPayments(buildPaymentRows(accepted));
      revalidateTag("poc-giving", "max");
      return NextResponse.json({
        ok: true,
        counts: {
          insertedOrAlreadyPresent: accepted.length,
          autoMatched: accepted.length,
          manualMatched: 0,
          created: 0,
          dismissed: 0,
          deferred: reviewMatches.length,
          rejected: parsed.rejects.length,
          skipped: parsed.skipped.length,
        },
        rows: reviewMatches.map((match) => ({
          row: serializeRow(match.row),
          status: match.status,
          reason: match.reason,
          partner: match.partner,
          candidates: match.candidates,
        })),
        partnerOptions: partners.map((partner) => ({
          id: partner.id,
          name: partner.fullName,
          phone: partner.momoPhoneNumber ?? partner.whatsappNumber,
          church: partner.church,
        })),
      });
    }

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        counts: {
          rows: parsed.rows.length,
          auto: matches.filter((m) => m.status === "auto").length,
          review: matches.filter((m) => m.status === "review").length,
          rejected: parsed.rejects.length,
          skipped: parsed.skipped.length,
        },
        rows: matches.map((match) => ({
          row: serializeRow(match.row),
          status: match.status,
          reason: match.reason,
          partner: match.partner,
          candidates: match.candidates,
        })),
        partnerOptions: partners.map((partner) => ({
          id: partner.id,
          name: partner.fullName,
          phone: partner.momoPhoneNumber ?? partner.whatsappNumber,
          church: partner.church,
        })),
        rejects: parsed.rejects.map((reject) => ({ index: reject.index, reason: reject.reason })),
        skipped: parsed.skipped.length,
      });
    }

    if (action !== "commit") {
      return NextResponse.json({ ok: false, error: "Unknown upload action." }, { status: 400 });
    }

    const decisions = parseJsonObject(String(form.get("decisions") ?? "")) as Record<string, CommitDecision>;
    const partnersById = new Map(partners.map((partner) => [partner.id, partner]));
    const accepted: Array<{ row: NormalizedPaymentRow; partner: PartnerForPaymentMatch | null }> = [];
    let dismissed = 0;
    let deferred = 0;
    let created = 0;
    let manualMatched = 0;
    let autoMatched = 0;

    for (const match of matches) {
      if (match.status === "auto") {
        accepted.push({ row: match.row, partner: match.partner });
        autoMatched += 1;
        continue;
      }
      const decision = decisions[match.row.sourceRowId];
      if (!decision) {
        deferred += 1;
        continue;
      }
      if (decision.action === "dismiss") {
        dismissed += 1;
        continue;
      }
      if (decision.action === "match") {
        const partner = partnersById.get(decision.partnerId);
        if (!partner) throw new Error("Selected partner was not found.");
        accepted.push({ row: match.row, partner });
        manualMatched += 1;
      } else if (decision.action === "create") {
        const partner = await createPartner(decision.name || match.row.payerName || "New Partner", match.row.payerPhoneOrAccount);
        accepted.push({ row: match.row, partner });
        created += 1;
      }
    }

    await insertPayments(buildPaymentRows(accepted));
    revalidateTag("poc-giving", "max");

    return NextResponse.json({
      ok: true,
      counts: {
        insertedOrAlreadyPresent: accepted.length,
        autoMatched,
        manualMatched,
        created,
        dismissed,
        deferred,
        rejected: parsed.rejects.length,
        skipped: parsed.skipped.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
