import { describe, expect, it } from "vitest";
import {
  buildGiverContacts,
  giverContactsCsv,
  giverContactsFilename,
  type GiverContactInput,
} from "./giver-contacts";

const pay = (
  partner_id: string,
  paid_at: string,
  amount_minor: number,
  payment_method: string | null = "mobile_money",
) => ({
  partner_id,
  paid_at,
  amount_minor,
  payment_method,
  raw_method: null,
  raw_source: null,
});

const input: GiverContactInput = {
  partners: [
    {
      id: "p1",
      full_name: "Ama Mensah",
      momo_phone_number: "0244123456",
      whatsapp_number: "+233201111111",
      church: "Bethel",
    },
    {
      id: "p2",
      full_name: "Kofi Boateng",
      momo_phone_number: "0551234567",
      whatsapp_number: null,
      church: "Agape",
    },
    {
      id: "p3",
      full_name: "Yaw Owusu",
      momo_phone_number: "0277000000",
      whatsapp_number: null,
      church: "Agape",
    },
  ],
  payments: [
    pay("p1", "2026-10-02T10:00:00Z", 5000),
    pay("p1", "2026-10-20T10:00:00Z", 2500, "bank_transfer"),
    pay("p2", "2026-10-05T10:00:00Z", 10000, "paystack_card"),
    // Promoted cash: already named on the form's giver list.
    pay("p3", "2026-10-06T10:00:00Z", 3000, "cash"),
    // Another month.
    pay("p3", "2026-09-30T10:00:00Z", 1000),
  ],
  cashGivers: [
    // Same person as p2 (MoMo number), gave cash too.
    {
      giver_name: "Kofi B.",
      giver_phone: "0551234567",
      amount_minor: 2000,
      church: "Agape",
    },
    {
      giver_name: "=HYPERLINK(evil)",
      giver_phone: "",
      amount_minor: 500,
      church: "Agape",
    },
  ],
};

describe("buildGiverContacts", () => {
  const contacts = buildGiverContacts(input, "2026-10");

  it("lists each giver once, by church then name, merging statement and cash by phone", () => {
    expect(contacts).toEqual([
      {
        name: "=HYPERLINK(evil)",
        phone: "",
        church: "Agape",
        givenMinor: 500,
        via: "Cash",
      },
      {
        name: "Kofi Boateng",
        phone: "+233551234567",
        church: "Agape",
        givenMinor: 12000,
        via: "Statement and cash",
      },
      {
        name: "Ama Mensah",
        phone: "+233201111111",
        church: "Bethel",
        givenMinor: 7500,
        via: "Statement",
      },
    ]);
  });

  it("leaves out people who only gave in another month", () => {
    expect(contacts.some((c) => c.name === "Yaw Owusu")).toBe(false);
  });
});

describe("giverContactsCsv", () => {
  it("writes broadcast-ready rows and neutralises formula-like names", () => {
    const csv = giverContactsCsv(buildGiverContacts(input, "2026-10"));
    expect(csv.startsWith("\uFEFFName,Phone,Church,Given (GHS),Gave by\n")).toBe(
      true,
    );
    expect(csv).toContain("'=HYPERLINK(evil),,Agape,5.00,Cash");
    expect(csv).toContain("Ama Mensah,+233201111111,Bethel,75.00,Statement");
  });

  it("names the file after the hub, church and month", () => {
    expect(giverContactsFilename(["1 — Takoradi", "Bogoso"], "2026-10")).toBe(
      "givers-1-takoradi-bogoso-2026-10.csv",
    );
  });
});
