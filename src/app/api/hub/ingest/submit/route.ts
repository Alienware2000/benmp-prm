import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import {
  validateCandidates,
  INGEST_LIMITS,
  type CandidateRow,
  type RowIssue,
} from "@/lib/hub/ingest";
import {
  createIngestBatch,
  findExistingPhones,
  getHubChurches,
  insertIngestRows,
  insertPartners,
  updatePartners,
  markBatchSubmitted,
  type IngestRowInsert,
} from "@/lib/hub/db";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

type SubmitRow = {
  rowIndex: number;
  raw: string[];
  name: string;
  momoPhone: string;
  whatsappPhone: string;
  church: string;
  removed: boolean;
};

/**
 * Final step of the wizard (HP-3). The client's grid state is never trusted:
 * every accepted row is re-validated here against the hub's church list and
 * the live partner table, and one flagged row refuses the whole submission
 * (400 with per-row issues the preview can display). Clean submissions write,
 * in order: the batch (draft) -> every row incl. removed ones (audit trail,
 * Decision 0018 item 6) -> the partners (atomic bulk inserts) -> batch marked
 * submitted. A retry after a partial failure is caught by the duplicate-phone
 * rule rather than duplicating partners.
 */
export async function POST(req: NextRequest) {
  const session = await verifyHubSessionToken(
    req.cookies.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    fileName?: unknown;
    sheetName?: unknown;
    columnMap?: unknown;
    rows?: unknown;
  } | null;

  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const sheetName = typeof body?.sheetName === "string" ? body.sheetName : "";
  const rowsIn = Array.isArray(body?.rows) ? (body.rows as SubmitRow[]) : null;
  if (!fileName || !sheetName || !rowsIn || rowsIn.length === 0) {
    return NextResponse.json(
      { ok: false, error: "The submission is incomplete. Re-run the upload." },
      { status: 400 },
    );
  }
  if (rowsIn.length > INGEST_LIMITS.maxRowsPerSheet) {
    return NextResponse.json(
      { ok: false, error: "Too many rows in one upload." },
      { status: 400 },
    );
  }

  const rows: SubmitRow[] = rowsIn.map((r) => ({
    rowIndex: Number(r.rowIndex) || 0,
    raw: Array.isArray(r.raw) ? r.raw.map((c) => String(c ?? "")) : [],
    name: String(r.name ?? "").trim(),
    momoPhone: String(r.momoPhone ?? "").trim(),
    whatsappPhone: String(r.whatsappPhone ?? "").trim(),
    church: String(r.church ?? "").trim(),
    removed: r.removed === true,
  }));
  const accepted = rows.filter((r) => !r.removed);
  if (accepted.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Every row was removed — there is nothing to save." },
      { status: 400 },
    );
  }

  // Server-side re-validation of exactly what the preview validated.
  const churches = (await getHubChurches(session.hubId)).map((c) => ({
    id: c.id,
    name: c.name,
    nameKey: c.name_key,
  }));
  const candidates: CandidateRow[] = accepted.map((r) => ({
    rowIndex: r.rowIndex,
    raw: r.raw,
    name: r.name,
    momoPhone: r.momoPhone,
    whatsappPhone: r.whatsappPhone,
    church: r.church,
  }));
  // The lookup key is E.164, produced by the same normalization the validator
  // itself applies; unparseable phones are flagged by validation, not looked up.
  const phonesToCheck = candidates
    .flatMap((c) => [
      normalizePhone(c.momoPhone, "GH"),
      normalizePhone(c.whatsappPhone),
    ])
    .filter((p): p is string => p !== null);
  const existingPhones = await findExistingPhones(phonesToCheck);
  const validated = validateCandidates(candidates, {
    churches,
    existingPhones,
    hubId: session.hubId,
  });

  const flagged = validated.filter((v) => v.issues.length > 0);
  if (flagged.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          flagged.length === 1
            ? "1 row still needs attention."
            : `${flagged.length} rows still need attention.`,
        rows: flagged.map((v) => ({ rowIndex: v.rowIndex, issues: v.issues })),
      },
      { status: 400 },
    );
  }

  // All clean — write the audit trail, then the partners.
  const batchId = await createIngestBatch({
    hubId: session.hubId,
    fileName,
    sheetName,
    columnMap: body?.columnMap ?? null,
    rowCount: rows.length,
  });

  const validatedByIndex = new Map(validated.map((v) => [v.rowIndex, v]));
  const ingestRows: IngestRowInsert[] = rows.map((r) => {
    const v = validatedByIndex.get(r.rowIndex);
    return {
      batch_id: batchId,
      row_index: r.rowIndex,
      raw: r.raw,
      name: r.removed ? r.name || null : (v?.name ?? null),
      phone_e164: r.removed ? null : (v?.momoPhoneE164 ?? null),
      whatsapp_phone_e164: r.removed ? null : (v?.whatsappPhoneE164 ?? null),
      church_id: r.removed ? null : (v?.churchId ?? null),
      status: r.removed ? "removed" : "accepted",
      issues: [] as RowIssue[],
    };
  });
  await insertIngestRows(ingestRows);

  // Rows matching a partner this hub already owns are edits, not new people
  // (Decision 0024). Everything else is a fresh insert.
  const toUpdate = validated.filter((v) => v.updatesPartnerId);
  const toInsert = validated.filter((v) => !v.updatesPartnerId);

  await insertPartners(
    toInsert.map((v) => ({
      full_name: v.name,
      momo_phone_number: v.momoPhoneE164!,
      whatsapp_number: v.whatsappPhoneE164!,
      country: "Ghana",
      church: v.churchName!,
      status: "new",
      source: `hub_ingest_${batchId}`,
      preferred_communication_method: "whatsapp",
      hub_id: session.hubId,
      church_id: v.churchId!,
    })),
  );

  // Only the fields the sheet actually carries. Giving history, status and
  // opt-outs are never touched by a re-upload.
  await updatePartners(
    toUpdate.map((v) => ({
      partnerId: v.updatesPartnerId!,
      hubId: session.hubId,
      fields: {
        full_name: v.name,
        momo_phone_number: v.momoPhoneE164!,
        whatsapp_number: v.whatsappPhoneE164!,
        church: v.churchName!,
        church_id: v.churchId!,
        source: `hub_ingest_${batchId}`,
      },
    })),
  );

  await markBatchSubmitted(batchId, validated.length);

  return NextResponse.json({
    ok: true,
    batchId,
    accepted: validated.length,
    added: toInsert.length,
    updated: toUpdate.length,
    removed: rows.length - accepted.length,
  });
}
