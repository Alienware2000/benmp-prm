/**
 * Ingestion wizard core (HP-3, Decision 0018 items 4-6): pure parsing and
 * validation shared by the preview UI and the submit route, so what the hub
 * admin sees flagged is exactly what the server refuses.
 *
 * Nothing here touches the network or database. The caller supplies the hub's
 * church list and the already-in-the-database phone lookups; this module only
 * decides. All messages are office language — they appear verbatim in the
 * red-flag hovers.
 */
import { normalizePhone } from "../phone";
import { normalizeChurchKey } from "./seed";

/** Which uploaded column holds what (0-based). */
export type ColumnMap = { name: number; phone: number; church: number };

export type HubChurchOption = { id: string; name: string; nameKey: string };

export type CandidateRow = {
  /** 1-based position in the uploaded sheet, header included — what the admin sees in Excel. */
  rowIndex: number;
  /** The original uploaded cells, untouched — becomes hub_ingest_rows.raw. */
  raw: string[];
  name: string;
  phone: string;
  church: string;
};

export type RowField = "name" | "phone" | "church";

export type RowIssue = { field: RowField; message: string };

export type ValidatedRow = CandidateRow & {
  phoneE164: string | null;
  churchId: string | null;
  /** Canonical display name from the hub list when matched. */
  churchName: string | null;
  issues: RowIssue[];
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Minimal RFC-4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, \r\n or \n line ends. Enough for office exports;
 * anything stranger should arrive as .xlsx.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop rows that are entirely empty (trailing newlines, spacer rows).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

/**
 * Pull the mapped columns out of the sheet grid. Row numbering is 1-based over
 * the original sheet (including the header row when present) so "row 14" in a
 * flag means row 14 in the admin's own Excel. Entirely-empty picks are skipped.
 */
export function extractCandidates(
  rows: string[][],
  map: ColumnMap,
  hasHeader: boolean,
): CandidateRow[] {
  const out: CandidateRow[] = [];
  const start = hasHeader ? 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const raw = rows[i] ?? [];
    const name = (raw[map.name] ?? "").trim();
    const phone = (raw[map.phone] ?? "").trim();
    const church = (raw[map.church] ?? "").trim();
    if (name === "" && phone === "" && church === "") continue;
    out.push({ rowIndex: i + 1, raw, name, phone, church });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Office-language problem with a name, or null when acceptable. */
export function validateName(name: string): string | null {
  if (name === "") return "Name is missing.";
  const words = name.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length < 2) {
    return 'Needs at least two names, for example "Ama Mensah".';
  }
  return null;
}

export type ExistingPhoneInfo = {
  /** Hub number the phone already belongs to, or null when it predates hubs. */
  hubNumber: number | null;
};

export type ValidationContext = {
  churches: HubChurchOption[];
  /** E.164 -> where it already exists in the database. */
  existingPhones: ReadonlyMap<string, ExistingPhoneInfo>;
};

/**
 * Apply every Decision 0018 rule to the candidate rows. Deterministic and
 * total: every row comes back, clean or flagged, in input order.
 */
export function validateCandidates(
  candidates: CandidateRow[],
  ctx: ValidationContext,
): ValidatedRow[] {
  const byKey = new Map(ctx.churches.map((c) => [c.nameKey, c]));
  const firstRowForPhone = new Map<string, number>();

  return candidates.map((cand) => {
    const issues: RowIssue[] = [];

    const nameProblem = validateName(cand.name);
    if (nameProblem) issues.push({ field: "name", message: nameProblem });

    let phoneE164: string | null = null;
    if (cand.phone === "") {
      issues.push({ field: "phone", message: "Phone number is missing." });
    } else {
      phoneE164 = normalizePhone(cand.phone);
      if (!phoneE164) {
        issues.push({
          field: "phone",
          message:
            "Not a valid WhatsApp number. Use 0244123456 or +233 24 412 3456.",
        });
      }
    }

    if (phoneE164) {
      const firstRow = firstRowForPhone.get(phoneE164);
      if (firstRow !== undefined) {
        issues.push({
          field: "phone",
          message: `Same number as row ${firstRow} of this file.`,
        });
      } else {
        firstRowForPhone.set(phoneE164, cand.rowIndex);
        const existing = ctx.existingPhones.get(phoneE164);
        if (existing) {
          issues.push({
            field: "phone",
            message:
              existing.hubNumber === null
                ? "This number is already in the system."
                : `This number is already in the system for Hub ${existing.hubNumber}.`,
          });
        }
      }
    }

    let churchId: string | null = null;
    let churchName: string | null = null;
    if (cand.church === "") {
      issues.push({ field: "church", message: "Church is missing." });
    } else {
      const match = byKey.get(normalizeChurchKey(cand.church));
      if (match) {
        churchId = match.id;
        churchName = match.name;
      } else {
        issues.push({
          field: "church",
          message:
            "Not on this hub's church list. Pick the church from the dropdown.",
        });
      }
    }

    return { ...cand, phoneE164, churchId, churchName, issues };
  });
}

/** Upload guardrails shared by the parse route and the client. */
export const INGEST_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxRowsPerSheet: 5000,
  maxColumns: 60,
} as const;
