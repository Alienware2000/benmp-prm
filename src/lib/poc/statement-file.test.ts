import { describe, expect, it } from "vitest";
import {
  contentTypeFor,
  isSpreadsheetFile,
  statementMonth,
  vaultObjectPath,
} from "./statement-file";

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0]).buffer;

describe("isSpreadsheetFile", () => {
  it("detects .xlsx by its zip signature regardless of name", () => {
    expect(isSpreadsheetFile("export.csv", bytes(0x50, 0x4b, 0x03, 0x04))).toBe(true);
  });

  it("detects legacy .xls by its OLE signature regardless of name", () => {
    expect(isSpreadsheetFile("statement", bytes(0xd0, 0xcf, 0x11, 0xe0))).toBe(true);
  });

  it("trusts an .xls/.xlsx extension for HTML-disguised bank exports", () => {
    expect(isSpreadsheetFile("ECOBANK SEP.xls", new TextEncoder().encode("<html>").buffer)).toBe(true);
    expect(isSpreadsheetFile("paystack.XLSX", new TextEncoder().encode("<html>").buffer)).toBe(true);
  });

  it("treats plain text with a .csv name as CSV", () => {
    expect(isSpreadsheetFile("mtn.csv", new TextEncoder().encode("Id,Date,Amount\n").buffer)).toBe(false);
  });
});

describe("statementMonth", () => {
  it("returns the month most rows fall in, ignoring a few carry-over days", () => {
    expect(
      statementMonth([
        { transactionDate: "2026-08-31T00:00:00.000Z" },
        { transactionDate: "2026-09-01T00:00:00.000Z" },
        { transactionDate: "2026-09-15T00:00:00.000Z" },
      ]),
    ).toBe("2026-09");
  });

  it("breaks ties toward the later month", () => {
    expect(
      statementMonth([
        { transactionDate: "2026-08-31T00:00:00.000Z" },
        { transactionDate: "2026-09-01T00:00:00.000Z" },
      ]),
    ).toBe("2026-09");
  });

  it("returns null when there are no rows", () => {
    expect(statementMonth([])).toBeNull();
  });
});

describe("vaultObjectPath", () => {
  const hash = "a".repeat(64);

  it("files by source and month, prefixed with the content hash", () => {
    expect(
      vaultObjectPath({ source: "momo", month: "2026-09", fileHash: hash, filename: "mtn sep.csv" }),
    ).toBe(`momo/2026-09/${hash}-mtn_sep.csv`);
  });

  it("strips unsafe characters and falls back when the month is unknown", () => {
    expect(
      vaultObjectPath({ source: "ecobank", month: null, fileHash: hash, filename: "../ECO/BANK (Sep).xls" }),
    ).toBe(`ecobank/undated/${hash}-ECO_BANK_Sep_.xls`);
  });

  it("uses a default name when the filename is empty", () => {
    expect(vaultObjectPath({ source: "paystack_onetime", month: "2026-09", fileHash: hash, filename: "" })).toBe(
      `paystack_onetime/2026-09/${hash}-statement`,
    );
  });
});

describe("contentTypeFor", () => {
  it("maps statement extensions to MIME types", () => {
    expect(contentTypeFor("a.csv")).toBe("text/csv");
    expect(contentTypeFor("a.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(contentTypeFor("a.xls")).toBe("application/vnd.ms-excel");
    expect(contentTypeFor("a")).toBe("application/octet-stream");
  });
});
