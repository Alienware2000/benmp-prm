import { describe, it, expect, vi } from "vitest";
import {
  mapRegistrations,
  mapPayments,
  loadReconciliation,
  loadOptOuts,
  toSentMessageRows,
  recordSentMessages,
  type Fetcher,
  type Inserter,
} from "./db";

describe("db row -> domain mapping", () => {
  it("maps registrations, preferring phone_e164", () => {
    expect(
      mapRegistrations([{ id: "r1", full_name: "Kofi", phone_raw: "0244000001", phone_e164: "+233244000001" }]),
    ).toEqual([{ id: "r1", fullName: "Kofi", phone: "+233244000001" }]);
  });

  it("maps payments, coercing amount to a number", () => {
    expect(
      mapPayments([
        { reference: "TXN1", payer_name: "Ama", payer_phone_e164: "+233244000002", amount_minor: "5000", currency: "GHS", paid_at: "2026-07-10", status: "Successful" },
      ]),
    ).toEqual([
      { reference: "TXN1", payerName: "Ama", payerPhone: "+233244000002", amountMinor: 5000, currency: "GHS", paidAt: "2026-07-10" },
    ]);
  });
});

describe("loadReconciliation (injected fetcher, no network)", () => {
  it("reconciles registrations vs payments into the three buckets", async () => {
    const fetcher: Fetcher = (async (path: string) => {
      if (path.startsWith("registrations")) {
        return [
          { id: "r1", full_name: "Kofi", phone_raw: "0244000001", phone_e164: "+233244000001" },
          { id: "r2", full_name: "Ama", phone_raw: "0244000002", phone_e164: "+233244000002" },
        ];
      }
      return [
        { reference: "P1", payer_name: "Kofi", payer_phone_e164: "+233244000001", amount_minor: 5000, currency: "GHS", paid_at: "2026-07-10", status: "Successful" },
        { reference: "P2", payer_name: "Stranger", payer_phone_e164: "+233209999999", amount_minor: 7000, currency: "GHS", paid_at: "2026-07-10", status: "Successful" },
      ];
    }) as Fetcher;

    const result = await loadReconciliation(fetcher);
    expect(result.registeredPaid.map((x) => x.registration.fullName)).toEqual(["Kofi"]);
    expect(result.registeredPaid[0].totalMinor).toBe(5000);
    expect(result.paidUnregistered).toHaveLength(1); // Stranger (Bishop Ebo)
    expect(result.paidUnregistered[0].suggestedName).toBe("Stranger");
    expect(result.registeredUnpaid.map((r) => r.fullName)).toEqual(["Ama"]);
  });
});

describe("loadOptOuts (injected fetcher, no network)", () => {
  it("returns the opted-out phones as a set, dropping null rows", async () => {
    const fetcher: Fetcher = (async () => [
      { phone_e164: "+233244000001" },
      { phone_e164: null },
      { phone_e164: "+233209999999" },
    ]) as Fetcher;
    expect(await loadOptOuts(fetcher)).toEqual(new Set(["+233244000001", "+233209999999"]));
  });

  it("returns an empty set when the table is empty", async () => {
    const fetcher: Fetcher = (async () => []) as Fetcher;
    expect(await loadOptOuts(fetcher)).toEqual(new Set());
  });
});

describe("sent_messages audit trail", () => {
  const messages = [
    { partnerRef: "reg_0", kind: "thank_you", to: "+233244000001", body: "Hi Kofi, thank you." },
    { partnerRef: "reg_5", kind: "reminder", to: null, body: "Hi Late, reminder." },
  ];
  const outcomes = [
    { status: "queued", providerMessageId: "SM123" },
    { status: "skipped", reason: "no phone" },
  ];

  it("zips planned messages with outcomes into audit rows", () => {
    expect(toSentMessageRows(messages, outcomes)).toEqual([
      { partner_ref: "reg_0", kind: "thank_you", to_phone: "+233244000001", body: "Hi Kofi, thank you.", status: "queued", reason: null, provider_message_id: "SM123" },
      { partner_ref: "reg_5", kind: "reminder", to_phone: null, body: "Hi Late, reminder.", status: "skipped", reason: "no phone", provider_message_id: null },
    ]);
  });

  it("recordSentMessages inserts via the injected inserter", async () => {
    const inserter = vi.fn(async () => {}) as Inserter;
    expect(await recordSentMessages(toSentMessageRows(messages, outcomes), inserter)).toBe(true);
    expect(inserter).toHaveBeenCalledWith("sent_messages", expect.arrayContaining([expect.objectContaining({ partner_ref: "reg_0" })]));
  });

  it("an audit failure returns false, never throws (send result must survive)", async () => {
    const inserter: Inserter = async () => { throw new Error("db down"); };
    expect(await recordSentMessages(toSentMessageRows(messages, outcomes), inserter)).toBe(false);
  });

  it("skips the insert entirely for an empty send", async () => {
    const inserter = vi.fn(async () => {}) as Inserter;
    expect(await recordSentMessages([], inserter)).toBe(true);
    expect(inserter).not.toHaveBeenCalled();
  });
});
