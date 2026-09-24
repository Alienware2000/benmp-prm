import { describe, expect, it } from "vitest";
import { buildDashboardTiles } from "./dashboard-metrics";

describe("buildDashboardTiles", () => {
  it("counts active partners from POC payments matched by last 9 Ghana digits", () => {
    const tiles = buildDashboardTiles({
      partners: [
        {
          id: "p1",
          country: "Ghana",
          last_contribution_date: null,
          momo_phone_number: "0244123456",
          whatsapp_number: null,
        },
        {
          id: "p2",
          country: "Ghana",
          last_contribution_date: null,
          momo_phone_number: "0200000000",
          whatsapp_number: null,
        },
      ],
      payments: [
        {
          reference: "momo:1",
          payer_phone_e164: "FRI:233244123456/MSISDN",
          amount_minor: 6000,
          currency: "GHS",
          paid_at: "2026-09-01T00:00:00.000Z",
          status: "Successful",
          raw_row: { _payment_method: "mobile_money" },
        },
      ],
    });

    expect(tiles.totalPartners).toBe(2);
    expect(tiles.activePartners).toBe(1);
    expect(tiles.cumulative.amountMinor).toBe(6000);
    expect(tiles.mostRecentMonth?.month).toBe("2026-09");
  });
  it("counts a persisted matched partner even when the payment phone is unavailable", () => {
    const tiles = buildDashboardTiles({
      partners: [
        {
          id: "p1",
          country: "Ghana",
          last_contribution_date: null,
          momo_phone_number: null,
          whatsapp_number: null,
        },
      ],
      payments: [
        {
          reference: "momo:2",
          payer_phone_e164: null,
          amount_minor: 6000,
          currency: "GHS",
          paid_at: "2026-09-01T00:00:00.000Z",
          status: "Successful",
          raw_row: { matched_partner_id: "p1" },
        },
      ],
    });

    expect(tiles.activePartners).toBe(1);
    expect(tiles.activeThisMonth).toBe(1);
    expect(tiles.activeThisYear).toBe(1);
  });
});
