import { describe, expect, it } from "vitest";
import { planAcceptAll, type AcceptAllReviewRow } from "./accept-all";
import type { NormalizedPaymentRow, PartnerForPaymentMatch } from "./payment-upload";

const partner = (id: string, fullName: string, momo: string | null = null): PartnerForPaymentMatch => ({
  id,
  fullName,
  momoPhoneNumber: momo,
  whatsappNumber: null,
  church: "Unlisted",
  country: "Ghana",
});

let seq = 0;
const review = (
  payerName: string | null,
  payerPhoneOrAccount: string | null,
  source: NormalizedPaymentRow["source"] = "momo",
): AcceptAllReviewRow => {
  seq += 1;
  return {
    id: `r${seq}`,
    row: {
      source,
      sourceRowId: `s${seq}`,
      transactionDate: "2026-09-01T00:00:00.000Z",
      amountMinor: 1000,
      currency: "GHS",
      payerName,
      payerPhoneOrAccount,
      providerReference: `p${seq}`,
      rawRow: {},
    },
  };
};

const target = (plan: ReturnType<typeof planAcceptAll>, id: string) => {
  const a = plan.assignments.find((x) => x.reviewRowId === id)!;
  return "partnerId" in a ? a.partnerId : a.newPartnerKey;
};

describe("planAcceptAll", () => {
  it("links a row to the existing partner with the same phone, in any format", () => {
    const r = review("Someone Else", "0244123456");
    const plan = planAcceptAll([r], [partner("p1", "Ama Owusu", "+233244123456")]);
    expect(target(plan, r.id)).toBe("p1");
    expect(plan.newPartners).toEqual([]);
  });

  it("never links by name when the phones differ (Decision 0028)", () => {
    const r = review("Ama Owusu", "0244999999");
    const plan = planAcceptAll([r], [partner("p1", "Ama Owusu", "+233244123456")]);
    expect(target(plan, r.id)).toBe("phone:244999999");
    expect(plan.newPartners).toEqual([
      { key: "phone:244999999", name: "Ama Owusu", phone: "+233244999999", country: "Ghana" },
    ]);
  });

  it("groups several payments from one new phone into a single new partner", () => {
    const a = review("Kofi Mensah", "0244555555");
    const b = review("KOFI MENSAH", "+233244555555");
    const plan = planAcceptAll([a, b], []);
    expect(plan.newPartners).toHaveLength(1);
    expect(target(plan, a.id)).toBe(target(plan, b.id));
  });

  it("keeps two new givers with the same name but different phones apart", () => {
    const a = review("Kofi Mensah", "0244555555");
    const b = review("Kofi Mensah", "0244666666");
    const plan = planAcceptAll([a, b], []);
    expect(plan.newPartners).toHaveLength(2);
  });

  it("links a phoneless bank row by name only when exactly one partner has it", () => {
    const unique = review("Yaw Boateng", null, "ecobank");
    const dup = review("Ama Owusu", null, "ecobank");
    const plan = planAcceptAll(
      [unique, dup],
      [partner("p1", "Yaw  Boateng"), partner("p2", "Ama Owusu"), partner("p3", "ama owusu")],
    );
    expect(target(plan, unique.id)).toBe("p1");
    expect(target(plan, dup.id)).toBe("name:ama owusu");
    expect(plan.newPartners[0]).toMatchObject({ name: "Ama Owusu", phone: null, country: "Ghana" });
  });

  it("assigns Paystack-only givers country Unknown", () => {
    const r = review("Card Giver", null, "paystack_onetime");
    expect(planAcceptAll([r], []).newPartners[0].country).toBe("Unknown");
  });

  it("does not pool rows that have neither name nor phone", () => {
    const a = review(null, null, "ecobank");
    const b = review("  ", null, "ecobank");
    const plan = planAcceptAll([a, b], []);
    expect(plan.newPartners.map((p) => p.name)).toEqual(["Unknown Giver", "Unknown Giver"]);
    expect(target(plan, a.id)).not.toBe(target(plan, b.id));
  });
});
