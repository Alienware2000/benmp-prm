// src/lib/spreadsheet-rows.ts
// Read an uploaded CSV or Excel file into header-keyed rows. Shared by the staff
// statement uploader and the public cash form, so both accept the same files.
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { isSpreadsheetFile } from "./poc/statement-file";

export type SheetRow = Record<string, string>;

export function parseCsv(text: string): SheetRow[] {
  const parsed = Papa.parse<SheetRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => String(value ?? "").trim(),
  });
  if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message);
  return parsed.data;
}

/** First sheet, or `preferredSheet` when the workbook has one by that name. */
export function parseWorkbook(
  buffer: Buffer,
  preferredSheet?: string,
): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName =
    preferredSheet && workbook.SheetNames.includes(preferredSheet)
      ? preferredSheet
      : workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });
}

/** Every cell as display text, no header handling. CSV or Excel, as `readSheetRows`. */
export function readSheetGrid(
  filename: string,
  buffer: ArrayBuffer,
  preferredSheet?: string,
): string[][] {
  if (!isSpreadsheetFile(filename, buffer)) {
    const parsed = Papa.parse<string[]>(new TextDecoder().decode(buffer), {
      header: false,
      skipEmptyLines: true,
    });
    return parsed.data.map((row) => row.map((value) => String(value ?? "").trim()));
  }
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: false });
  const sheetName =
    preferredSheet && workbook.SheetNames.includes(preferredSheet)
      ? preferredSheet
      : workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");
  return XLSX.utils
    .sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false })
    .map((row) => row.map((value) => String(value ?? "").trim()));
}

/**
 * Header-keyed rows from a grid whose header is not necessarily the first row:
 * exports often put a title or account block above it (MTN's Excel export starts
 * with the file name, Stanbic with the account details). The header is the first
 * row holding every `requiredHeaders` name; repeated names get `_1`, `_2`
 * suffixes, as SheetJS does. Rows after it with no values are dropped.
 */
export function rowsFromGrid(grid: string[][], requiredHeaders: string[]): SheetRow[] {
  const headerIndex = grid.findIndex((row) => {
    const names = new Set(row.map((cell) => cell.trim()));
    return requiredHeaders.every((header) => names.has(header));
  });
  if (headerIndex === -1) {
    throw new Error(`No header row with ${requiredHeaders.join(", ")} found.`);
  }
  const seen = new Map<string, number>();
  const headers = grid[headerIndex].map((cell) => {
    const name = cell.trim();
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count}`;
  });
  return grid
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => Object.fromEntries(headers.map((name, i) => [name, (row[i] ?? "").trim()])));
}

/**
 * CSV or Excel, detected from the file's bytes (extension as fallback). With
 * `requiredHeaders`, the header row is located rather than assumed to be first.
 */
export function readSheetRows(
  filename: string,
  buffer: ArrayBuffer,
  preferredSheet?: string,
  requiredHeaders?: string[],
): SheetRow[] {
  if (requiredHeaders) {
    return rowsFromGrid(readSheetGrid(filename, buffer, preferredSheet), requiredHeaders);
  }
  return isSpreadsheetFile(filename, buffer)
    ? parseWorkbook(Buffer.from(buffer), preferredSheet)
    : parseCsv(new TextDecoder().decode(buffer));
}
