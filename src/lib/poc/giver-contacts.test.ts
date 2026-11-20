import { describe, expect, it } from "vitest";
import {
  buildGiverContacts,
  giverContactsCsv,
  giverContactsFilename,
  type GiverContactInput,
} from "./giver-contacts";

const pay = (
  partner_id: string | null,
  paid_at: string,
  amount_minor: number,
  payment_method: string | null = "mobile_money",
  payer_name: string | null = null,
  payer_phone_e164: string | null = null,
) => ({
  partner_id,
  payer_name,
  payer_phone_e164,
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
    },
    {
      id: "p2",
      full_name: "Kofi Boateng",
      momo_phone_number: "0551234567",
      whatsapp_number: null,
    },
    // The same person again under another record, same MoMo number.
    {
      id: "p2b",
      full_name: "KOFI BOATENG",
      momo_phone_number: "+233551234567",
      whatsapp_number: null,
    },
    {
      id: "p3",
      full_name: "=HYPERLINK(evil)",
      momo_phone_number: null,
      whatsapp_number: null,
    },
    {
      id: "p4",
      full_name: "Yaw Owusu",
      momo_phone_number: "0277000000",
      whatsapp_number: null,
    },
  ],
  payments: [
    pay("p1", "2026-10-02T10:00:00Z", 5000),
    pay("p1", "2026-10-20T10:00:00Z", 2500, "bank_transfer"),
    pay("p2", "2026-10-05T10:00:00Z", 10000, "paystack_card"),
    pay("p2b", "2026-10-09T10:00:00Z", 2000),
    pay("p3", "2026-10-07T10:00:00Z", 500),
    // Cash in the ledger is not statement giving.
    pay("p4", "2026-10-06T10:00:00Z", 3000, "cash"),
    // Another month.
    pay("p4", "2026-09-30T10:00:00Z", 1000),
    // Linked to no partner: still a giver, by the statement's name and number.
    pay(
      null,
      "2026-10-11T10:00:00Z",
      4000,
      "mobile_money",
      "ESI ARTHUR",
      "+233240000009",
    ),
    pay(
      null,
      "2026-10-12T10:00:00Z",
      1000,
      "mobile_money",
      "ESI ARTHUR",
      "+233240000009",
    ),
    // Same number as Ama's partner record: merges with her.
    pay(
      null,
      "2026-10-13T10:00:00Z",
      300,
      "mobile_money",
      "AMA M",
      "+233201111111",
    ),
  ],
};

describe("buildGiverContacts", () => {
  const contacts = buildGiverContacts(input, "2026-10");

  it("lists each statement giver once, linked or not, merging by phone", () => {
    expect(contacts).toEqual([
      { name: "=HYPERLINK(evil)", phone: "", givenMinor: 500, gifts: 1 },
      {
        name: "Ama Mensah",
        phone: "+233201111111",
        givenMinor: 7800,
        gifts: 3,
      },
      {
        name: "ESI ARTHUR",
        phone: "+233240000009",
        givenMinor: 5000,
        gifts: 2,
      },
      {
        name: "Kofi Boateng",
        phone: "+233551234567",
        givenMinor: 12000,
        gifts: 2,
      },
    ]);
  });

  it("leaves out cash ledger rows and other months", () => {
    expect(contacts.some((c) => c.name === "Yaw Owusu")).toBe(false);
  });
});

describe("giverContactsCsv", () => {
  it("writes broadcast-ready rows and neutralises formula-like names", () => {
    const csv = giverContactsCsv(buildGiverContacts(input, "2026-10"));
    expect(csv.startsWith("﻿Name,Phone,Given (GHS),Gifts\n")).toBe(true);
    expect(csv).toContain("'=HYPERLINK(evil),,5.00,1");
    expect(csv).toContain("Ama Mensah,+233201111111,78.00,3");
  });

  it("names the file after the month", () => {
    expect(giverContactsFilename("2026-10")).toBe("givers-2026-10.csv");
  });
});
