// src/lib/poc/statement-import.ts
// The statement import pipeline, shared by POST /api/poc/giving/upload and
// scripts/ingest-statements.ts so a backend run is exactly what the upload screen
// does: parse → match → vault the original → batch + rows → safe payments → stamp
// the file hash. Server-only (service-role key).
import { normalizePhone } from "../phone";
import {
  computeFileHash,
  findDuplicateBatch,
  type ExistingBatch,
} from "./import-dedup";
import { inListChunks } from "./in-list";
import {
  assertPaymentRowsExist,
  buildPaymentRows,
  matchNormalizedRows,
  type NormalizedPaymentRow,
  type PartnerForPaymentMatch,
  type PaymentMatchResult,
  type PaymentParseResult,
  type PaymentSource,
  type PocPaymentInsertRow,
} from "./payment-upload";
import {
  contentTypeFor,
  statementMonth,
  vaultObjectPath,
} from "./statement-file";
import { parseStatementFile } from "./statement-parse";
import { saveStatementFile } from "./statement-vault";

type PartnerRow = {
  id: string;
  full_name: string;
  momo_phone_number: string | null;
  whatsapp_number: string | null;
  church: string | null;
  country: string | null;
};

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is not configured.");
  return { url, key };
}

export async function rest<T>(
  pathAndQuery: string,
  init?: RequestInit,
): Promise<T> {
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
    throw new Error(
      `Supabase ${pathAndQuery}: ${response.status} ${await response.text()}`,
    );
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

export function paymentReference(row: NormalizedPaymentRow): string {
  return `${row.source}:${row.providerReference}`;
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

export async function loadPartners(): Promise<PartnerForPaymentMatch[]> {
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

export async function createPartner(
  name: string,
  phone: string | null = null,
  country = "Unknown",
): Promise<PartnerForPaymentMatch> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("New partner name is required.");
  const normalizedPhone = normalizePhone(phone);
  const rows = await rest<PartnerRow[]>(
    "partners?select=id,full_name,momo_phone_number,whatsapp_number,church,country",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          full_name: cleanName,
          momo_phone_number: normalizedPhone,
          country,
          church: "Unlisted",
          denomination: "Unlisted",
          source: "payment_upload_review",
          status: "active",
        },
      ]),
    },
  );
  return toPartner(rows[0]);
}

export async function insertPayments(
  rows: PocPaymentInsertRow[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    await rest<void>("payments?on_conflict=reference", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
  await assertPaymentRowsExist(rows, (path) =>
    rest<Array<{ reference: string }>>(path),
  );
}

async function createImportBatch(batch: {
  provider: string;
  filename: string;
  rowCount: number;
  matchedCount: number;
  ambiguousCount: number;
  storagePath: string;
  fileSizeBytes: number;
  contentType: string;
}): Promise<string> {
  // The file_hash is NOT set here — it is stamped after rows and payments
  // succeed, so a failed import can be retried without hitting the unique
  // (provider, file_hash) constraint on an incomplete batch.
  const rows = await rest<Array<{ id: string }>>("payment_imports?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        provider: batch.provider,
        filename: batch.filename,
        status: "processed",
        row_count: batch.rowCount,
        matched_count: batch.matchedCount,
        ambiguous_count: batch.ambiguousCount,
        storage_path: batch.storagePath,
        file_size_bytes: batch.fileSizeBytes,
        content_type: batch.contentType,
      },
    ]),
  });
  return rows[0].id;
}

