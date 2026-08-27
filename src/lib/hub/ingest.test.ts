import { describe, expect, it } from "vitest";
import {
  extractCandidates,
  parseCsv,
  validateCandidates,
  validateName,
  type CandidateRow,
  type ValidationContext,
} from "./ingest";

const churches: ValidationContext["churches"] = [
  { id: "c-agona", name: "Agona Nkwanta", nameKey: "AGONA NKWANTA" },
  { id: "c-acc", name: "ACC", nameKey: "ACC" },
];

const ctx = (
  existing: Record<string, { hubNumber: number | null }> = {},
): ValidationContext => ({
  churches,
  existingPhones: new Map(Object.entries(existing)),
});

const cand = (over: Partial<CandidateRow>): CandidateRow => ({
  rowIndex: 2,
  raw: [],
  name: "Ama Mensah",
  momoPhone: "0244123456",
  whatsappPhone: "+233244123456",
  church: "Agona Nkwanta",
  ...over,
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and CRLF", () => {
    const rows = parseCsv('name,phone\r\n"Mensah, Ama","024""4"\nKofi,055\n\n');
    expect(rows).toEqual([
      ["name", "phone"],
      ['Mensah, Ama', '024"4'],
      ["Kofi", "055"],
    ]);
  });

  it("drops entirely empty rows", () => {
    expect(parseCsv("a,b\n,\n , \nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("extractCandidates", () => {
  const grid = [
    ["FULL NAME", "MOMO", "WHATSAPP", "CHURCH"],
    ["Ama Mensah", "0244123456", "+233244123456", "Agona Nkwanta"],
    ["", "", "", ""],
    ["Kofi Boateng", "0551234567", "+233551234567", "ACC"],
  ];

  it("skips the header and empty rows, keeps 1-based sheet row numbers", () => {
    const out = extractCandidates(
      grid,
      { name: 0, momoPhone: 1, whatsappPhone: 2, church: 3 },
      true,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ rowIndex: 2, name: "Ama Mensah" });
    expect(out[1]).toMatchObject({ rowIndex: 4, name: "Kofi Boateng" });
  });

  it("keeps the header row as data when hasHeader is false", () => {
    const out = extractCandidates(
      grid,
      { name: 0, momoPhone: 1, whatsappPhone: 2, church: 3 },
      false,
    );
    expect(out[0]).toMatchObject({ rowIndex: 1, name: "FULL NAME" });
  });
});

describe("validateName", () => {
  it("requires two real words", () => {
    expect(validateName("")).toMatch(/missing/);
    expect(validateName("Kwame")).toMatch(/two names/);
    expect(validateName("123 456")).toMatch(/two names/);
    expect(validateName("Ama Mensah")).toBeNull();
    expect(validateName("Nana Yaw K.")).toBeNull();
  });
});

describe("validateCandidates", () => {
  it("passes a fully clean row and resolves the church id", () => {
    const [row] = validateCandidates([cand({})], ctx());
    expect(row.issues).toEqual([]);
    expect(row.momoPhoneE164).toBe("+233244123456");
    expect(row.whatsappPhoneE164).toBe("+233244123456");
    expect(row.churchId).toBe("c-agona");
  });

  it("normalizes phone shapes: local, bare 9-digit (Excel-dropped zero), international", () => {
    const rows = validateCandidates(
      [
        cand({ momoPhone: "0244123456", whatsappPhone: "0244123456" }),
        cand({ momoPhone: "244123457", whatsappPhone: "+44 7700 900123" }),
        cand({ momoPhone: "0596123456", whatsappPhone: "+1 214 555 0123" }),
      ],
      ctx(),
    );
    expect(rows.map((r) => r.momoPhoneE164)).toEqual([
      "+233244123456",
      "+233244123457",
      "+233596123456",
    ]);
    expect(rows.map((r) => r.whatsappPhoneE164)).toEqual([
      "+233244123456",
      "+447700900123",
      "+12145550123",
    ]);
    expect(rows.every((r) => r.issues.length === 0)).toBe(true);
  });

  it("flags a missing or invalid Ghana MoMo phone", () => {
    const rows = validateCandidates(
      [
        cand({ momoPhone: "" }),
        cand({ momoPhone: "02441" }),
        cand({ momoPhone: "0302123456" }), // fixed line
        cand({ momoPhone: "+1 214 555 0123" }), // non-Ghana
      ],
      ctx(),
    );
    for (const r of rows) {
      expect(r.momoPhoneE164).toBeNull();
      expect(r.issues.some((i) => i.field === "momoPhone")).toBe(true);
    }
  });

  it("flags a missing or unparseable WhatsApp number", () => {
    const rows = validateCandidates(
      [cand({ whatsappPhone: "" }), cand({ whatsappPhone: "N/A" })],
      ctx(),
    );
    for (const r of rows) {
      expect(r.whatsappPhoneE164).toBeNull();
      expect(r.issues.some((i) => i.field === "whatsappPhone")).toBe(true);
    }
  });

  it("matches churches case- and whitespace-insensitively, flags unknown ones", () => {
    const rows = validateCandidates(
      [cand({ church: "  AGONA   NKWANTA " }), cand({ church: "Qodesh" })],
      ctx(),
    );
    expect(rows[0].churchId).toBe("c-agona");
    expect(rows[0].churchName).toBe("Agona Nkwanta");
    expect(rows[1].churchId).toBeNull();
    expect(rows[1].issues.some((i) => i.field === "church")).toBe(true);
  });

  it("flags an in-file duplicate name, not duplicate phone", () => {
    const rows = validateCandidates(
      [
        cand({ rowIndex: 2, name: "Ama Mensah", momoPhone: "0244123456" }),
        cand({ rowIndex: 5, name: "Ama Mensah", momoPhone: "0551234567" }),
      ],
      ctx(),
    );
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues[0]).toMatchObject({ field: "name" });
    expect(rows[1].issues[0].message).toMatch(/row 2/);
  });

  it("allows the same phone number for different names", () => {
    const rows = validateCandidates(
      [
        cand({ rowIndex: 2, name: "Ama Mensah", momoPhone: "0244123456" }),
        cand({ rowIndex: 5, name: "Kofi Boateng", momoPhone: "0244123456" }),
      ],
      ctx(),
    );
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues).toEqual([]);
  });

  it("flags a database duplicate on either phone, naming the hub when known", () => {
    const rows = validateCandidates(
      [
        cand({ momoPhone: "0244123456", whatsappPhone: "+233551234567" }),
        cand({ momoPhone: "0551234567", whatsappPhone: "+233244123456" }),
      ],
      ctx({
        "+233244123456": { hubNumber: 4 },
        "+233551234567": { hubNumber: null },
      }),
    );
    expect(rows[0].issues.length).toBeGreaterThan(0);
    expect(rows[1].issues.some((i) => i.message.includes("Hub 4"))).toBe(true);
  });

  it("a row can carry several issues at once", () => {
    const [row] = validateCandidates(
      [cand({ name: "Kwame", momoPhone: "12", church: "Nowhere" })],
      ctx(),
    );
    expect(row.issues.map((i) => i.field).sort()).toEqual([
      "church",
      "momoPhone",
      "name",
    ]);
  });
});
