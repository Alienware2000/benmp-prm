import { describe, expect, it } from "vitest";
import {
  buildChurchMemberView,
  type ChurchMemberInput,
} from "./church-members";

const pay = (
  partner_id: string,
  paid_at: string,
  amount_minor: number,
  payment_method: string | null = "mobile_money",
  raw_source: string | null = null,
) => ({
  partner_id,
  paid_at,
  amount_minor,
  payment_method,
  raw_method: null,
  raw_source,
});

const input: ChurchMemberInput = {
  church: { id: "c1", name: "Bethel", leader_name: "Ps Ama", hub_id: "h1" },
  partners: [
    {
      id: "p-ama",
      full_name: "Ama Mensah",
      momo_phone_number: "+233244000001",
      whatsapp_number: null,
    },
    {
      id: "p-kofi",
      full_name: "Kofi Boateng",
      momo_phone_number: null,
      whatsapp_number: "+233200000002",
    },
    {
      id: "p-yaw",
      full_name: "Yaw Owusu",
      momo_phone_number: null,
      whatsapp_number: null,
    },
  ],
  payments: [
    pay("p-ama", "2026-09-03T10:00:00Z", 5000),
    pay("p-ama", "2026-10-03T10:00:00Z", 5000),
    pay("p-ama", "2026-10-20T10:00:00Z", 2500, null, "ecobank"),
    pay("p-kofi", "2026-10-05T10:00:00Z", 20000, "paystack_card"),
    // Promoted cash is the church's, reported on the form: not a member figure.
    pay("p-kofi", "2026-10-06T10:00:00Z", 99900, "cash"),
    // Outside the window.
    pay("p-kofi", "2026-07-31T10:00:00Z", 1000),
    // Not this church's member.
    pay("p-other", "2026-10-05T10:00:00Z", 7000),
  ],
  forms: [
    {
      reporting_month: "2026-10-01",
      total_cash_minor: 30000,
      submitted_at: "2026-11-02T09:00:00Z",
      total_registered: 40,
      active_partners: 30,
      new_registrations: 2,
      lapsed: 1,
    },
  ],
};

describe("buildChurchMemberView", () => {
  const view = buildChurchMemberView(input, ["2026-08", "2026-09", "2026-10"]);

  it("gives each member their statement giving per month, biggest giver first", () => {
    expect(view.members.map((m) => [m.name, m.byMonth, m.totalMinor])).toEqual([
      ["Kofi Boateng", { "2026-08": 0, "2026-09": 0, "2026-10": 20000 }, 20000],
      ["Ama Mensah", { "2026-08": 0, "2026-09": 5000, "2026-10": 7500 }, 12500],
      ["Yaw Owusu", { "2026-08": 0, "2026-09": 0, "2026-10": 0 }, 0],
    ]);
    expect(view.members[1].phone).toBe("+233244000001");
    expect(view.members[1].lastGiftAt).toBe("2026-10-20T10:00:00Z");
  });

  it("totals each month and counts who gave", () => {
    expect(view.monthTotals).toEqual({
      "2026-08": 0,
      "2026-09": 5000,
      "2026-10": 27500,
    });
    expect(view.giversByMonth).toEqual({
      "2026-08": 0,
      "2026-09": 1,
      "2026-10": 2,
    });
    expect(view.totalMinor).toBe(32500);
    expect(view.givingMembers).toBe(2);
  });

  it("puts the church's form (cash and four numbers) on its month, null where not submitted", () => {
    expect(view.formByMonth["2026-09"]).toBeNull();
    expect(view.formByMonth["2026-10"]).toEqual({
      submittedAt: "2026-11-02T09:00:00Z",
      cashMinor: 30000,
      counts: {
        totalRegistered: 40,
        activePartners: 30,
        newRegistrations: 2,
        lapsed: 1,
      },
    });
  });
});