async function stampFileHash(
  importId: string,
  fileHash: string,
): Promise<void> {
  await rest<void>(`payment_imports?id=eq.${encodeURIComponent(importId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ file_hash: fileHash }),
  });
}

async function existingImportPaymentReferences(
  refs: string[],
): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const existing = new Set<string>();
  for (const list of inListChunks(refs, { maxValues: 100 })) {
    const rows = await rest<Array<{ payment_reference: string | null }>>(
      `payment_import_rows?select=payment_reference&payment_reference=in.(${list})&limit=1000`,
    );
    for (const row of rows)
      if (row.payment_reference) existing.add(row.payment_reference);
  }
  return existing;
}

async function insertImportRows(
  importId: string,
  matches: PaymentMatchResult[],
): Promise<void> {
  if (matches.length === 0) return;
  const existingRefs = await existingImportPaymentReferences(
    matches.map((match) => paymentReference(match.row)),
  );
  const newMatches = matches.filter(
    (match) => !existingRefs.has(paymentReference(match.row)),
  );
  for (let i = 0; i < newMatches.length; i += 500) {
    await rest<void>("payment_import_rows", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        newMatches.slice(i, i + 500).map((match) => ({
          import_id: importId,
          partner_id: match.partner?.id ?? null,
          payment_reference: paymentReference(match.row),
          raw_row: match.row.rawRow,
          normalized_row: serializeRow(match.row),
          match_status: match.status === "auto" ? "promoted" : "needs_review",
          match_confidence: match.status === "auto" ? 100 : 0,
          notes: match.reason,
          resolved_at:
            match.status === "auto" ? new Date().toISOString() : null,
        })),
      ),
    });
  }
}

export async function updateImportRowStatus(
  paymentReferences: string[],
  status: "promoted" | "dismissed" | "needs_review",
  partnerId?: string | null,
): Promise<void> {
  const body = JSON.stringify({
    match_status: status,
    ...(partnerId !== undefined ? { partner_id: partnerId } : {}),
    resolved_at: status === "needs_review" ? null : new Date().toISOString(),
  });
  for (const list of inListChunks(paymentReferences)) {
    await rest<void>(`payment_import_rows?payment_reference=in.(${list})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body,
    });
  }
}

export function serializeRow(row: NormalizedPaymentRow) {
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

export type PreparedStatement = {
  source: PaymentSource;
  filename: string;
  fileHash: string;
  parsed: PaymentParseResult;
  partners: PartnerForPaymentMatch[];
  matches: PaymentMatchResult[];
};

/** Parse and match without writing anything. */
export async function prepareStatement(
  source: PaymentSource,
  filename: string,
  buffer: ArrayBuffer,
  partners?: PartnerForPaymentMatch[],
): Promise<PreparedStatement> {
  const parsed = await parseStatementFile(source, filename, buffer);
  const allPartners = partners ?? (await loadPartners());
  return {
    source,
    filename,
    fileHash: computeFileHash(buffer),
    parsed,
    partners: allPartners,
    matches: matchNormalizedRows(parsed.rows, allPartners),
  };
}

export type ImportOutcome =
  | { ok: false; duplicate: ExistingBatch }
  | {
      ok: true;
      importId: string;
      storagePath: string;
      autoMatched: number;
      review: PaymentMatchResult[];
    };

/**
 * Write a prepared statement: refuse a file already imported for this source,
 * vault the original before any ledger write (if storage fails, nothing is
 * imported), record the batch and every row, insert the safe matches into
 * `payments`, then stamp the file hash. Each row is logged as `statement_row`.
 */
export async function importPreparedStatement(
  prepared: PreparedStatement,
  buffer: ArrayBuffer,
  contentType?: string,
): Promise<ImportOutcome> {
  const { source, filename, fileHash, parsed, matches } = prepared;
  const duplicate = await findDuplicateBatch(source, fileHash, rest);
  if (duplicate) return { ok: false, duplicate };

  const accepted = matches.filter((match) => match.status === "auto");
  const review = matches.filter((match) => match.status === "review");
  const storagePath = vaultObjectPath({
    source,
    month: statementMonth(parsed.rows),
    fileHash,
    filename,
  });
  const type = contentType || contentTypeFor(filename);
  await saveStatementFile(storagePath, buffer, type);
  console.info(
    JSON.stringify({
      event: "statement_vaulted",
      source,
      filename,
      storagePath,
      bytes: buffer.byteLength,
    }),
  );

  const importId = await createImportBatch({
    provider: source,
    filename,
    rowCount: parsed.rows.length,
    matchedCount: accepted.length,
    ambiguousCount: review.length,
    storagePath,
    fileSizeBytes: buffer.byteLength,
    contentType: type,
  });
  await insertImportRows(importId, matches);
  await insertPayments(
    buildPaymentRows(
      accepted.map((match) => ({ row: match.row, partner: match.partner })),
    ),
  );
  await stampFileHash(importId, fileHash);

  for (const match of matches) {
    console.info(
      JSON.stringify({
        event: "statement_row",
        source,
        importId,
        reference: paymentReference(match.row),
        amountMinor: match.row.amountMinor,
        match: match.status,
        reason: match.reason,
        partnerId: match.partner?.id ?? null,
        status: match.status === "auto" ? "promoted" : "needs_review",
      }),
    );
  }
  return {
    ok: true,
    importId,
    storagePath,
    autoMatched: accepted.length,
    review,
  };
}
