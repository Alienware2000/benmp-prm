// src/lib/hub/giver-contacts.ts
// Who gave in a month, as a contact list for a broadcast (Decision 0041). Pure;
// the routes load one hub (or one church) and its month.
//
// Two kinds of giver, merged by phone so a person appears once:
// - members with statement giving (MoMo, bank, Paystack) matched to them;
// - cash givers listed on the church's Monthly Summary Form (Ghana only).
// Ledger rows in the cash group are skipped: the form's giver list already
// names those people.
import { normalizePhone } from "../phone";
import { toPaymentMethodGroup } from "../poc/dashboard-metrics";
import { toCsv } from "./csv";

export type GiverContactInput = {
  partners: {
    id: string;
    full_name: string;
    momo_phone_number: string | null;
    whatsapp_number: string | null;
    church: string | null;
  }[];
  payments: {
    partner_id: string;
    paid_at: string;
    amount_minor: number;
    payment_method: string | null;
    raw_method: string | null;
    raw_source: string | null;
  }[];
  /** Givers on the month's forms, with their church's name. */
  cashGivers: {
    giver_name: string | null;
    giver_phone: string | null;
    amount_minor: number;
    church: string;
  }[];
};

export type GiverContact = {
  name: string;
  /** E.164, or "" when none is on record. */
  phone: string;
  church: string;
  givenMinor: number;
  via: "Statement" | "Cash" | "Statement and cash";
};

export function buildGiverContacts(
  input: GiverContactInput,
  month: string,
): GiverContact[] {
  const partners = new Map(input.partners.map((p) => [p.id, p]));
  const byKey = new Map<string, GiverContact>();

  for (const payment of input.payments) {
    if (payment.paid_at.slice(0, 7) !== month) continue;
    const partner = partners.get(payment.partner_id);
    if (!partner) continue;
    const group = toPaymentMethodGroup(payment.payment_method, {
      _payment_method: payment.raw_method,
      source: payment.raw_source,
    });
    if (group === "cash") continue;
    const phone =
      normalizePhone(partner.whatsapp_number) ??
      normalizePhone(partner.momo_phone_number) ??
      "";
    const key = phone || `partner:${partner.id}`;
    const existing = byKey.get(key);
    if (existing) existing.givenMinor += payment.amount_minor;
    else
      byKey.set(key, {
        name: partner.full_name.trim(),
        phone,
        church: partner.church ?? "",
        givenMinor: payment.amount_minor,
        via: "Statement",
      });
  }

  input.cashGivers.forEach((giver, i) => {
    const phone = normalizePhone(giver.giver_phone) ?? "";
    const key = phone || `cash:${i}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.givenMinor += giver.amount_minor;
      if (existing.via === "Statement") existing.via = "Statement and cash";
      return;
    }
    byKey.set(key, {
      name: (giver.giver_name ?? "").trim(),
      phone,
      church: giver.church,
      givenMinor: giver.amount_minor,
      via: "Cash",
    });
  });

  return [...byKey.values()].sort(
    (a, b) => a.church.localeCompare(b.church) || a.name.localeCompare(b.name),
  );
}

/**
 * A spreadsheet program runs a cell starting with = + - @ as a formula. Names
 * come partly from a public form, so those are neutralised; the phone column
 * keeps its "+" because broadcast tools need E.164.
 */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function giverContactsCsv(contacts: GiverContact[]): string {
  // The byte-order mark lets Excel read accented names (e.g. "Matève") as UTF-8.
  return (
    "\uFEFF" +
    toCsv(
      contacts.map((c) => ({
        Name: safeText(c.name),
        Phone: c.phone,
        Church: safeText(c.church),
        "Given (GHS)": (c.givenMinor / 100).toFixed(2),
        "Gave by": c.via,
      })),
    ) +
    "\n"
  );
}

/** "givers-takoradi-bogoso-2026-10.csv" */
export function giverContactsFilename(parts: string[], month: string): string {
  const slug = parts
    .map((p) =>
      p
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("-");
  return `givers-${slug || "hub"}-${month}.csv`;
}
