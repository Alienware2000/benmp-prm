import { describe, it, expect } from "vitest";
import { reconcile, isStatementRow, type RegistrationRow, type PaymentRow } from "./reconcile";

const reg = (id: string, fullName: string, phone: string | null): RegistrationRow => ({
  id,
  fullName,
  phone,
});

const pay = (
  reference: string,
  payerPhone: string | null,
  amountMinor: number,
  payerName: string | null = null,
): PaymentRow => ({
  reference,
  payerName,
  payerPhone,
  amountMinor,
  currency: "GHS",
  paidAt: "2026-07-10",
});

describe("reconcile", () => {
  it("matches a registered partner to their payment by phone", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "0244123456")],
      [pay("r1", "+233244123456", 6000)],
    );
    expect(result.registeredPaid).toHaveLength(1);
    expect(result.registeredPaid[0].registration.id).toBe("p1");
    expect(result.registeredPaid[0].totalMinor).toBe(6000);
    expect(result.paidUnregistered).toHaveLength(0);
    expect(result.registeredUnpaid).toHaveLength(0);
  });

  it("applies Bishop Ebo's rule: a payer not on the sheet is still included and messaged", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "0244123456")],
      [pay("r1", "0209998888", 5000, "Kwame Mensah")],
    );
    expect(result.paidUnregistered).toHaveLength(1);
    expect(result.paidUnregistered[0].suggestedName).toBe("Kwame Mensah");
    expect(result.paidUnregistered[0].includeAndMessage).toBe(true);
    // the registered partner who did not pay is a defaulter
    expect(result.registeredUnpaid.map((r) => r.id)).toEqual(["p1"]);
  });

  it("flags a registered partner with no payment as a defaulter (reminder target)", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "0244123456"), reg("p2", "Yaw Boateng", "0201112222")],
      [pay("r1", "0244123456", 6000)],
    );
    expect(result.registeredPaid.map((m) => m.registration.id)).toEqual(["p1"]);
    expect(result.registeredUnpaid.map((r) => r.id)).toEqual(["p2"]);
    expect(result.paidUnregistered).toHaveLength(0);
  });

  it("sums multiple payments from the same partner in a period", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "0244123456")],
      [pay("r1", "0244123456", 6000), pay("r2", "+233244123456", 4000)],
    );
    expect(result.registeredPaid).toHaveLength(1);
    expect(result.registeredPaid[0].payments).toHaveLength(2);
    expect(result.registeredPaid[0].totalMinor).toBe(10000);
  });

  it("matches despite differing phone formats between sheet and statement", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "244123456")],
      [pay("r1", "024-412 3456", 6000)],
    );
    expect(result.registeredPaid).toHaveLength(1);
    expect(result.paidUnregistered).toHaveLength(0);
  });

  it("treats a payment with an unusable phone as unregistered (never dropped)", () => {
    const result = reconcile([reg("p1", "Ama Serwaa", "0244123456")], [pay("r1", null, 5000, "Cash Gift")]);
    expect(result.paidUnregistered).toHaveLength(1);
    expect(result.paidUnregistered[0].includeAndMessage).toBe(true);
    expect(result.paidUnregistered[0].phone).toBeNull();
  });

  it("groups an unregistered person's payments by phone — one entry, one total (no double thank-you)", () => {
    const result = reconcile(
      [],
      [
        pay("r1", "0209998888", 5000, "Kwame Mensah"),
        pay("r2", "+233209998888", 3000, "Kwame Mensah"),
        pay("r3", "0209997777", 2000, "Abena Osei"),
      ],
    );
    expect(result.paidUnregistered).toHaveLength(2);
    const kwame = result.paidUnregistered[0];
    expect(kwame.phone).toBe("+233209998888");
    expect(kwame.payments.map((p) => p.reference)).toEqual(["r1", "r2"]);
    expect(kwame.totalMinor).toBe(8000);
    expect(kwame.suggestedName).toBe("Kwame Mensah");
  });

  it("keeps no-phone unregistered payments as separate entries (nothing to group by)", () => {
    const result = reconcile([], [pay("r1", null, 5000, "Cash Gift"), pay("r2", null, 3000, "Cash Gift")]);
    expect(result.paidUnregistered).toHaveLength(2);
  });

  it("sets aside unmatched bank/interop statement rows — never messaged as people", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "0244123456")],
      [
        pay("r1", "+233598598874", 200000, "Ecobank MobileApp"),
        pay("r2", null, 5000, "INTEROPERABILITY PULL OVA"),
        pay("r3", "+233209998888", 7000, "Kwame Mensah"),
      ],
    );
    expect(result.statementRows.map((p) => p.reference)).toEqual(["r1", "r2"]);
    // the real person still lands in paidUnregistered (Bishop Ebo's rule)
    expect(result.paidUnregistered.map((pu) => pu.suggestedName)).toEqual(["Kwame Mensah"]);
  });

  it("a phone match beats the statement-noise check — a registered partner paying via bank rails stays matched", () => {
    const result = reconcile(
      [reg("p1", "Ama Serwaa", "0244123456")],
      [pay("r1", "0244123456", 6000, "INTEROPERABILITY PULL")],
    );
    expect(result.registeredPaid.map((m) => m.registration.id)).toEqual(["p1"]);
    expect(result.statementRows).toHaveLength(0);
  });
});

describe("isStatementRow", () => {
  it("flags the artifacts seen on the real Qodesh statement", () => {
    for (const name of [
      "Ecobank MobileApp",
      "INTEROPERABILITY PULL OVA",
      "INTEROPERABILITY PULL",
      "Interpush OVA",
      "Quickpay pull",
      "CalSEND",
      "ZenithSend",
    ]) {
      expect(isStatementRow(name), name).toBe(true);
    }
  });

  it("leaves real names alone (including substring lookalikes)", () => {
    for (const name of ["Kwame Mensah", "Ewurabena Bankson", "Nova Owusu", "PAUL EDDY OKWABI QUARTEY", null]) {
      expect(isStatementRow(name), String(name)).toBe(false);
    }
  });
});
