// src/lib/cash/giver-file.ts
// Turns the rows of a branch's uploaded giver sheet (CSV or Excel) into giver rows.
// Branches build these sheets by hand, so headers are matched loosely ("Phone No.",
// "Amount (GHS)", "Receipt #") and a trailing "Total" line is ignored rather than
// counted as a giver.
import { parseAmountToMinor } from "../ingest";
import type { SheetRow } from "../spreadsheet-rows";
import type { GiverRowInput } from "./validation";

/** Columns of the downloadable template, in order. */
export const GIVER_TEMPLATE_HEADERS = [
  "Name",
  "Phone",
  "Amount (GHS)",
  "Receipt No",
] as const;

const ALIASES: Record<keyof GiverRowInput, string[]> = {
  name: ["name", "fullname", "givername", "giver", "partnername", "partner"],
  phone: [
    "phone",
    "phoneno",
    "phonenumber",
    "mobile",
    "mobilenumber",
    "contact",
    "telephone",
    "tel",
    "number",
  ],
  amountMinor: [
    "amount",
    "amountghs",
    "amountgh",
    "ghs",
    "cedis",
    "amountcedis",
    "cash",
  ],
  transactionRef: [
    "receiptno",
    "receipt",
    "receiptnumber",
    "ref",
    "reference",
    "transactionref",
    "refno",
  ],
};

const headerKey = (header: string) =>
  header.toLowerCase().replace(/[^a-z]/g, "");

function findColumn(
  headers: string[],
  field: keyof GiverRowInput,
): string | null {
  for (const alias of ALIASES[field]) {
    const match = headers.find((header) => headerKey(header) === alias);
    if (match) return match;
  }
  return null;
}

export type GiverFileResult = {
  givers: GiverRowInput[];
  /** Problems a branch can fix in its sheet, with the spreadsheet row number. */
  errors: string[];
};

export function parseCashGiverRows(rows: SheetRow[]): GiverFileResult {
  const headers = Object.keys(rows[0] ?? {});
  const columns = {
    name: findColumn(headers, "name"),
    phone: findColumn(headers, "phone"),
    amount: findColumn(headers, "amountMinor"),
    ref: findColumn(headers, "transactionRef"),
  };
  if (rows.length === 0)
    return { givers: [], errors: ["The file has no giver rows."] };
  if (!columns.amount) {
    return {
      givers: [],
      errors: [
        "No amount column found. Use the template headers: Name, Phone, Amount (GHS), Receipt No.",
      ],
    };
  }
  if (!columns.name && !columns.phone) {
    return {
      givers: [],
      errors: [
        "No Name or Phone column found. Use the template headers: Name, Phone, Amount (GHS), Receipt No.",
      ],
    };
  }

  const givers: GiverRowInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const sheetRow = index + 2; // row 1 is the header
    const cell = (column: string | null) =>
      column ? String(row[column] ?? "").trim() : "";
    const name = cell(columns.name);
    const phone = cell(columns.phone);
    const amountRaw = cell(columns.amount);
    const transactionRef = cell(columns.ref);

    if (!name && !phone && !amountRaw && !transactionRef) return; // blank line
    if (/^(grand\s*)?total:?$/i.test(name) && !phone) return; // summary line

    const amountMinor = parseAmountToMinor(amountRaw);
    if (amountMinor == null || amountMinor <= 0) {
      errors.push(
        `Row ${sheetRow}: amount "${amountRaw}" is not a valid amount above zero.`,
      );
      return;
    }
    if (name.length < 2 && !phone) {
      errors.push(`Row ${sheetRow}: needs a name or a phone number.`);
      return;
    }
    givers.push({ name, phone, amountMinor, transactionRef });
  });

  if (givers.length === 0 && errors.length === 0)
    errors.push("The file has no giver rows.");
  return { givers, errors };
}
