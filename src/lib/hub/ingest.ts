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
 *   - whatsappPhone: WhatsApp number. Ghana regions read it as Ghanaian; other
 *     hubs read it as their own country's via whatsappCallingCode (Decision 0027).
 *
 * Duplicate names within one upload are rejected. The same phone number may
 * be listed for more than one name.
 */
import { normalizePhone, normalizeWhatsappPhone } from "../phone";
import { normalizeChurchKey } from "./seed";

/** Which uploaded column holds what (0-based). */
export type ColumnMap = {
  name: number;
  /** Null in a region that does not collect MoMo (Decision 0026). */
  momoPhone: number | null;
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
  /**
   * Set when this row matches a partner the uploading hub already owns: the row is an
   * EDIT of that partner rather than a new person. Null means a fresh insert.
   */
  updatesPartnerId: string | null;
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
    const momoPhone =
      map.momoPhone === null ? "" : (raw[map.momoPhone] ?? "").trim();
    const whatsappPhone = (raw[map.whatsappPhone] ?? "").trim();
    const church = (raw[map.church] ?? "").trim();
    if (
      name === "" &&
      momoPhone === "" &&
      whatsappPhone === "" &&
      church === ""
    )
      continue;
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

/**
 * Identity of a person's name for re-upload matching: case- and whitespace-
 * insensitive, so "AMA  MENSAH" and "Ama Mensah" are the same person.
 *
 * Deliberately does NOT strip punctuation or reorder words — "Shadrack O. Ashley" and
 * "Shadrack Ashley" stay distinct, because collapsing them would be a guess about two
 * real people rather than a formatting fix.
 */
export function normalizeNameKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** One partner the uploading hub already has, for name-based edit matching. */
export type ExistingPartner = {
  partnerId: string;
  /** normalizeNameKey of their current name. */
  nameKey: string;
};

export type ExistingPhoneInfo = {
  /** Hub number the phone already belongs to, or null when it predates hubs. */
  hubNumber: number | null;
  /**
   * How to name that hub to the admin ("12 — Asamankese", "Kpandai"). Optional:
   * a named-region hub has no number to fall back on (Decision 0020), while
   * pre-regions callers still pass only the number.
   */
  hubLabel?: string | null;
  /** The partner row this phone belongs to — the row an edit would update. */
  partnerId?: string;
  /** Hub that owns it. Compared against the uploading hub to allow self-edits. */
  hubId?: string | null;
};

export type ValidationContext = {
  churches: HubChurchOption[];
  /**
   * The uploading hub. A phone already held by THIS hub is an edit of the admin's own
   * partner and is allowed; one held by another hub stays blocked, so no hub can take
   * over another's people by uploading their number (Decision 0024).
   */
  hubId?: string;
  /**
   * Partners this hub already has, keyed for name matching.
   *
   * Name is the primary way an edit is recognised, because the thing being corrected
   * is usually the phone number or church — matching on phone would miss exactly the
   * rows the admin is trying to fix, and create a second record for the same person.
   */
  existingPartners?: readonly ExistingPartner[];
  /** E.164 -> where it already exists in the database. */
  existingPhones: ReadonlyMap<string, ExistingPhoneInfo>;
  /**
   * Whether this region collects a Ghana MoMo number (Decision 0026). Defaults
   * to true, matching the Ghana regions the wizard was built for. When false,
   * an empty MoMo passes and a non-empty one is still validated as Ghana.
   */
  momoRequired?: boolean;
  /**
   * Calling code (digits, no "+") of the hub's country, for hubs outside Ghana
   * (Decision 0027). Lets a local-form WhatsApp number ("0999 123 456") resolve
   * to the hub's own country instead of Ghana. Ignored when momoRequired is
   * true (Ghana regions keep Ghana rules). null = numbers must carry their own
   * country code.
   */
  whatsappCallingCode?: string | null;
};

/**
 * Apply every Decision 0018 rule to the candidate rows. Deterministic and
 * total: every row comes back, clean or flagged, in input order.
 *
 * Rules:
 *   - Name must have at least two real words; the same name AND number twice in one upload is flagged.
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

  // A person is a name AND a number (Decision 0028): two rows with the same name
  // but different numbers are two people; the same name and number twice is a
  // duplicate row.
  const firstRowForPerson = new Map<string, number>();
  // Each existing partner may be updated by one row only.
  const firstRowUpdating = new Map<string, number>();

  return candidates.map((cand) => {
    const issues: RowIssue[] = [];

    const nameProblem = validateName(cand.name);
    if (nameProblem) issues.push({ field: "name", message: nameProblem });

    const momoRequired = ctx.momoRequired ?? true;
    let momoPhoneE164: string | null = null;
    if (cand.momoPhone === "") {
      if (momoRequired) {
        issues.push({
          field: "momoPhone",
          message: "MoMo phone number is missing.",
        });
      }
    } else if (!momoRequired) {
      // No MoMo column exists for this region (Decision 0026); a stray value
      // can only come from a hidden mapping, so it is ignored, never flagged.
      momoPhoneE164 = null;
    } else {
      momoPhoneE164 = normalizePhone(cand.momoPhone, "GH");
      // Ghana mobiles all start 02x/05x (NSN 2… or 5…). A right-length number
      // with an impossible start or a fixed line is not a MoMo wallet.
      if (
        momoPhoneE164 &&
        !/^[25]\d{8}$/.test(momoPhoneE164.slice("+233".length))
      ) {
        momoPhoneE164 = null;
      }
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
      issues.push({
        field: "whatsappPhone",
        message: "WhatsApp number is missing.",
      });
    } else {
      // Ghana regions read WhatsApp numbers as Ghanaian; every other hub reads
      // them as its own country's (Decision 0027).
      const cc = momoRequired ? null : (ctx.whatsappCallingCode ?? null);
      whatsappPhoneE164 = momoRequired
        ? normalizePhone(cand.whatsappPhone)
        : normalizeWhatsappPhone(cand.whatsappPhone, cc);
      if (!whatsappPhoneE164) {
        issues.push({
          field: "whatsappPhone",
          message: momoRequired
            ? "Not a valid WhatsApp number. Use 0244123456 or +233 244 123 456."
            : cc
              ? `Not a valid WhatsApp number. Use the local form (0…) or +${cc} followed by the number.`
              : "Not a valid WhatsApp number. Include the country code, e.g. +44 7700 900123.",
        });
      }
    }

    if (!nameProblem) {
      // WhatsApp is every partner's contact number; MoMo only stands in when a
      // row has no WhatsApp at all.
      const contact =
        whatsappPhoneE164 ??
        (cand.whatsappPhone.replace(/\s+/g, "") || momoPhoneE164 || "");
      const personKey = `${normalizeNameKey(cand.name)}|${contact}`;
      const firstRow = firstRowForPerson.get(personKey);
      if (firstRow !== undefined) {
        issues.push({
          field: "name",
          message: `Same name and WhatsApp number as row ${firstRow} of this file.`,
        });
      } else {
        firstRowForPerson.set(personKey, cand.rowIndex);
      }
    }

    // ---- which existing partner (if any) does this row edit? ----------------
    //
    // A person is their name AND their number (Decision 0028). A row updates an
    // existing partner only when both match that same partner (a re-upload of the
    // same person). The same name with a different number is a different person
    // who happens to share the name, and is added; a shared number under a
    // different name is added too. Nobody is ever overwritten on a name alone.
    // A number held by ANOTHER hub (or a pre-hub record) still blocks the row, so
    // no hub can take over another's people.
    const rowNameKey = normalizeNameKey(cand.name);
    const nameIds = (ctx.existingPartners ?? [])
      .filter((p) => rowNameKey !== "" && p.nameKey === rowNameKey)
      .map((p) => p.partnerId);

    const phoneIds: string[] = [];
    for (const [field, phone] of [
      ["momoPhone", momoPhoneE164],
      ["whatsappPhone", whatsappPhoneE164],
    ] as const) {
      if (!phone) continue;
      const existing = ctx.existingPhones.get(phone);
      if (!existing) continue;

      const ownsIt =
        ctx.hubId !== undefined &&
        existing.hubId != null &&
        existing.hubId === ctx.hubId;
      if (ownsIt && existing.partnerId) {
        if (!phoneIds.includes(existing.partnerId)) {
          phoneIds.push(existing.partnerId);
        }
        continue;
      }
      issues.push({
        field,
        message: (() => {
          const owner =
            existing.hubLabel ??
            (existing.hubNumber === null ? null : `Hub ${existing.hubNumber}`);
          return owner === null
            ? "This number is already in the system."
            : `This number is already in the system for ${owner}.`;
        })(),
      });
    }

    const exact = nameIds.filter((id) => phoneIds.includes(id)).sort();
    let updatesPartnerId: string | null = exact[0] ?? null;

    if (updatesPartnerId) {
      const first = firstRowUpdating.get(updatesPartnerId);
      if (first !== undefined) {
        issues.push({
          field: "name",
          message: `Row ${first} of this file is already this same person.`,
        });
        updatesPartnerId = null;
      } else {
        firstRowUpdating.set(updatesPartnerId, cand.rowIndex);
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

    return {
      ...cand,
      momoPhoneE164,
      whatsappPhoneE164,
      churchId,
      churchName,
      updatesPartnerId,
      issues,
    };
  });
}

/** Upload guardrails shared by the parse route and the client. */
export const INGEST_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxRowsPerSheet: 5000,
  maxColumns: 60,
} as const;
