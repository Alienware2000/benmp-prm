/**
 * Hub admins removing partners they uploaded (Decision 0029). Pure rules only;
 * the database calls live in db.ts.
 *
 * A partner can be removed by the hub that owns them, unless giving is on record
 * for them: a payment from their number, a contribution, or a matched statement
 * row. Those stay, because removing them would detach money from a person; the
 * BENMP office handles them.
 */

export type DeletablePartner = {
  id: string;
  hub_id: string | null;
  full_name: string | null;
  whatsapp_number: string | null;
  momo_phone_number: string | null;
};

export type GivingOnRecord = {
  /** E.164 numbers with at least one successful payment. */
  paidPhones: ReadonlySet<string>;
  /** Partner ids referenced by contributions or matched statement rows. */
  linkedPartnerIds: ReadonlySet<string>;
};

export type DeletePlan = {
  deleteIds: string[];
  kept: { id: string; name: string; reason: string }[];
};

export function planHubPartnerDeletion(
  hubId: string,
  requestedIds: readonly string[],
  found: readonly DeletablePartner[],
  giving: GivingOnRecord,
): DeletePlan {
  const byId = new Map(found.map((p) => [p.id, p]));
  const deleteIds: string[] = [];
  const kept: DeletePlan["kept"] = [];
  for (const id of new Set(requestedIds)) {
    const p = byId.get(id);
    // Not found, or another hub's: say nothing about it beyond "not yours".
    if (!p || p.hub_id !== hubId) {
      kept.push({ id, name: "", reason: "Not one of your hub's partners." });
      continue;
    }
    const name = p.full_name ?? "";
    const paid = [p.whatsapp_number, p.momo_phone_number].some(
      (ph) => ph && giving.paidPhones.has(ph),
    );
    if (paid || giving.linkedPartnerIds.has(p.id)) {
      kept.push({
        id,
        name,
        reason:
          "Has giving on record, so it stays. Ask the BENMP office if it must be removed.",
      });
      continue;
    }
    deleteIds.push(id);
  }
  return { deleteIds, kept };
}

export type UploadWindow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
};

/**
 * The partners an upload ADDED: inserted between the batch being opened and
 * being marked submitted (submit writes them in that order). Partners the upload
 * only updated were created earlier and are not included. A few seconds of slack
 * covers clock skew between the app and the database.
 */
export function partnersAddedByUpload<T extends { created_at: string }>(
  upload: UploadWindow,
  partners: readonly T[],
): T[] {
  if (!upload.submitted_at) return [];
  const from = Date.parse(upload.created_at) - 5_000;
  const to = Date.parse(upload.submitted_at) + 5_000;
  return partners.filter((p) => {
    const t = Date.parse(p.created_at);
    return t >= from && t <= to;
  });
}
