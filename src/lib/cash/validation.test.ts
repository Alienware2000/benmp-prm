import { describe, expect, it } from "vitest";
import {
  parseReportingMonth,
  validateGiverRow,
  validateDeposits,
  validateGiverRows,
  validateSummaryCounts,
  type DepositInput,
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
  it("rejects zero amounts", () => {
    const row: GiverRowInput = { name: "Test", phone: "", amountMinor: 0, transactionRef: "" };
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
describe("validateDeposits", () => {
  const today = new Date("2026-10-14T12:00:00Z");
  const deposit = (over: Partial<DepositInput> = {}): DepositInput => ({
    transactionId: "MP261005.1234.A56789",
    channel: "momo",
    amountMinor: 50000,
    depositedOn: "2026-10-05",
    ...over,
  });

  it("accepts a valid deposit", () => {
    expect(validateDeposits([deposit()], "2026-10-01", today)).toEqual({ ok: true });
  });
  it("allows no deposits: cash transactions are optional", () => {
    expect(validateDeposits([], "2026-10-01", today)).toEqual({ ok: true });
  });
  it("rejects the same transaction ID twice, ignoring case and spaces", () => {
    const result = validateDeposits([deposit(), deposit({ transactionId: "mp261005.1234. a56789" })], "2026-10-01", today);
    expect(result).toEqual({ ok: false, error: 'Transaction 2: transaction ID "mp261005.1234. a56789" is listed twice.' });
  });
  it("rejects short IDs, bad channels, and non-positive amounts", () => {
    expect(validateDeposits([deposit({ transactionId: "12" })], "2026-10-01", today).ok).toBe(false);
    expect(validateDeposits([deposit({ channel: "cheque" as DepositInput["channel"] })], "2026-10-01", today).ok).toBe(false);
    expect(validateDeposits([deposit({ amountMinor: 0 })], "2026-10-01", today).ok).toBe(false);
  });
  it("allows a deposit after the month closes but not before it starts or in the future", () => {
    expect(validateDeposits([deposit({ depositedOn: "2026-10-03" })], "2026-09-01", today).ok).toBe(true);
    expect(validateDeposits([deposit({ depositedOn: "2026-08-31" })], "2026-09-01", today).ok).toBe(false);
    expect(validateDeposits([deposit({ depositedOn: "2026-10-15" })], "2026-10-01", today).ok).toBe(false);
  });
});

describe("validateSummaryCounts", () => {
  const full = { totalRegistered: 120, activePartners: 80, newRegistrations: 5, lapsed: 3 };
  it("accepts four whole numbers, zero included", () => {
    expect(validateSummaryCounts(full)).toEqual({ ok: true });
    expect(validateSummaryCounts({ ...full, lapsed: 0 })).toEqual({ ok: true });
  });
  it("requires every number: the summary is the compulsory part of the form", () => {
    expect(validateSummaryCounts({ ...full, activePartners: null })).toEqual({
      ok: false,
      error: 'Fill in "Active partners" in the monthly summary.',
    });
  });
  it("rejects negatives and fractions", () => {
    expect(validateSummaryCounts({ ...full, lapsed: -1 }).ok).toBe(false);
    expect(validateSummaryCounts({ ...full, newRegistrations: 2.5 }).ok).toBe(false);
  });
});
