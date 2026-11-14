// src/lib/cash/new-members.ts
// New members added from the Monthly Summary Form (Decision 0039). They go
// through exactly the hub Upload tab's rules (validateCandidates): two names, a
// valid WhatsApp number (MoMo too in Ghana regions), no number that belongs to
// another hub. The form is public, so a row matching someone the hub already has
// is skipped, never used to edit that partner.
import { normalizePhone, normalizeWhatsappPhone } from "../phone";
import { callingCodeForCountry } from "../hub/calling-codes";
import {
  createIngestBatch,
  findExistingPhones,
  findHubPartnerNames,
  getHubChurches,
  getHubCountry,
  insertIngestRows,
  insertPartners,
  markBatchSubmitted,
} from "../hub/db";
import {
  validateCandidates,
  type CandidateRow,
  type RowIssue,
  type ValidatedRow,
} from "../hub/ingest";
import { MAX_NEW_MEMBERS, type NewMemberInput } from "./validation";

export type NewMembersCheck =
  | {
      ok: true;
      /** Rows to insert as new partners. */
      add: ValidatedRow[];
      /** Rows naming someone the hub already has (left untouched). */
      alreadyListed: number;
      hubCountry: string;
    }
  | { ok: false; error: string; rows: { index: number; issues: RowIssue[] }[] };

/** Blank rows (every field empty) are dropped before anything else. */
export function nonBlankMembers(members: NewMemberInput[]): NewMemberInput[] {
  return members
    .map((m) => ({
      name: String(m?.name ?? "").trim(),
      whatsappPhone: String(m?.whatsappPhone ?? "").trim(),
      momoPhone: String(m?.momoPhone ?? "").trim(),
    }))
    .filter((m) => m.name || m.whatsappPhone || m.momoPhone);
}

export async function checkNewMembers(
  members: NewMemberInput[],
  ctx: { hubId: string; churchId: string; momoRequired: boolean },
): Promise<NewMembersCheck> {
  if (members.length > MAX_NEW_MEMBERS) {
    return {
      ok: false,
      error: `Add at most ${MAX_NEW_MEMBERS} new members on one form; use your hub's Upload tab for a longer list.`,
      rows: [],
    };
  }
  const [churchRows, hubCountry] = await Promise.all([
    getHubChurches(ctx.hubId),
    getHubCountry(ctx.hubId),
  ]);
  const church = churchRows.find((c) => c.id === ctx.churchId);
  if (!church)
    return {
      ok: false,
      error: "The selected church is not in this hub.",
      rows: [],
    };

  const whatsappCallingCode = callingCodeForCountry(hubCountry);
  const candidates: CandidateRow[] = members.map((m, i) => ({
    rowIndex: i + 1,
    raw: [m.name, m.whatsappPhone, m.momoPhone],
    name: m.name,
    momoPhone: ctx.momoRequired ? m.momoPhone : "",
    whatsappPhone: m.whatsappPhone,
    church: church.name,
  }));
  const phones = candidates
    .flatMap((c) => [
      normalizePhone(c.momoPhone, "GH"),
      ctx.momoRequired
        ? normalizePhone(c.whatsappPhone)
        : normalizeWhatsappPhone(c.whatsappPhone, whatsappCallingCode),
    ])
    .filter((p): p is string => p !== null);
  const [existingPhones, existingPartners] = await Promise.all([
    findExistingPhones(phones),
    findHubPartnerNames(ctx.hubId),
  ]);
  const validated = validateCandidates(candidates, {
    churches: churchRows.map((c) => ({
      id: c.id,
      name: c.name,
      nameKey: c.name_key,
    })),
    existingPhones,
    existingPartners,
    hubId: ctx.hubId,
    momoRequired: ctx.momoRequired,
    whatsappCallingCode,
    collectsPledge: false,
  });
  const flagged = validated.filter((v) => v.issues.length > 0);
  if (flagged.length > 0) {
    return {
      ok: false,
      error:
        flagged.length === 1
          ? "1 new member needs attention."
          : `${flagged.length} new members need attention.`,
      rows: flagged.map((v) => ({ index: v.rowIndex - 1, issues: v.issues })),
    };
  }
  return {
    ok: true,
    add: validated.filter((v) => !v.updatesPartnerId),
    alreadyListed: validated.filter((v) => v.updatesPartnerId).length,
    hubCountry,
  };
}

/**
 * Write the new members the way a hub upload does: an ingest batch (so they
 * appear in the hub's upload history), its rows, then the partners.
 */
export async function addNewMembers(
  rows: ValidatedRow[],
  ctx: { hubId: string; hubCountry: string; reportingMonth: string },
): Promise<string | null> {
  if (rows.length === 0) return null;
  const batchId = await createIngestBatch({
    hubId: ctx.hubId,
    fileName: "Monthly Summary Form",
    sheetName: ctx.reportingMonth.slice(0, 7),
    columnMap: null,
    rowCount: rows.length,
  });
  await insertIngestRows(
    rows.map((v) => ({
      batch_id: batchId,
      row_index: v.rowIndex,
      raw: v.raw,
      name: v.name,
      phone_e164: v.momoPhoneE164,
      whatsapp_phone_e164: v.whatsappPhoneE164,
      church_id: v.churchId,
      status: "accepted" as const,
      issues: [],
    })),
  );
  await insertPartners(
    rows.map((v) => ({
      full_name: v.name,
      momo_phone_number: v.momoPhoneE164,
      whatsapp_number: v.whatsappPhoneE164!,
      country: ctx.hubCountry,
      church: v.churchName!,
      status: "new" as const,
      source: `hub_ingest_${batchId}`,
      preferred_communication_method: "whatsapp" as const,
      hub_id: ctx.hubId,
      church_id: v.churchId!,
    })),
  );
  await markBatchSubmitted(batchId, rows.length);
  return batchId;
}
