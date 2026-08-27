/**
 * Ingestion wizard core (HP-3, Decision 0018 items 4-6): pure parsing and
 * validation shared by the preview UI and the submit route, so what the hub
 * admin sees flagged is exactly what the server refuses.
 *
 * Nothing here touches the network or database. The caller supplies the hub's
 * church list and the already-in-the-database phone lookups; this module only
 * decides. All messages are office language — they appear verbatim in the
 * red-flag hovers.
 *
 * Two phone numbers per row:
 *   - momoPhone: Ghana MoMo/mobile, strictly validated (02x/05x, 9 NSN digits).
 *   - whatsappPhone: international WhatsApp number, validated loosely as E.164.
 *
 * Duplicate names within one upload are rejected. The same phone number may
 * be listed for more than one name.
 */
import { normalizePhone } from "../phone";
import { normalizeChurchKey } from "./seed";

/** Which uploaded column holds what (0-based). */
export type ColumnMap = {
  name: number;
  momoPhone: number;
  whatsappPhone: number;
  church: number;
};

export type HubChurchOption = { id: string; name: string; nameKey: string };

export type CandidateRow = {
  /** 1-based position in the uploaded sheet, header included — what the admin sees in Excel. */
  rowIndex: number;
  /** The original uploaded cells, untouched — becomes hub_ingest_rows.raw. */
  raw: string[];
  name: string;
  momoPhone: string;
  whatsappPhone: string;
  church: string;
};

export type RowField = "name" | "momoPhone" | "whatsappPhone" | "church";

export type RowIssue = { field: RowField; message: string };

export type ValidatedRow = CandidateRow & {
  momoPhoneE164: string | null;
  whatsappPhoneE164: string | null;
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
    const momoPhone = (raw[map.momoPhone] ?? "").trim();
    const whatsappPhone = (raw[map.whatsappPhone] ?? "").trim();
    const church = (raw[map.church] ?? "").trim();
    if (name === "" && momoPhone === "" && whatsappPhone === "" && church === "") continue;
    out.push({ rowIndex: i + 1, raw, name, momoPhone, whatsappPhone, church });
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
 *
 * Rules:
 *   - Name must have at least two real words; duplicate names within the upload are flagged.
 *   - MoMo phone must be a valid Ghana mobile number (02x/05x, 9 NSN digits).
 *   - WhatsApp phone must be a parseable E.164 number; international numbers accepted.
 *   - The same MoMo or WhatsApp phone may appear for multiple names.
 *   - Church must match the hub's church list.
 */
export function validateCandidates(
  candidates: CandidateRow[],
  ctx: ValidationContext,
): ValidatedRow[] {
  const byKey = new Map(ctx.churches.map((c) => [c.nameKey, c]));

  // Track which names have already appeared in this upload.
  const firstRowForName = new Map<string, number>();

  return candidates.map((cand) => {
    const issues: RowIssue[] = [];

    const nameProblem = validateName(cand.name);
    if (nameProblem) issues.push({ field: "name", message: nameProblem });

    if (!nameProblem) {
      const normalizedName = cand.name.trim().toLowerCase();
      const firstNameRow = firstRowForName.get(normalizedName);
      if (firstNameRow !== undefined) {
        issues.push({
          field: "name",
          message: `Same name as row ${firstNameRow} of this file.`,
        });
      } else {
        firstRowForName.set(normalizedName, cand.rowIndex);
      }
    }

    let momoPhoneE164: string | null = null;
    if (cand.momoPhone === "") {
      issues.push({ field: "momoPhone", message: "MoMo phone number is missing." });
    } else {
      momoPhoneE164 = normalizePhone(cand.momoPhone, "GH");
      if (!momoPhoneE164) {
        issues.push({
          field: "momoPhone",
          message:
            "Not a valid Ghana MoMo number. Use 0244123456 or +233 244 123 456.",
        });
      }
    }

    let whatsappPhoneE164: string | null = null;
    if (cand.whatsappPhone === "") {
      issues.push({ field: "whatsappPhone", message: "WhatsApp number is missing." });
    } else {
      whatsappPhoneE164 = normalizePhone(cand.whatsappPhone);
      if (!whatsappPhoneE164) {
        issues.push({
          field: "whatsappPhone",
          message:
            "Not a valid WhatsApp number. Use 0244123456 or +233 244 123 456.",
        });
      }
    }

    // Existing-phone check covers both numbers; a duplicate in either blocks the row.
    for (const [field, phone] of [
      ["momoPhone", momoPhoneE164],
      ["whatsappPhone", whatsappPhoneE164],
    ] as const) {
      if (!phone) continue;
      const existing = ctx.existingPhones.get(phone);
      if (existing) {
        issues.push({
          field,
          message:
            existing.hubNumber === null
              ? "This number is already in the system."
              : `This number is already in the system for Hub ${existing.hubNumber}.`,
        });
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

    return { ...cand, momoPhoneE164, whatsappPhoneE164, churchId, churchName, issues };
  });
}

/** Upload guardrails shared by the parse route and the client. */
export const INGEST_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxRowsPerSheet: 5000,
  maxColumns: 60,
} as const;
