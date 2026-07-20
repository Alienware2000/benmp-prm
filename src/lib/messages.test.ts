import { describe, it, expect } from "vitest";
import { buildThankYouMessage, planMessages, firstName } from "./messages";
import type {
  ReconciliationResult,
  RegistrationRow,
  PaymentRow,
} from "./reconcile";

const reg = (
  id: string,
  fullName: string,
  phone: string | null,
): RegistrationRow => ({
  id,
  fullName,
  phone,
});
const pay = (
  reference: string,
  payerName: string | null,
  payerPhone: string | null,
  amountMinor: number,
): PaymentRow => ({
  reference,
  payerName,
  payerPhone,
  amountMinor,
  currency: "GHS",
  paidAt: "2026-07-10",
});

const result: ReconciliationResult = {
  registeredPaid: [
    {
      registration: reg("reg_0", "Rev. Kofi Boateng", "0244000002"),
      payments: [],
      totalMinor: 5000,
    },
    // VIP: >= 100 GHS
    {
      registration: reg("reg_1", "Ama Serwaa", "244000003"),
      payments: [],
      totalMinor: 10000,
    },
    // unnormalizable phone -> planned but not sendable
    {
      registration: reg("reg_2", "Yaa Broken", "5560002"),
      payments: [],
      totalMinor: 2000,
    },
  ],
  paidUnregistered: [
    // two payments grouped by phone -> ONE thank-you covering the total
    {
      payments: [
        pay("TXN2", "Kwesi Stranger", "0209999999", 7550),
        pay("TXN3", "Kwesi Stranger", "0209999999", 3000),
      ],
      totalMinor: 10550,
      phone: "+233209999999",
      suggestedName: "Kwesi Stranger",
      includeAndMessage: true,
    },
    // no name on the statement -> falls back to a generic greeting
    {
      payments: [pay("TXN9", null, "0201234567", 2000)],
      totalMinor: 2000,
      phone: "+233201234567",
      suggestedName: null,
      includeAndMessage: true,
    },
  ],
  registeredUnpaid: [reg("reg_5", "Mr. Late Payer", "0244555000")],
  // set aside by reconcile() — planMessages must never thank a bank artifact
  statementRows: [pay("TXN10", "Ecobank MobileApp", "0598598874", 200000)],
};

describe("firstName (strip titles for greeting)", () => {
  it("drops common titles", () => {
    expect(firstName("Rev. Kofi Boateng")).toBe("Kofi");
    expect(firstName("LP. Nana Yaa Ane")).toBe("Nana");
    expect(firstName("Dr Wilfred Torshie")).toBe("Wilfred");
    expect(firstName("Ama Serwaa")).toBe("Ama");
  });
});

describe("buildThankYouMessage", () => {
  it("uses the regular and high-touch wording at the same threshold as planned sends", () => {
    expect(buildThankYouMessage("Mr. Kofi Boateng", 60_00)).toContain(
      "Hi Kofi",
    );
    expect(buildThankYouMessage("Mr. Kofi Boateng", 100_00)).toContain(
      "Dear Kofi",
    );
  });
});

describe("planMessages", () => {
  const passed = { asOf: "2026-07-31", dueDate: "2026-07-15" }; // due date already passed
  const future = { asOf: "2026-07-10", dueDate: "2026-08-15" }; // due date not yet reached

  it("thanks every payer — registered AND unregistered (Bishop Ebo's rule)", () => {
    const msgs = planMessages(result, passed);
    const thanks = msgs.filter((m) => m.kind === "thank_you");
    // 3 registeredPaid + 2 paidUnregistered
    expect(thanks).toHaveLength(5);
    // the unregistered payer is thanked, not dropped
    const stranger = thanks.find((m) => m.partnerRef === "TXN2");
    expect(stranger).toBeDefined();
    expect(stranger!.sendable).toBe(true);
    // the bank artifact gets no message at all
    expect(msgs.find((m) => m.partnerRef === "TXN10")).toBeUndefined();
  });

  it("thanks a multi-payment unregistered giver ONCE, for the total (VIP when the total qualifies)", () => {
    const msgs = planMessages(result, passed);
    const strangers = msgs.filter((m) => m.to === "+233209999999");
    expect(strangers).toHaveLength(1);
    expect(strangers[0].body).toContain("105.50"); // 75.50 + 30.00, quoted as one gift total
    expect(strangers[0].body.toLowerCase()).toContain("generous"); // VIP tone: total >= 100 GHS
  });

  it("personalizes the thank-you with first name and amount", () => {
    const msgs = planMessages(result, passed);
    const kofi = msgs.find((m) => m.partnerRef === "reg_0")!;
    expect(kofi.kind).toBe("thank_you");
    expect(kofi.body).toContain("Kofi");
    expect(kofi.body).toContain("50");
    expect(kofi.to).toBe("+233244000002");
    expect(kofi.channel).toBe("whatsapp");
    expect(kofi.category).toBe("utility");
  });

  it("uses a warmer message for a VIP gift (>= 100 GHS)", () => {
    const msgs = planMessages(result, passed);
    const ama = msgs.find((m) => m.partnerRef === "reg_1")!;
    expect(ama.kind).toBe("thank_you");
    expect(ama.body.toLowerCase()).toContain("generous");
  });

  it("plans a message for an un-sendable payer but marks it not sendable", () => {
    const msgs = planMessages(result, passed);
    const yaa = msgs.find((m) => m.partnerRef === "reg_2")!;
    expect(yaa.to).toBeNull();
    expect(yaa.sendable).toBe(false);
  });

  it("falls back to a generic greeting when the payer has no name", () => {
    const msgs = planMessages(result, passed);
    const anon = msgs.find((m) => m.partnerRef === "TXN9")!;
    expect(anon.body).toContain("Friend");
  });

  it("sends a reminder to registered-unpaid ONLY once the due date has passed (event-driven)", () => {
    const afterDue = planMessages(result, passed).filter(
      (m) => m.kind === "reminder",
    );
    expect(afterDue).toHaveLength(1);
    expect(afterDue[0].partnerRef).toBe("reg_5");
    expect(afterDue[0].body).not.toMatch(/GHS\s*\d/); // no pledge amount to quote

    const beforeDue = planMessages(result, future).filter(
      (m) => m.kind === "reminder",
    );
    expect(beforeDue).toHaveLength(0);
  });
});
