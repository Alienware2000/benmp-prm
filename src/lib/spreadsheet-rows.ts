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

/** CSV or Excel, detected from the file's bytes (extension as fallback). */
export function readSheetRows(
  filename: string,
  buffer: ArrayBuffer,
  preferredSheet?: string,
): SheetRow[] {
  return isSpreadsheetFile(filename, buffer)
    ? parseWorkbook(Buffer.from(buffer), preferredSheet)
    : parseCsv(new TextDecoder().decode(buffer));
}
