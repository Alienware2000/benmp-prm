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
  phone: "0244123456",
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
    ["FULL NAME", "TEL", "CHURCH"],
    ["Ama Mensah", "0244123456", "Agona Nkwanta"],
    ["", "", ""],
    ["Kofi Boateng", "0551234567", "ACC"],
  ];

  it("skips the header and empty rows, keeps 1-based sheet row numbers", () => {
    const out = extractCandidates(grid, { name: 0, phone: 1, church: 2 }, true);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ rowIndex: 2, name: "Ama Mensah" });
    expect(out[1]).toMatchObject({ rowIndex: 4, name: "Kofi Boateng" });
  });

  it("keeps the header row as data when hasHeader is false", () => {
    const out = extractCandidates(grid, { name: 0, phone: 1, church: 2 }, false);
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
    expect(row.phoneE164).toBe("+233244123456");
    expect(row.churchId).toBe("c-agona");
  });

  it("normalizes phone shapes: local, bare 9-digit (Excel-dropped zero), international", () => {
    const rows = validateCandidates(
      [
        cand({ phone: "0244123456" }),
        cand({ phone: "244123457" }),
        cand({ phone: "+44 7700 900123" }),
      ],
      ctx(),
    );
    expect(rows.map((r) => r.phoneE164)).toEqual([
      "+233244123456",
      "+233244123457",
      "+447700900123",
    ]);
    expect(rows.every((r) => r.issues.length === 0)).toBe(true);
  });

  it("flags a too-short or garbage phone", () => {
    const rows = validateCandidates(
      [cand({ phone: "02441" }), cand({ phone: "N/A" })],
      ctx(),
    );
    for (const r of rows) {
      expect(r.phoneE164).toBeNull();
      expect(r.issues.some((i) => i.field === "phone")).toBe(true);
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

  it("flags an in-file duplicate against the first row that used the number", () => {
    const rows = validateCandidates(
      [
        cand({ rowIndex: 2, phone: "0244123456" }),
        cand({ rowIndex: 5, phone: "+233 244 123 456" }),
      ],
      ctx(),
    );
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues[0].message).toMatch(/row 2/);
  });

  it("flags a database duplicate, naming the hub when known", () => {
    const rows = validateCandidates(
      [cand({ phone: "0244123456" }), cand({ phone: "0551234567" })],
      ctx({
        "+233244123456": { hubNumber: 4 },
        "+233551234567": { hubNumber: null },
      }),
    );
    expect(rows[0].issues[0].message).toMatch(/Hub 4/);
    expect(rows[1].issues[0].message).toMatch(/already in the system\./);
  });

  it("a row can carry several issues at once", () => {
    const [row] = validateCandidates(
      [cand({ name: "Kwame", phone: "12", church: "Nowhere" })],
      ctx(),
    );
    expect(row.issues.map((i) => i.field).sort()).toEqual([
      "church",
      "name",
      "phone",
    ]);
  });
});
