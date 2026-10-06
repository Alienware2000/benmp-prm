import { describe, expect, it } from "vitest";
import {
  parseReportingMonth,
  validateGiverRow,
  validateGiverRows,
  type GiverRowInput,
} from "./validation";

describe("parseReportingMonth", () => {
  it("parses a valid YYYY-MM string to the first of the month", () => {
    expect(parseReportingMonth("2026-10")).toBe("2026-10-01");
  });
  it("rejects empty or malformed strings", () => {
    expect(parseReportingMonth("")).toBeNull();
    expect(parseReportingMonth("2026")).toBeNull();
    expect(parseReportingMonth("2026-13")).toBeNull();
    expect(parseReportingMonth("garbage")).toBeNull();
  });
  it("rejects future months", () => {
    const now = new Date();
    const futureYear = now.getFullYear() + 1;
    expect(parseReportingMonth(`${futureYear}-01`)).toBeNull();
  });
});

describe("validateGiverRow", () => {
  it("passes with a name and amount", () => {
    const row: GiverRowInput = { name: "Kofi Mensah", phone: "", amountMinor: 2000, transactionRef: "R001" };
    expect(validateGiverRow(row)).toEqual({ ok: true });
  });
  it("passes with phone but no name", () => {
    const row: GiverRowInput = { name: "", phone: "0244123456", amountMinor: 5000, transactionRef: "" };
    expect(validateGiverRow(row)).toEqual({ ok: true });
  });
  it("rejects when both name and phone are empty", () => {
    const row: GiverRowInput = { name: "", phone: "", amountMinor: 2000, transactionRef: "" };
    const result = validateGiverRow(row);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("identify");
  });
  it("rejects negative amounts", () => {
    const row: GiverRowInput = { name: "Test", phone: "", amountMinor: -100, transactionRef: "" };
    const result = validateGiverRow(row);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("amount");
  });
  it("rejects a name shorter than 2 characters when no phone", () => {
    const row: GiverRowInput = { name: "A", phone: "", amountMinor: 100, transactionRef: "" };
    const result = validateGiverRow(row);
    expect(result.ok).toBe(false);
  });
});

describe("validateGiverRows", () => {
  it("passes with valid rows", () => {
    const rows: GiverRowInput[] = [
      { name: "Kofi", phone: "", amountMinor: 2000, transactionRef: "R001" },
      { name: "Ama", phone: "0244123456", amountMinor: 5000, transactionRef: "" },
    ];
    expect(validateGiverRows(rows).ok).toBe(true);
  });
  it("rejects duplicate transaction refs within the payload", () => {
    const rows: GiverRowInput[] = [
      { name: "Kofi", phone: "", amountMinor: 2000, transactionRef: "R001" },
      { name: "Ama", phone: "", amountMinor: 5000, transactionRef: "R001" },
    ];
    const result = validateGiverRows(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("duplicate");
  });
  it("allows multiple rows with empty transaction refs", () => {
    const rows: GiverRowInput[] = [
      { name: "Kofi", phone: "", amountMinor: 2000, transactionRef: "" },
      { name: "Ama", phone: "", amountMinor: 5000, transactionRef: "" },
    ];
    expect(validateGiverRows(rows).ok).toBe(true);
  });
  it("rejects an empty giver list", () => {
    expect(validateGiverRows([]).ok).toBe(false);
  });
});