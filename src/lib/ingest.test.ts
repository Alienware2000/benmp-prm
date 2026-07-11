import { describe, it, expect } from "vitest";
import {
  parseAmountToMinor,
  collapseDoubledName,
  parseRegistrations,
  parsePayments,
  type RawRow,
} from "./ingest";
import { reconcile } from "./reconcile";

describe("parseAmountToMinor", () => {
  it("parses whole and decimal GHS amounts to integer minor units", () => {
    expect(parseAmountToMinor("120")).toBe(12000);
    expect(parseAmountToMinor("120.00")).toBe(12000);
    expect(parseAmountToMinor("12.5")).toBe(1250);
    expect(parseAmountToMinor("1,200.50")).toBe(120050);
  });

  it("strips a currency prefix", () => {
    expect(parseAmountToMinor("GHS 50.00")).toBe(5000);
  });

  it("rejects junk, empty, negative, and over-precise amounts (money integrity)", () => {
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseAmountToMinor("-20")).toBeNull();
    expect(parseAmountToMinor(".5")).toBeNull();
    // 3 decimals with decimals=2 is rejected, not silently truncated
    expect(parseAmountToMinor("50.000")).toBeNull();
  });
});

describe("collapseDoubledName (MTN doubles the sender name)", () => {
  it("collapses an exactly-doubled name", () => {
    expect(collapseDoubledName("KWAME MENSAH KWAME MENSAH")).toBe("KWAME MENSAH");
  });
  it("leaves a normal name untouched", () => {
    expect(collapseDoubledName("KWAME MENSAH")).toBe("KWAME MENSAH");
    expect(collapseDoubledName("Ama")).toBe("Ama");
    expect(collapseDoubledName("A B C")).toBe("A B C");
  });
});

const regRows: RawRow[] = [
  { Name: "Ama Serwaa", Phone: "0244000001", Pledge: "50.00" }, // matchable (0-prefixed)
  { Name: "Rev. Kofi Boateng", Phone: "244000002", Pledge: "100" }, // titled, 9-digit
  { Name: "Yaa Broken", Phone: "5560002", Pledge: "20" }, // malformed 8-digit phone (kept, unmatchable)
  { Name: "", Phone: "244000004", Pledge: "20" }, // missing name -> reject
  { Name: "No Phone Person", Phone: "", Pledge: "20" }, // missing phone -> reject
];
const regMap = { fullName: "Name", phone: "Phone", expectedAmount: "Pledge" };

describe("parseRegistrations", () => {
  it("maps rows, generates stable ids, converts pledge to minor, and rejects incomplete rows", () => {
    const { rows, rejects } = parseRegistrations(regRows, regMap);
    expect(rows).toHaveLength(3);
    expect(rejects).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "reg_0",
      fullName: "Ama Serwaa",
      phone: "0244000001",
      expectedAmountMinor: 5000,
    });
    expect(rows[1].expectedAmountMinor).toBe(10000);
    // id is index-stable: the malformed-phone row is still reg_2
    expect(rows[2].id).toBe("reg_2");
    expect(rejects.map((r) => r.index)).toEqual([3, 4]);
    expect(rejects[0].reason).toMatch(/name/i);
    expect(rejects[1].reason).toMatch(/phone/i);
  });
});

const payRows: RawRow[] = [
  { "Transaction ID": "TXN1", Sender: "AMA SERWAA AMA SERWAA", "MoMo Number": "0244000001", Amount: "50.00", Date: "2026-07-10" }, // matches Ama, doubled name
  { "Transaction ID": "TXN2", Sender: "Kwesi Stranger", "MoMo Number": "0209999999", Amount: "75.50", Date: "2026-07-10" }, // paid-unregistered
  { "Transaction ID": "TXN1", Sender: "AMA SERWAA AMA SERWAA", "MoMo Number": "0244000001", Amount: "50.00", Date: "2026-07-10" }, // duplicate reference
  { "Transaction ID": "TXN3", Sender: "Bad Amount", "MoMo Number": "0244000009", Amount: "abc", Date: "2026-07-10" }, // junk amount -> reject
  { "Transaction ID": "", Sender: "No Ref", "MoMo Number": "0244000010", Amount: "20", Date: "2026-07-10" }, // missing reference -> reject
];
const payMap = {
  reference: "Transaction ID",
  payerName: "Sender",
  payerPhone: "MoMo Number",
  amount: "Amount",
  paidAt: "Date",
};

describe("parsePayments", () => {
  it("maps rows, collapses doubled names, dedups by reference, and rejects invalid rows", () => {
    const { rows, rejects, duplicates } = parsePayments(payRows, payMap);
    expect(rows).toHaveLength(2);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].index).toBe(2);
    expect(rejects.map((r) => r.index)).toEqual([3, 4]);

    expect(rows[0]).toEqual({
      reference: "TXN1",
      payerName: "AMA SERWAA",
      payerPhone: "0244000001",
      amountMinor: 5000,
      currency: "GHS",
      paidAt: "2026-07-10",
    });
    expect(rows[1].amountMinor).toBe(7550);
  });
});

describe("ingest -> reconcile (the POC spine, incl. Bishop Ebo's rule)", () => {
  it("produces the three buckets from parsed CSVs", () => {
    const registrations = parseRegistrations(regRows, regMap).rows;
    const payments = parsePayments(payRows, payMap).rows;
    const result = reconcile(registrations, payments);

    // Ama is registered and paid.
    expect(result.registeredPaid).toHaveLength(1);
    expect(result.registeredPaid[0].registration.fullName).toBe("Ama Serwaa");
    expect(result.registeredPaid[0].totalMinor).toBe(5000);

    // Kwesi Stranger paid but is not on the sheet -> Bishop Ebo's rule.
    expect(result.paidUnregistered).toHaveLength(1);
    expect(result.paidUnregistered[0].suggestedName).toBe("Kwesi Stranger");
    expect(result.paidUnregistered[0].includeAndMessage).toBe(true);

    // Rev. Kofi and Yaa (malformed phone) registered but didn't pay.
    expect(result.registeredUnpaid.map((r) => r.fullName).sort()).toEqual([
      "Rev. Kofi Boateng",
      "Yaa Broken",
    ]);
  });
});
