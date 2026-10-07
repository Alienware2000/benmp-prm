import { describe, expect, it } from "vitest";
import {
  buildExecutiveSummary,
  type PaymentForSummary,
  type PartnerForSummary,
} from "./executive-summary";

const PARTNERS: PartnerForSummary[] = [
  { id: "p1", country: "Ghana", momo_phone_number: "0244123456", whatsapp_number: null },
  { id: "p2", country: "Nigeria", momo_phone_number: null, whatsapp_number: null },
  { id: "p3", country: "United Kingdom", momo_phone_number: null, whatsapp_number: null },
];

function pay(amountMinor: number, overrides: Partial<PaymentForSummary> = {}): PaymentForSummary {
  return {
    amount_minor: amountMinor,
    payment_method: "mobile_money",
    raw_row: { matched_partner_id: "p1" },
    paid_at: "2026-09-15T00:00:00.000Z",
    payer_phone_e164: null,
    ...overrides,
  };
}

describe("buildExecutiveSummary", () => {
  it("sums all payments correctly", () => {
    const summary = buildExecutiveSummary(
      [pay(10000), pay(20000), pay(30000)],
      PARTNERS,
    );
    expect(summary.totalGhsMinor).toBe(60000);
    expect(summary.paymentCount).toBe(3);
  });

  it("converts minor GHS to USD at the configured rate", () => {
    const summary = buildExecutiveSummary([pay(60000)], PARTNERS);
    // 60000 minor = 600 GHS; 600 / 12 = 50 USD
    expect(summary.totalUsd).toBe(50);
    expect(summary.fxRate).toBe(12);
  });

  it("computes active partners as floor(totalUsd / threshold)", () => {
    const summary = buildExecutiveSummary([pay(60000)], PARTNERS);
    // 50 USD / 5 = 10
    expect(summary.activePartners).toBe(10);
    expect(summary.activeThresholdUsd).toBe(5);
  });

  it("method breakdown sums to the total", () => {
    const payments: PaymentForSummary[] = [
      pay(10000, { payment_method: "mobile_money", raw_row: { _payment_method: "mobile_money" } }),
      pay(20000, { payment_method: "bank_transfer", raw_row: { _payment_method: "bank_transfer" } }),
      pay(30000, { payment_method: "paystack_card", raw_row: { _payment_method: "paystack_card" } }),
      pay(5000, { payment_method: "cash", raw_row: { _payment_method: "cash" } }),
    ];
    const summary = buildExecutiveSummary(payments, PARTNERS);
    const sum = Object.values(summary.byMethod).reduce((a, b) => a + b, 0);
    expect(sum).toBe(summary.totalGhsMinor);
    expect(summary.byMethod.mobile_money).toBe(10000);
    expect(summary.byMethod.bank).toBe(20000);
    expect(summary.byMethod.paystack).toBe(30000);
    expect(summary.byMethod.cash).toBe(5000);
  });

  it("region breakdown sums to the total", () => {
    const payments: PaymentForSummary[] = [
      pay(10000, { raw_row: { matched_partner_id: "p1" } }), // Ghana
      pay(20000, { raw_row: { matched_partner_id: "p2" } }), // Nigeria -> Africa
      pay(30000, { raw_row: { matched_partner_id: "p3" } }), // UK
    ];
    const summary = buildExecutiveSummary(payments, PARTNERS);
    const sum = summary.byRegion.reduce((a, r) => a + r.totalGhsMinor, 0);
    expect(sum).toBe(summary.totalGhsMinor);
    expect(summary.byRegion.length).toBe(3);
  });

  it("sorts byRegion by totalGhsMinor descending", () => {
    const payments: PaymentForSummary[] = [
      pay(10000, { raw_row: { matched_partner_id: "p1" } }), // Ghana
      pay(30000, { raw_row: { matched_partner_id: "p3" } }), // UK
      pay(20000, { raw_row: { matched_partner_id: "p2" } }), // Africa
    ];
    const summary = buildExecutiveSummary(payments, PARTNERS);
    expect(summary.byRegion.map((r) => r.region)).toEqual([
      "United Kingdom",
      "Africa",
      "Ghana",
    ]);
  });

  it("month filter only includes payments in the specified month", () => {
    const payments: PaymentForSummary[] = [
      pay(10000, { paid_at: "2026-09-01T00:00:00.000Z" }),
      pay(20000, { paid_at: "2026-10-05T00:00:00.000Z" }),
      pay(30000, { paid_at: "2026-09-20T00:00:00.000Z" }),
    ];
    const summary = buildExecutiveSummary(payments, PARTNERS, "2026-09");
    expect(summary.totalGhsMinor).toBe(40000);
    expect(summary.paymentCount).toBe(2);
  });

  it("returns a zero result for empty payments", () => {
    const summary = buildExecutiveSummary([], PARTNERS);
    expect(summary.totalGhsMinor).toBe(0);
    expect(summary.totalUsd).toBe(0);
    expect(summary.activePartners).toBe(0);
    expect(summary.paymentCount).toBe(0);
    expect(summary.byRegion).toEqual([]);
  });

  it("computes per-region active partners correctly", () => {
    // Ghana: 60000 minor = 600 GHS = 50 USD -> 10 partners
    // Africa: 30000 minor = 300 GHS = 25 USD -> 5 partners
    const payments: PaymentForSummary[] = [
      pay(60000, { raw_row: { matched_partner_id: "p1" } }),
      pay(30000, { raw_row: { matched_partner_id: "p2" } }),
    ];
    const summary = buildExecutiveSummary(payments, PARTNERS);
    const ghana = summary.byRegion.find((r) => r.region === "Ghana")!;
    const africa = summary.byRegion.find((r) => r.region === "Africa")!;
    expect(ghana.activePartners).toBe(10);
    expect(ghana.totalUsd).toBe(50);
    expect(africa.activePartners).toBe(5);
    expect(africa.totalUsd).toBe(25);
  });

  it("falls back to Ghana for unmatched payments", () => {
    const summary = buildExecutiveSummary(
      [pay(15000, { raw_row: { matched_partner_id: "nonexistent" }, payer_phone_e164: "233244123456" })],
      PARTNERS,
    );
    // payer phone matches p1 via last-9-digit key -> Ghana
    expect(summary.byRegion.map((r) => r.region)).toEqual(["Ghana"]);
  });

  it("falls back to Ghana when no partner is matched at all", () => {
    const summary = buildExecutiveSummary(
      [pay(15000, { raw_row: null, payer_phone_e164: null })],
      PARTNERS,
    );
    expect(summary.byRegion.map((r) => r.region)).toEqual(["Ghana"]);
  });

  it("honours custom fxRate and activeThresholdUsd", () => {
    // 60000 minor = 600 GHS; rate 10 -> 60 USD; threshold 6 -> 10 partners
    const summary = buildExecutiveSummary([pay(60000)], PARTNERS, undefined, 10, 6);
    expect(summary.fxRate).toBe(10);
    expect(summary.activeThresholdUsd).toBe(6);
    expect(summary.totalUsd).toBe(60);
    expect(summary.activePartners).toBe(10);
  });

  it("floors active partners toward zero", () => {
    // 5000 minor = 50 GHS = ~4.166 USD at rate 12; floor(4.166 / 5) = 0
    const summary = buildExecutiveSummary([pay(5000)], PARTNERS);
    expect(summary.totalUsd).toBeCloseTo(4.1666, 2);
    expect(summary.activePartners).toBe(0);
  });
});