import { describe, expect, it } from "vitest";
import {
  isValidBatchNumber,
  legacyBatchRecipients,
  planLegacyBatches,
  type LegacyContact,
} from "./legacy-batches";

/** ids are zero-padded so localeCompare ordering matches numeric ordering. */
function contact(n: number, over: Partial<LegacyContact> = {}): LegacyContact {
  return {
    id: `id-${String(n).padStart(5, "0")}`,
    name: `Partner ${n}`,
    phone: `+2332000${String(n).padStart(5, "0")}`,
    branch: "—",
    country: "Ghana",
    givenMinor: 0,
    messageable: true,
    lastSentAt: null,
    smsSentAt: null,
    ...over,
  };
}

const many = (n: number) => Array.from({ length: n }, (_, i) => contact(i));

describe("planLegacyBatches", () => {
  it("splits the real-world shape into 6 batches (5 full + a remainder)", () => {
    const plan = planLegacyBatches(many(11_346));
    expect(plan.batches).toHaveLength(6);
    expect(plan.batches.map((b) => b.size)).toEqual([
      2000, 2000, 2000, 2000, 2000, 1346,
    ]);
    expect(plan.sendable).toBe(11_346);
  });

  it("excludes unusable phones from batching but still counts them", () => {
    const contacts = [
      ...many(10),
      contact(90, { messageable: false, phone: null }),
      contact(91, { messageable: false, phone: null }),
    ];
    const plan = planLegacyBatches(contacts, 5);
    expect(plan.totalContacts).toBe(12);
    expect(plan.sendable).toBe(10);
    expect(plan.unusablePhone).toBe(2);
    expect(plan.batches.map((b) => b.size)).toEqual([5, 5]);
  });

  it("reports per-batch progress", () => {
    const contacts = many(10).map((c, i) =>
      i < 3 ? { ...c, lastSentAt: "2026-08-30T00:00:00Z" } : c,
    );
    const plan = planLegacyBatches(contacts, 5);
    expect(plan.batches[0]).toMatchObject({
      number: 1,
      size: 5,
      alreadySent: 3,
      remaining: 2,
    });
    expect(plan.batches[1]).toMatchObject({ number: 2, alreadySent: 0 });
  });
});

describe("legacyBatchRecipients", () => {
  it("returns the members of that batch, in stable order", () => {
    const contacts = many(10);
    expect(legacyBatchRecipients(contacts, 2, 5).map((c) => c.id)).toEqual([
      "id-00005",
      "id-00006",
      "id-00007",
      "id-00008",
      "id-00009",
    ]);
  });

  it("is stable regardless of the order rows arrive in", () => {
    const forwards = many(10);
    const shuffled = [...forwards].reverse();
    expect(legacyBatchRecipients(shuffled, 1, 5).map((c) => c.id)).toEqual(
      legacyBatchRecipients(forwards, 1, 5).map((c) => c.id),
    );
  });

  it("skips contacts already sent to, without resliding the batches", () => {
    const contacts = many(10).map((c, i) =>
      i < 2 ? { ...c, lastSentAt: "2026-08-30T00:00:00Z" } : c,
    );
    // Batch 1 is still ids 0-4; the two sent ones are simply not re-messaged.
    expect(legacyBatchRecipients(contacts, 1, 5).map((c) => c.id)).toEqual([
      "id-00002",
      "id-00003",
      "id-00004",
    ]);
    // Batch 2 must NOT have absorbed anyone from batch 1.
    expect(legacyBatchRecipients(contacts, 2, 5).map((c) => c.id)).toEqual([
      "id-00005",
      "id-00006",
      "id-00007",
      "id-00008",
      "id-00009",
    ]);
  });

  it("previews a fully-sent batch as empty rather than as other people", () => {
    const contacts = many(10).map((c, i) =>
      i < 5 ? { ...c, lastSentAt: "2026-08-30T00:00:00Z" } : c,
    );
    expect(legacyBatchRecipients(contacts, 1, 5)).toEqual([]);
  });

  it("returns nothing for a batch number outside the plan", () => {
    expect(legacyBatchRecipients(many(10), 99, 5)).toEqual([]);
    expect(legacyBatchRecipients(many(10), 0, 5)).toEqual([]);
  });
});

describe("isValidBatchNumber", () => {
  const plan = planLegacyBatches(many(10), 5);

  it("accepts a batch in range", () => {
    expect(isValidBatchNumber(1, plan)).toBe(true);
    expect(isValidBatchNumber(2, plan)).toBe(true);
  });

  it("rejects out-of-range, non-integer and non-numeric input", () => {
    expect(isValidBatchNumber(0, plan)).toBe(false);
    expect(isValidBatchNumber(3, plan)).toBe(false);
    expect(isValidBatchNumber(1.5, plan)).toBe(false);
    expect(isValidBatchNumber("1", plan)).toBe(false);
    expect(isValidBatchNumber(null, plan)).toBe(false);
  });
});

describe("channel-aware send markers", () => {
  // The 2026-08-30 WhatsApp run marked 503 contacts. The SMS campaign is a separate
  // campaign on a separate channel and must still reach them — those sends came back
  // only "queued" before the Wali device disconnected, so delivery is not even certain.
  const contacts = many(10).map((c, i) =>
    i < 4 ? { ...c, lastSentAt: "2026-08-30T00:00:00Z" } : c,
  );

  it("excludes WhatsApp-sent contacts from a WhatsApp batch", () => {
    expect(legacyBatchRecipients(contacts, 1, 5, "whatsapp")).toHaveLength(1);
  });

  it("still sends SMS to contacts already messaged on WhatsApp", () => {
    expect(legacyBatchRecipients(contacts, 1, 5, "sms")).toHaveLength(5);
  });

  it("excludes SMS-sent contacts from a later SMS batch", () => {
    const afterSms = contacts.map((c, i) =>
      i < 2 ? { ...c, smsSentAt: "2026-09-01T00:00:00Z" } : c,
    );
    expect(legacyBatchRecipients(afterSms, 1, 5, "sms")).toHaveLength(3);
    // ...and the WhatsApp view is unaffected by the SMS run.
    expect(legacyBatchRecipients(afterSms, 1, 5, "whatsapp")).toHaveLength(1);
  });

  it("reports per-channel progress in the plan", () => {
    expect(planLegacyBatches(contacts, 5, "sms").batches[0]).toMatchObject({
      alreadySent: 0,
      remaining: 5,
    });
    expect(planLegacyBatches(contacts, 5, "whatsapp").batches[0]).toMatchObject(
      {
        alreadySent: 4,
        remaining: 1,
      },
    );
  });
});
