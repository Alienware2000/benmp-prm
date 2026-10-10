// src/lib/poc/accept-all.ts
// Decides, for every payment row waiting in review, which partner it belongs to when
// staff "accept all": an existing partner, or a new Unlisted one. Identity follows
// Decision 0028 — a phone number is the identity when the row has one, so a shared
// name never links two different givers. Name is only used for rows without a phone
// (bank and Paystack), and only when exactly one partner carries that name.
import { normalizePhone } from "../phone";
import {
  ghanaLastNineKey,
  type NormalizedPaymentRow,
  type PartnerForPaymentMatch,
} from "./payment-upload";

export type AcceptAllReviewRow = { id: string; row: NormalizedPaymentRow };

export type NewPartnerSpec = {
  key: string;
  name: string;
  phone: string | null;
  country: string;
};

export type AcceptAllPlan = {
  /** Review row → existing partner id, or the key of a partner in `newPartners`. */
  assignments: Array<
    | { reviewRowId: string; row: NormalizedPaymentRow; partnerId: string }
    | { reviewRowId: string; row: NormalizedPaymentRow; newPartnerKey: string }
  >;
  /** One entry per distinct new giver, in first-seen order. */
  newPartners: NewPartnerSpec[];
};

function phoneKey(raw: string | null | undefined): string | null {
  const normalized = normalizePhone(raw);
  if (!normalized) return null;
  return ghanaLastNineKey(normalized) ?? normalized;
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

function countryForSource(source: NormalizedPaymentRow["source"]): string {
  return source === "momo" || source === "ecobank" ? "Ghana" : "Unknown";
}

export function planAcceptAll(
  reviewRows: AcceptAllReviewRow[],
  partners: PartnerForPaymentMatch[],
): AcceptAllPlan {
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const partner of partners) {
    for (const phone of [partner.momoPhoneNumber, partner.whatsappNumber]) {
      const key = phoneKey(phone);
      if (key && !byPhone.has(key)) byPhone.set(key, partner.id);
    }
    const key = nameKey(partner.fullName);
    if (key) byName.set(key, [...(byName.get(key) ?? []), partner.id]);
  }

  const newPartners = new Map<string, NewPartnerSpec>();
  const assignments: AcceptAllPlan["assignments"] = [];

  for (const { id, row } of reviewRows) {
    const name = (row.payerName ?? "").trim();
    const phone = phoneKey(row.payerPhoneOrAccount);

    if (phone) {
      const existing = byPhone.get(phone);
      if (existing) {
        assignments.push({ reviewRowId: id, row, partnerId: existing });
        continue;
      }
    } else if (name) {
      const sameName = byName.get(nameKey(name)) ?? [];
      if (sameName.length === 1) {
        assignments.push({ reviewRowId: id, row, partnerId: sameName[0] });
        continue;
      }
    }

    // New giver. Grouped by phone when there is one; by name otherwise; a row with
    // neither stands alone rather than pooling every anonymous payment together.
    const key = phone ? `phone:${phone}` : name ? `name:${nameKey(name)}` : `row:${id}`;
    if (!newPartners.has(key)) {
      newPartners.set(key, {
        key,
        name: name || "Unknown Giver",
        phone: normalizePhone(row.payerPhoneOrAccount),
        country: countryForSource(row.source),
      });
    }
    assignments.push({ reviewRowId: id, row, newPartnerKey: key });
  }

  return { assignments, newPartners: [...newPartners.values()] };
}
