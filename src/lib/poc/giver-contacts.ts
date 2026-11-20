// src/lib/poc/giver-contacts.ts
// Who gave in a month, as a contact list for a broadcast (Decisions 0041, 0044,
// 0046). Pure; the office route loads the month's statement payments and any
// partners they are linked to.
//
// MoMo, bank statement and Paystack tracking is its own system (Decision 0044): the list is statement giving
// (MoMo, bank, Paystack) only, person by person, merged by phone so a person
// appears once. Every payment counts, linked to a partner or not: the payer's
// name and number come from the statement, with the partner's as a fallback.
// It carries no church or hub, and nothing from the Monthly Summary Form.
// Ledger rows in the cash group are skipped.
import { normalizePhone } from "../phone";
import { toPaymentMethodGroup } from "./dashboard-metrics";
import { toCsv } from "../hub/csv";

export type GiverContactInput = {
  partners: {
    id: string;
    full_name: string;
    momo_phone_number: string | null;
    whatsapp_number: string | null;
  }[];
  payments: {
    /** raw_row.matched_partner_id; null when the line matched no partner. */
    partner_id: string | null;
    payer_name: string | null;
    payer_phone_e164: string | null;
    paid_at: string;
    amount_minor: number;
    payment_method: string | null;
    raw_method: string | null;
    raw_source: string | null;
  }[];
};

export type GiverContact = {
  name: string;
  /** E.164, or "" when none is on record. */
  phone: string;
  givenMinor: number;
  gifts: number;
};

export function buildGiverContacts(
  input: GiverContactInput,
  month: string,
): GiverContact[] {
  const partners = new Map(input.partners.map((p) => [p.id, p]));
  const byKey = new Map<string, GiverContact>();

  for (const payment of input.payments) {
    if (payment.paid_at.slice(0, 7) !== month) continue;
    const partner = payment.partner_id
      ? partners.get(payment.partner_id)
      : undefined;
    const group = toPaymentMethodGroup(payment.payment_method, {
      _payment_method: payment.raw_method,
      source: payment.raw_source,
    });
    if (group === "cash") continue;
    const phone =
      normalizePhone(payment.payer_phone_e164) ??
      normalizePhone(partner?.whatsapp_number) ??
      normalizePhone(partner?.momo_phone_number) ??
      "";
    const name = (partner?.full_name ?? payment.payer_name ?? "").trim();
    const key = phone || `name:${name.toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.givenMinor += payment.amount_minor;
      existing.gifts += 1;
    } else
      byKey.set(key, {
        name,
        phone,
        givenMinor: payment.amount_minor,
        gifts: 1,
      });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A spreadsheet program runs a cell starting with = + - @ as a formula. Names
 * come partly from statement narrations, so those are neutralised; the phone
 * column keeps its "+" because broadcast tools need E.164.
 */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function giverContactsCsv(contacts: GiverContact[]): string {
  // The byte-order mark lets Excel read accented names (e.g. "Matève") as UTF-8.
  return (
    "﻿" +
    toCsv(
      contacts.map((c) => ({
        Name: safeText(c.name),
        Phone: c.phone,
        "Given (GHS)": (c.givenMinor / 100).toFixed(2),
        Gifts: c.gifts,
      })),
    ) +
    "\n"
  );
}

/** "givers-2026-10.csv" */
export const giverContactsFilename = (month: string) => `givers-${month}.csv`;
