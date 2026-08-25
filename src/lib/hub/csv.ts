/**
 * Minimal CSV writer for the archive export (HP-4). Column order comes from
 * the first row; commas/quotes/newlines are quoted, objects are JSON, null
 * and undefined become empty cells.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => cell(r[c])).join(",")),
  ].join("\n");
}
