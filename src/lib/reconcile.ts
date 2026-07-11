/**
 * Reconciliation core — the heart of the Ghana/MoMo POC.
 *
 * Given the registration sheet (who the office thinks its partners are) and a period's
 * payments (a MoMo statement/CSV), produce three buckets:
 *
 *   1. registeredPaid     — matched: a registered partner paid this period.
 *   2. paidUnregistered   — Bishop Ebo's rule: someone PAID but is NOT on the registration
 *                           sheet. They are still included and messaged like everyone else;
 *                           the payment itself makes them a partner.
 *   3. registeredUnpaid   — registered but no payment this period. These are the defaulters
 *                           the event-driven reminder targets (a due date passed with no
 *                           recognized payment).
 *   4. statementRows      — bank/interop artifacts on the statement ("Ecobank MobileApp",
 *                           "INTEROPERABILITY PULL OVA"): real money, not a person. Counted
 *                           in giving totals, NEVER messaged, set aside for finance review.
 *                           Only unmatched rows are classified — a phone match always wins,
 *                           so a registered partner paying through bank rails stays matched.
 *
 * Pure functions, no I/O — matching key is the E.164 phone (see ./phone).
 */

import { normalizePhone } from "./phone";

export type RegistrationRow = {
  id: string;
  fullName: string;
  phone: string | null;
  /** Expected periodic gift in minor units (a pledge), if the sheet recorded one. */
  expectedAmountMinor?: number | null;
};

export type PaymentRow = {
  /** Upstream-stable reference for this statement/CSV row (dedup happens before reconcile). */
  reference: string;
  payerName: string | null;
  payerPhone: string | null;
  amountMinor: number;
  currency: string;
  /** ISO date the payment landed. */
  paidAt: string;
};

export type RegisteredPaid = {
  registration: RegistrationRow;
  payments: PaymentRow[];
  totalMinor: number;
};

export type PaidUnregistered = {
  payment: PaymentRow;
  /** Best-guess partner name to seed the auto-created record. */
  suggestedName: string | null;
  /** Bishop Ebo's rule: always true — include them and message them like the rest. */
  includeAndMessage: true;
};

export type ReconciliationResult = {
  registeredPaid: RegisteredPaid[];
  paidUnregistered: PaidUnregistered[];
  registeredUnpaid: RegistrationRow[];
  /** Bank/interop statement artifacts — money counted, no message, finance review. */
  statementRows: PaymentRow[];
};

/**
 * Payer names that are bank/interop transfer artifacts, not people. Curated from the
 * real Qodesh MoMo statement ("Ecobank MobileApp", "INTEROPERABILITY PULL OVA",
 * "INTEROPERABILITY PULL", "Interpush OVA", "Quickpay pull", "CalSEND", "ZenithSend")
 * plus generic markers. Extend here when a new statement shows a new artifact name.
 */
const STATEMENT_ROW_PATTERNS: RegExp[] = [
  /\binteroperability\b/i,
  /\binterpush\b/i,
  /\bquickpay\b/i,
  /\becobank\b/i,
  /\bmobileapp\b/i,
  /calsend/i,
  /zenithsend/i,
  /\bova\b/i,
  /\bpull\b/i,
  /\bbank\b/i,
];

/** True when a payer name looks like a bank/interop statement entry rather than a person. */
export function isStatementRow(payerName: string | null): boolean {
  if (!payerName) return false;
  return STATEMENT_ROW_PATTERNS.some((re) => re.test(payerName));
}

/**
 * Reconcile a period's payments against the registration sheet.
 * Matching is by normalized phone; a payment with no phone match falls to
 * paidUnregistered (Bishop Ebo's rule) rather than being dropped.
 */
export function reconcile(
  registrations: RegistrationRow[],
  payments: PaymentRow[],
): ReconciliationResult {
  const registrationByPhone = new Map<string, RegistrationRow>();
  for (const reg of registrations) {
    const key = normalizePhone(reg.phone);
    if (key && !registrationByPhone.has(key)) {
      registrationByPhone.set(key, reg);
    }
  }

  const paymentsByRegId = new Map<string, PaymentRow[]>();
  const paidUnregistered: PaidUnregistered[] = [];
  const statementRows: PaymentRow[] = [];

  for (const payment of payments) {
    const key = normalizePhone(payment.payerPhone);
    const match = key ? registrationByPhone.get(key) : undefined;

    if (match) {
      const existing = paymentsByRegId.get(match.id);
      if (existing) existing.push(payment);
      else paymentsByRegId.set(match.id, [payment]);
    } else if (isStatementRow(payment.payerName)) {
      statementRows.push(payment);
    } else {
      paidUnregistered.push({
        payment,
        suggestedName: payment.payerName?.trim() || null,
        includeAndMessage: true,
      });
    }
  }

  const registrationById = new Map(registrations.map((r) => [r.id, r]));
  const registeredPaid: RegisteredPaid[] = [];
  for (const [regId, pays] of paymentsByRegId) {
    const registration = registrationById.get(regId);
    if (!registration) continue;
    registeredPaid.push({
      registration,
      payments: pays,
      totalMinor: pays.reduce((sum, p) => sum + p.amountMinor, 0),
    });
  }

  const registeredUnpaid = registrations.filter((r) => !paymentsByRegId.has(r.id));

  return { registeredPaid, paidUnregistered, registeredUnpaid, statementRows };
}
