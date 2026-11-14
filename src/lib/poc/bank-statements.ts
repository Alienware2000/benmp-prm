// src/lib/poc/bank-statements.ts
// Parsers for the bank statements that arrive as PDFs or free-layout sheets —
// Stanbic (Excel + PDF), Zenith (PDF), Fidelity (PDF) — and MTN's headerless
// single-wallet export. Each returns the same PaymentParseResult as the CSV
// parsers in payment-upload.ts, so matching and import are shared.
//
// Money safety: every statement prints a running balance. A row is a credit only
// when the balance rose by exactly its amount; any row whose amount and balance
// disagree rejects the whole file, as does a credit total that differs from the
// statement's own printed total. A layout change therefore fails loudly instead of
// importing wrong amounts.
import { normalizePhone } from "../phone";
import type { PdfLine } from "../pdf-lines";
import { rowsFromGrid } from "../spreadsheet-rows";
import type {
  NormalizedPaymentRow,
  PaymentParseResult,
  PaymentSource,
} from "./payment-upload";

const MONEY = /^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$/;
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** "1,234.50" → 123450. Only for strings already matched by MONEY (or plain numbers). */
function toMinor(raw: string): number {
  const [whole, frac = ""] = raw.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

function isMoney(text: string): boolean {
  return MONEY.test(text.trim());
}

/** dd-mm-yyyy, dd/mm/yyyy or dd-Mon-yyyy (optionally with a 12-hour time) → ISO. */
export function parseStatementDate(raw: string): string | null {
  const s = raw.trim();
  const numeric = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (numeric) {
    return new Date(
      Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1])),
    ).toISOString();
  }
  const named = s.match(
    /^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M))?$/i,
  );
  if (!named) return null;
  const month = MONTHS.indexOf(named[2].toLowerCase());
  if (month === -1) return null;
  let hour = Number(named[4] ?? 0);
  if (named[7]?.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (named[7]?.toUpperCase() === "AM" && hour === 12) hour = 0;
  return new Date(
    Date.UTC(
      Number(named[3]),
      month,
      Number(named[1]),
      hour,
      Number(named[5] ?? 0),
      Number(named[6] ?? 0),
    ),
  ).toISOString();
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const name = squash(raw)
    .replace(/[,;:#-]+$/, "")
    .trim();
  // A bare account number or reference is not a name.
  if (!name || /^[\d\s/-]+$/.test(name)) return null;
  return name;
}

/** First Ghana phone number in free text (0XXXXXXXXX or 233XXXXXXXXX), E.164. */
export function phoneInText(text: string): string | null {
  const match = text.match(/(?:^|\D)((?:233|0)[25]\d{8})(?!\d)/);
  return match ? normalizePhone(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Payer names, per bank
// ---------------------------------------------------------------------------

/**
 * Stanbic descriptions: "SI BO NAME SI BO NAME", "BO NAME SI BO NAME",
 * "CASH DEPOSIT NAME 0543653577 X11X111 DEPSL : 1", "NAME 233242828187 XX11X1X",
 * "HJC NAME", "TRF FROM NAME".
 */
export function stanbicPayerName(description: string): string | null {
  const text = squash(description);
  const bo = text.match(
    /^(?:S\/?I\s+)?B\/?O\s+(.+?)(?:\s+S\/?I\s+B\/?O\s+.*)?$/i,
  );
  if (bo) return cleanName(bo[1]);
  const withoutPrefix = text
    .replace(/^CASH DEPOSIT\s+/i, "")
    .replace(/^HJC\s+/i, "")
    .replace(/^(?:TRF|TFR|TRANSFER)\s+(?:FROM|FRM)\s+/i, "");
  const beforePhone = withoutPrefix.split(/\s(?:233|0)[25]\d{8}(?!\d)/)[0];
  return cleanName(beforePhone);
}

/**
 * Zenith particulars: "Recurring - TRF FROM NAME", "TRF FRM NAME", "TFR FROM NAME",
 * "S/O TRF FRM 9061103185" (account only), "NAME/6020607169",
 * "C2B- 016KEM D ENTERPRISE 026HEALING JESUS CA 965953640590".
 */
export function zenithPayerName(particulars: string): string | null {
  const text = squash(particulars).replace(/^Recurring\s*-\s*/i, "");
  const c2b = text.match(/^C2B-\s*\d{3}(.+?)\s*\d{3}HEALING/i);
  if (c2b) return cleanName(c2b[1]);
  const transfer = text.match(/(?:TRF|TFR|TRANSFER)\s+(?:FROM|FRM)\s+(.+)$/i);
  if (transfer) return cleanName(transfer[1]);
  return cleanName(text.split("/")[0]);
}

/**
 * Fidelity standing orders name the paying account holder in "Debit Ac.=<no> (NAME)";
 * that beats the free-text "B/O NAME", which staff type and often abbreviate.
 */
export function fidelityPayerName(description: string): string | null {
  const text = squash(description);
  const debit = text.match(/Debit\s+Ac\.?=\s*\d+\s*\(([^)]+)\)/i);
  if (debit) return cleanName(debit[1]);
  const bo = text.match(/B\/O\s+(.+?)(?:\s+IFO\b|\s+#|,|$)/i);
  return bo ? cleanName(bo[1]) : null;
}

// ---------------------------------------------------------------------------
// Shared: entries → checked credit rows
// ---------------------------------------------------------------------------

type Entry = {
  date: string;
  /** Amount printed on the row, in minor units. */
  amountMinor: number;
  /** Running balance after the row, in minor units; null when the row has none. */
  balanceMinor: number | null;
  /** Set when the layout has separate debit/credit columns (Stanbic Excel). */
  direction?: "credit" | "debit";
  description: string;
  payerName: string | null;
  payerPhone: string | null;
  page?: number;
};

/**
 * Decide credit/debit from the balance movement and refuse any row whose amount
 * doesn't explain it. `openingMinor` null skips the check for the first row only.
 */
function checkedCredits(
  source: PaymentSource,
  bank: string,
  account: string,
  entries: Entry[],
  openingMinor: number | null,
): PaymentParseResult {
  const rows: NormalizedPaymentRow[] = [];
  const skipped: PaymentParseResult["skipped"] = [];
  const occurrences = new Map<string, number>();
  let previous = openingMinor;

  entries.forEach((entry, index) => {
    let direction = entry.direction;
    if (previous != null && entry.balanceMinor != null) {
      const delta = entry.balanceMinor - previous;
      const fromBalance =
        delta === entry.amountMinor
          ? "credit"
          : delta === -entry.amountMinor
            ? "debit"
            : null;
      if (!fromBalance || (direction && direction !== fromBalance)) {
        throw new Error(
          `${bank} statement row ${index + 1} (${entry.date.slice(0, 10)}, ${entry.amountMinor / 100}) ` +
            `doesn't match the running balance; the layout may have changed. Nothing was imported.`,
        );
      }
      direction = fromBalance;
    }
    if (!direction)
      throw new Error(
        `${bank} statement row ${index + 1}: can't tell credit from debit.`,
      );
    if (entry.balanceMinor != null) previous = entry.balanceMinor;

    const rawRow: Record<string, string> = {
      Account: account,
      Date: entry.date.slice(0, 10),
      Description: entry.description,
      Amount: (entry.amountMinor / 100).toFixed(2),
      Direction: direction,
      Balance:
        entry.balanceMinor == null ? "" : (entry.balanceMinor / 100).toFixed(2),
      ...(entry.page ? { Page: String(entry.page) } : {}),
    };
    if (direction === "debit") {
      skipped.push({ index, reason: "debit", rawRow });
      return;
    }
    // Same day + amount + description can legitimately repeat (two identical
    // standing orders); the occurrence number keeps their references apart while
    // staying stable when the same period is exported again.
    const base = `${account}:${entry.date.slice(0, 10)}:${entry.amountMinor}:${squash(entry.description).slice(0, 80)}`;
    const nth = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, nth);
    const sourceRowId = nth === 1 ? base : `${base}#${nth}`;
    rows.push({
      source,
      sourceRowId,
      transactionDate: entry.date,
      amountMinor: entry.amountMinor,
      currency: "GHS",
      payerName: entry.payerName,
      payerPhoneOrAccount: entry.payerPhone,
      providerReference: sourceRowId,
      rawRow,
    });
  });
  return { rows, rejects: [], skipped };
}

/**
 * Compare parsed credits with the total the statement prints. A mismatch is a
 * warning, not an error: every row already reconciled with the running balance,
 * so the gap is in the bank's summary (e.g. a period that runs past the last
 * printed row) and finance should query it with the bank.
 */
function checkCreditTotal(
  bank: string,
  result: PaymentParseResult,
  printedMinor: number | null,
): void {
  if (printedMinor == null) return;
  const parsed = result.rows.reduce((sum, row) => sum + row.amountMinor, 0);
  if (parsed !== printedMinor) {
    result.warnings = [
      ...(result.warnings ?? []),
      `${bank}: the statement's credit total is ${(printedMinor / 100).toFixed(2)} but its transaction lines add up to ${(parsed / 100).toFixed(2)}. Every line matches the running balance; query the difference with the bank.`,
    ];
  }
}

// ---------------------------------------------------------------------------
// Stanbic Excel
// ---------------------------------------------------------------------------

/** Value right of the first cell equal to `label` whose neighbour passes `accept`. */
function gridValueAfter(
  grid: string[][],
  label: string,
  accept: RegExp = /\S/,
): string | null {
  for (const row of grid) {
    const i = row.findIndex(
      (cell, j) =>
        cell.trim().toLowerCase() === label.toLowerCase() &&
        accept.test(row[j + 1] ?? ""),
    );
    if (i !== -1) return row[i + 1].trim();
  }
  return null;
}

export function parseStanbicSheet(grid: string[][]): PaymentParseResult {
  const account = gridValueAfter(grid, "Account Number") ?? "";
  const rows = rowsFromGrid(grid, [
    "Transaction Date",
    "Transaction Description",
    "Credits",
    "Balance",
  ]);
  const entries: Entry[] = [];
  for (const row of rows) {
    const date = parseStatementDate(row["Transaction Date"] ?? "");
    if (!date) continue; // opening/brought-forward/closing lines and notes
    const credit = (row["Credits"] ?? "").trim();
    const debit = (row["Debits"] ?? "").trim();
    const amount = credit || debit;
    if (!amount) continue;
    const description = squash(row["Transaction Description"] ?? "");
    entries.push({
      date,
      amountMinor: toMinor(amount),
      balanceMinor: row["Balance"] ? toMinor(row["Balance"]) : null,
      direction: credit ? "credit" : "debit",
      description,
      payerName: stanbicPayerName(description),
      payerPhone: phoneInText(description),
      page: Number(row["Page"]) || undefined,
    });
  }
  // The sheet prints no opening balance figure, so the first row is checked by
  // its own Credits/Debits column and the printed credit total below.
  const result = checkedCredits("stanbic", "Stanbic", account, entries, null);
  // "Summary of Transactions" → "Credits | 10590" (not the "Credits" column header).
  const printed = gridValueAfter(grid, "Credits", /^\d[\d,]*(?:\.\d+)?$/);
  checkCreditTotal("Stanbic", result, printed ? toMinor(printed) : null);
  return result;
}

// ---------------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------------

function moneyFragments(line: PdfLine) {
  return line.fragments.filter((fragment) => isMoney(fragment.text));
}

/** Money value printed after `label` on the same line, e.g. "OPENING BALANCE: 4,062.38". */
function moneyAfterLabel(lines: PdfLine[], label: RegExp): number | null {
  const line = lines.find((candidate) => label.test(candidate.text));
  if (!line) return null;
  const money = moneyFragments(line);
  return money.length ? toMinor(money[money.length - 1].text) : null;
}

function requireLines(bank: string, lines: PdfLine[]): void {
  if (lines.length === 0) {
    throw new Error(
      `${bank} PDF has no text layer (scanned?). Ask the bank for a downloadable statement.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Stanbic PDF
// ---------------------------------------------------------------------------
// Row: "16-10-2026 16-10-2026 CASH DEPOSIT … 390.00 4,470.17", then the payer
// and deposit-slip details on the lines below, in the description column.

const DMY_DASH = /^\d{2}-\d{2}-\d{4}$/;

export function parseStanbicPdf(lines: PdfLine[]): PaymentParseResult {
  requireLines("Stanbic", lines);
  const accountLine = lines.find((line) =>
    /Account Number\s*:/i.test(line.text),
  );
  const account =
    accountLine?.text.match(/Account Number\s*:\s*(\d+)/i)?.[1] ?? "";
  const opening = moneyAfterLabel(lines, /STATEMENT OPENING BALANCE/i);

  const entries: Entry[] = [];
  lines.forEach((line, i) => {
    const [first, second] = line.fragments;
    if (
      !first ||
      !second ||
      !DMY_DASH.test(first.text) ||
      !DMY_DASH.test(second.text)
    )
      return;
    const money = moneyFragments(line);
    if (money.length < 2) return;
    const descriptionX = line.fragments[2]?.x ?? second.right;
    const head = line.fragments
      .slice(2)
      .filter((fragment) => !isMoney(fragment.text))
      .map((fragment) => fragment.text)
      .join(" ");
    const continuation: string[] = [];
    for (const next of lines.slice(i + 1)) {
      if (
        next.page !== line.page ||
        DMY_DASH.test(next.fragments[0]?.text ?? "")
      )
        break;
      if (
        Math.abs(next.fragments[0].x - descriptionX) > 6 ||
        /BALANCE/i.test(next.text)
      )
        break;
      continuation.push(
        next.fragments
          .filter((f) => !/#$/.test(f.text))
          .map((f) => f.text)
          .join(" "),
      );
    }
    const description = squash([head, ...continuation].join(" "));
    entries.push({
      date: parseStatementDate(first.text)!,
      amountMinor: toMinor(money[0].text),
      balanceMinor: toMinor(money[money.length - 1].text),
      description,
      // The line under "CASH DEPOSIT" / "TRF FROM …" is the depositor as captured
      // at the counter; prefer it to the head line's abbreviation.
      payerName:
        stanbicPayerName(continuation[0] ?? head) ?? stanbicPayerName(head),
      payerPhone: phoneInText(description),
      page: line.page,
    });
  });
  const result = checkedCredits(
    "stanbic",
    "Stanbic",
    account,
    entries,
    opening,
  );
  // "Summary of transactions … Credits 50.00" near the end.
  const printed = lines
    .map((line) => line.text.match(/\bCredits\s+([\d,]+\.\d{2})\b/)?.[1])
    .find(Boolean);
  checkCreditTotal("Stanbic", result, printed ? toMinor(printed) : null);
  return result;
}

// ---------------------------------------------------------------------------
// Zenith PDF
// ---------------------------------------------------------------------------
// Row: "dd/mm/yyyy PARTICULARS … amount valueDate balance". Long particulars wrap
// onto the line(s) ABOVE the dated line.

const DMY_SLASH = /^\d{2}\/\d{2}\/\d{4}/;

export function parseZenithPdf(lines: PdfLine[]): PaymentParseResult {
  requireLines("Zenith", lines);
  const account =
    lines
      .find((line) => /Account No:/i.test(line.text))
      ?.text.match(/Account No:\s*(\d+)/i)?.[1] ?? "";
  const headerIndex = lines.findIndex(
    (line) => /PARTICULARS/.test(line.text) && /BALANCE/.test(line.text),
  );
  if (headerIndex === -1)
    throw new Error(
      "Zenith statement header (DATE / PARTICULARS / BALANCE) not found.",
    );
  const opening = moneyAfterLabel(lines, /OPENING BALANCE/i);

  const entries: Entry[] = [];
  let pending: string[] = [];
  let totalsLine: PdfLine | null = null;
  for (const line of lines.slice(headerIndex + 1)) {
    if (/^TOTALS\b/.test(line.text)) {
      totalsLine = line;
      break;
    }
    if (/OPENING BALANCE/.test(line.text)) continue;
    const money = moneyFragments(line);
    const dated = DMY_SLASH.test(line.text);
    if (!dated || money.length < 2) {
      pending.push(line.text);
      continue;
    }
    const date = line.text.slice(0, 10);
    // The value date sits between amount and balance; it is never part of the particulars.
    const particulars = line.fragments
      .filter(
        (fragment) =>
          !isMoney(fragment.text) &&
          !/^\d{2}\/\d{2}\/\d{4}$/.test(fragment.text),
      )
      .map((fragment) => fragment.text)
      .join(" ")
      .replace(DMY_SLASH, "");
    const description = squash([...pending, particulars].join(" "));
    pending = [];
    entries.push({
      date: parseStatementDate(date)!,
      amountMinor: toMinor(money[0].text),
      balanceMinor: toMinor(money[money.length - 1].text),
      description,
      payerName: zenithPayerName(description),
      payerPhone: phoneInText(description),
      page: line.page,
    });
  }
  const result = checkedCredits("zenith", "Zenith", account, entries, opening);
  // TOTALS prints [debits, credits, closing] — debits may be absent.
  const totals = totalsLine
    ? moneyFragments(totalsLine).map((fragment) => toMinor(fragment.text))
    : [];
  if (totals.length >= 2)
    checkCreditTotal("Zenith", result, totals[totals.length - 2]);
  return result;
}

// ---------------------------------------------------------------------------
// Fidelity PDF
// ---------------------------------------------------------------------------
// A transaction is a block of 3–9 lines; its description wraps above AND below the
// line carrying value date / debit / credit / balance, and the transaction date
// floats a few points off that line. Blocks are separated by a wider vertical gap,
// and a block can continue at the top of the next page.

const DMY_NAMED = /^\d{2}-[A-Za-z]{3}-\d{4}$/;
/** Lines closer than this belong to the same transaction block. */
const FIDELITY_BLOCK_GAP = 13.5;

export function parseFidelityPdf(lines: PdfLine[]): PaymentParseResult {
  requireLines("Fidelity", lines);
  const headerIndex = lines.findIndex(
    (line) => /\bDESCRIPTION\b/.test(line.text) && /\bCREDIT\b/.test(line.text),
  );
  if (headerIndex === -1)
    throw new Error(
      "Fidelity statement header (DATE / DESCRIPTION / CREDIT) not found.",
    );
  const header = lines[headerIndex];
  const valueDateX =
    header.fragments.find((fragment) => /VALUE/.test(fragment.text))?.x ?? 270;
  const account =
    lines
      .slice(0, headerIndex)
      .flatMap((line) => line.fragments)
      .find((fragment) => /^\d{10,16}$/.test(fragment.text))?.text ?? "";
  const opening = moneyAfterLabel(lines, /OPENING BALANCE:/);
  const closing = moneyAfterLabel(lines, /CLOSING BALANCE:/);

  // Group into blocks by vertical gap; a block that opens a page continues the
  // previous page's last block.
  // Page furniture: the deposit-protection notice and the bare page number.
  const body = lines
    .slice(headerIndex + 1)
    .filter(
      (line) =>
        !/Deposit Protection|gdpc\.gov\.gh/i.test(line.text) &&
        !/^\d{1,3}$/.test(line.text),
    );
  const blocks: PdfLine[][] = [];
  body.forEach((line, i) => {
    const prev = body[i - 1];
    const samePage = prev && prev.page === line.page;
    if (samePage && prev.y - line.y <= FIDELITY_BLOCK_GAP)
      blocks[blocks.length - 1].push(line);
    else blocks.push([line]);
  });
  const isAnchor = (line: PdfLine) =>
    line.fragments.some(
      (fragment) =>
        fragment.x >= valueDateX - 5 && DMY_NAMED.test(fragment.text),
    ) && moneyFragments(line).length >= 1;
  const merged: PdfLine[][] = [];
  for (const block of blocks) {
    const previous = merged.at(-1);
    const opensPage =
      previous !== undefined && block[0].page !== previous.at(-1)!.page;
    if (opensPage && !block.some(isAnchor)) previous.push(...block);
    else merged.push(block);
  }

  const entries: Entry[] = [];
  for (const block of merged) {
    const anchors = block.filter(isAnchor);
    if (anchors.length === 0) continue; // page furniture
    if (anchors.length > 1) {
      throw new Error(
        `Fidelity statement: couldn't separate transactions near ${anchors[0].text.slice(0, 40)}.`,
      );
    }
    const anchor = anchors[0];
    const money = moneyFragments(anchor);
    const dateFragment = block
      .flatMap((line) => line.fragments)
      .find(
        (fragment) =>
          fragment.x < valueDateX - 50 && DMY_NAMED.test(fragment.text),
      );
    const description = squash(
      block
        .map((line) =>
          line.fragments
            .filter(
              (fragment) =>
                fragment.x < valueDateX - 5 && !DMY_NAMED.test(fragment.text),
            )
            .map((fragment) => fragment.text)
            .join(" "),
        )
        .join(" "),
    );
    entries.push({
      date:
        parseStatementDate(dateFragment?.text ?? "") ??
        parseStatementDate(
          anchor.fragments.find((fragment) => DMY_NAMED.test(fragment.text))!
            .text,
        )!,
      // [debit-or-credit, balance]; the other amount column prints "--".
      amountMinor: toMinor(money[0].text),
      balanceMinor:
        money.length >= 2 ? toMinor(money[money.length - 1].text) : null,
      description,
      payerName: fidelityPayerName(description),
      // Fidelity rows carry bank account numbers, never phones.
      payerPhone: null,
      page: anchor.page,
    });
  }
  const result = checkedCredits(
    "fidelity",
    "Fidelity",
    account,
    entries,
    opening,
  );
  const last = entries.at(-1)?.balanceMinor;
  if (closing != null && last != null && last !== closing) {
    throw new Error(
      `Fidelity statement ends at ${last / 100} but prints closing balance ${closing / 100}. Nothing was imported.`,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// MTN single-wallet export (no header row)
// ---------------------------------------------------------------------------
// Columns: date, transaction id, payer name, payer MSISDN, TRANSFER, amount, fee,
// balance before, balance after, wallet MSISDN, wallet name, …, financial id, …
// The financial id is the same id space as the main MoMo statement's "Id", so the
// reference (momo:<id>) can never double-count a gift present in both.

export function parseMomoWalletGrid(grid: string[][]): PaymentParseResult {
  const result: PaymentParseResult = { rows: [], rejects: [], skipped: [] };
  grid.forEach((cells, index) => {
    const date = parseStatementDate(cells[0] ?? "");
    if (!date || (cells[4] ?? "").toUpperCase() !== "TRANSFER") return;
    const rawRow: Record<string, string> = {
      Date: cells[0],
      "Transaction id": cells[1] ?? "",
      "From name": cells[2] ?? "",
      From: cells[3] ?? "",
      Type: cells[4],
      Amount: cells[5] ?? "",
      Fee: cells[6] ?? "",
      "Balance before": cells[7] ?? "",
      "Balance after": cells[8] ?? "",
      To: cells[9] ?? "",
      "To name": cells[10] ?? "",
      Id: cells[12] ?? "",
    };
    const id = rawRow.Id.trim();
    if (!/^\d{8,}$/.test(id)) {
      result.rejects.push({ index, reason: "missing transaction id", rawRow });
      return;
    }
    const amountMinor = toMinor(rawRow.Amount);
    const before = toMinor(rawRow["Balance before"]);
    const after = toMinor(rawRow["Balance after"]);
    if (!(amountMinor > 0) || after - before !== amountMinor) {
      result.rejects.push({
        index,
        reason: "amount doesn't match the wallet balance change",
        rawRow,
      });
      return;
    }
    result.rows.push({
      source: "momo",
      sourceRowId: id,
      transactionDate: date,
      amountMinor,
      currency: "GHS",
      payerName: cleanName(rawRow["From name"]),
      payerPhoneOrAccount: normalizePhone(rawRow.From) ?? rawRow.From,
      providerReference: id,
      rawRow,
    });
  });
  return result;
}
