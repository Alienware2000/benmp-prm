// src/lib/poc/statement-parse.ts
// One entry point from an uploaded statement file to normalized payment rows,
// shared by the staff upload route and scripts/ingest-statements.ts. Spreadsheet
// sources find their header row wherever it is (exports often put a title row or
// account block above it); bank PDFs go through the per-bank parsers.
import { readPdfLines } from "../pdf-lines";
import { readSheetGrid, readSheetRows } from "../spreadsheet-rows";
import {
  parseFidelityPdf,
  parseMomoWalletGrid,
  parseStanbicPdf,
  parseStanbicSheet,
  parseZenithPdf,
} from "./bank-statements";
import {
  parseEcobankRows,
  parseMomoRows,
  parsePaystackOnetimeRows,
  parsePaystackRecurringRows,
  type PaymentParseResult,
  type PaymentSource,
} from "./payment-upload";

/** Columns that identify each sheet layout's header row. */
const REQUIRED_HEADERS = {
  momo: ["Id", "Date", "Status", "Amount"],
  ecobank: ["Narration", "VALUE_DATE", "Credit"],
  paystack_onetime: ["Reference", "Transaction Date", "Status", "Amount Paid"],
  paystack_recurring: ["Subscription code", "Subscription status"],
} as const;

export function isPdfFile(buffer: ArrayBuffer): boolean {
  const head = new Uint8Array(buffer.slice(0, 5));
  return String.fromCharCode(...head) === "%PDF-";
}

function requirePdf(source: PaymentSource, buffer: ArrayBuffer): void {
  if (!isPdfFile(buffer))
    throw new Error(`${source} statements are read from the bank's PDF.`);
}

export async function parseStatementFile(
  source: PaymentSource,
  filename: string,
  buffer: ArrayBuffer,
): Promise<PaymentParseResult> {
  switch (source) {
    case "momo": {
      // MTN's Excel export keeps the transactions on a sheet named "ReportSheet".
      try {
        return parseMomoRows(
          readSheetRows(filename, buffer, "ReportSheet", [
            ...REQUIRED_HEADERS.momo,
          ]),
        );
      } catch (error) {
        // A single-wallet export has no header row at all.
        const wallet = parseMomoWalletGrid(readSheetGrid(filename, buffer));
        if (wallet.rows.length > 0 || wallet.rejects.length > 0) return wallet;
        throw error;
      }
    }
    case "ecobank":
      return parseEcobankRows(
        readSheetRows(filename, buffer, undefined, [
          ...REQUIRED_HEADERS.ecobank,
        ]),
      );
    case "paystack_onetime":
      return parsePaystackOnetimeRows(
        readSheetRows(filename, buffer, undefined, [
          ...REQUIRED_HEADERS.paystack_onetime,
        ]),
      );
    case "paystack_recurring":
      return parsePaystackRecurringRows(
        readSheetRows(filename, buffer, undefined, [
          ...REQUIRED_HEADERS.paystack_recurring,
        ]),
      );
    case "stanbic":
      return isPdfFile(buffer)
        ? parseStanbicPdf(await readPdfLines(buffer))
        : parseStanbicSheet(readSheetGrid(filename, buffer));
    case "zenith":
      requirePdf(source, buffer);
      return parseZenithPdf(await readPdfLines(buffer));
    case "fidelity":
      requirePdf(source, buffer);
      return parseFidelityPdf(await readPdfLines(buffer));
  }
}
