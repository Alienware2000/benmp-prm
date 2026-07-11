/**
 * POC answer aggregations (POC-4).
 *
 * The single source of truth the AI is allowed to cite — pure functions over a
 * ReconciliationResult. The model (Gemini 2.5, wired in ./ask) only *phrases* these
 * numbers; it never computes or invents figures. Money stays integer minor units.
 */

import type { ReconciliationResult } from "../reconcile";

export type BucketCounts = {
  registeredPaid: number;
  paidUnregistered: number;
  registeredUnpaid: number;
  totalPeople: number;
};

export function countsByBucket(r: ReconciliationResult): BucketCounts {
  const registeredPaid = r.registeredPaid.length;
  const paidUnregistered = r.paidUnregistered.length;
  const registeredUnpaid = r.registeredUnpaid.length;
  return {
    registeredPaid,
    paidUnregistered,
    registeredUnpaid,
    totalPeople: registeredPaid + paidUnregistered + registeredUnpaid,
  };
}

/** All money received this period — includes statement rows (bank/interop money is real giving). */
export function totalCollectedMinor(r: ReconciliationResult): number {
  const fromRegistered = r.registeredPaid.reduce((s, x) => s + x.totalMinor, 0);
  const fromUnregistered = r.paidUnregistered.reduce((s, x) => s + x.payment.amountMinor, 0);
  return fromRegistered + fromUnregistered + statementTotalMinor(r);
}

/** Money that arrived as bank/interop statement rows — no person to attribute or message. */
export function statementTotalMinor(r: ReconciliationResult): number {
  return r.statementRows.reduce((s, p) => s + p.amountMinor, 0);
}

export type UnregisteredPayer = {
  name: string | null;
  amountMinor: number;
  reference: string;
  phone: string | null;
};

export function unregisteredPayers(r: ReconciliationResult): UnregisteredPayer[] {
  return r.paidUnregistered.map((pu) => ({
    name: pu.suggestedName,
    amountMinor: pu.payment.amountMinor,
    reference: pu.payment.reference,
    phone: pu.payment.payerPhone,
  }));
}

/** Display GHS from integer minor units (display only — never a rule input). */
export function formatGhs(minor: number): string {
  const whole = Math.trunc(minor / 100).toLocaleString("en-US");
  const pesewas = Math.abs(minor % 100);
  return pesewas === 0 ? `${whole}` : `${whole}.${String(pesewas).padStart(2, "0")}`;
}

export type HeadlineAnswers = {
  /** Everyone who paid this period — registered + unregistered. */
  paidCount: number;
  registeredPaidCount: number;
  /** Bishop Ebo's rule bucket. */
  unregisteredCount: number;
  /** Registered but not yet paid. */
  unpaidCount: number;
  totalPeople: number;
  totalCollectedMinor: number;
  totalCollectedGhs: string;
  /** Bank/interop statement rows — money counted above, but not people and never messaged. */
  statementRowCount: number;
  statementTotalMinor: number;
  statementTotalGhs: string;
  unregistered: UnregisteredPayer[];
};

export function headlineAnswers(r: ReconciliationResult): HeadlineAnswers {
  const counts = countsByBucket(r);
  const collected = totalCollectedMinor(r);
  const statementTotal = statementTotalMinor(r);
  return {
    paidCount: counts.registeredPaid + counts.paidUnregistered,
    registeredPaidCount: counts.registeredPaid,
    unregisteredCount: counts.paidUnregistered,
    unpaidCount: counts.registeredUnpaid,
    totalPeople: counts.totalPeople,
    totalCollectedMinor: collected,
    totalCollectedGhs: formatGhs(collected),
    statementRowCount: r.statementRows.length,
    statementTotalMinor: statementTotal,
    statementTotalGhs: formatGhs(statementTotal),
    unregistered: unregisteredPayers(r),
  };
}
