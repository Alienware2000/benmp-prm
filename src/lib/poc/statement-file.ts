// src/lib/poc/statement-file.ts
// Pure helpers for uploaded statement files: format detection (CSV vs Excel) and
// where the original file is filed in the statement vault.

/** Private Supabase Storage bucket holding every imported statement file (migration 0024). */
export const STATEMENT_VAULT_BUCKET = "statement-vault";

/**
 * True when the file should be read as a workbook rather than CSV. Checks the
 * content signature first (.xlsx is a zip, legacy .xls is an OLE container), then
 * falls back to the extension — some bank ".xls" exports are actually HTML, which
 * SheetJS still reads.
 */
export function isSpreadsheetFile(filename: string, buffer: ArrayBuffer): boolean {
  const head = new Uint8Array(buffer.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  return isZip || isOle || /\.xlsx?$/i.test(filename);
}

/**
 * The YYYY-MM most rows fall in. Statements often carry a day or two from the
 * previous month, so a majority vote files them under the right month. Ties go to
 * the later month.
 */
export function statementMonth(rows: Array<{ transactionDate: string }>): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const month = row.transactionDate.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [month, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && month > best)) {
      best = month;
      bestCount = count;
    }
  }
  return best;
}

/** Object path inside the vault: `<source>/<YYYY-MM>/<sha256>-<safe filename>`. */
export function vaultObjectPath({
  source,
  month,
  fileHash,
  filename,
}: {
  source: string;
  month: string | null;
  fileHash: string;
  filename: string;
}): string {
  const safeName =
    filename
      .replace(/^.*[\\/]/, (prefix) => prefix.replace(/[\\/.]+/g, "_"))
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^[._]+/, "")
      .slice(0, 100) || "statement";
  return `${source}/${month ?? "undated"}/${fileHash}-${safeName}`;
}

export function contentTypeFor(filename: string): string {
  if (/\.csv$/i.test(filename)) return "text/csv";
  if (/\.xlsx$/i.test(filename)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (/\.xls$/i.test(filename)) return "application/vnd.ms-excel";
  return "application/octet-stream";
}
