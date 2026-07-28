/**
 * One-time loader: Africa / international / Italy partner directory spreadsheets ->
 * Supabase `partners`. Sibling to load-poc-data.ts (Ghana/MoMo); this covers the three
 * region files added to ../Data on 2026-07-28 (`AFRICA REDACTED.xlsx`,
 * `INTL REDACTED.xlsx`, `ITALY REDACTED.xlsx`). Real data lives outside the repo;
 * nothing here is committed. Directory-only (name + WhatsApp + branch + country) — no
 * giving/reconciliation path exists for non-Ghana money yet (Decision 0007), so Italy's
 * Amount/Payment Type columns are preserved as free-text `notes`, not structured giving.
 *
 * `country` is a first-class field distinct from `church` (the branch) — every partner
 * gets one, derived from the sheet it came from, never guessed from the phone number.
 *
 * Phone handling is deliberately not sloppy: no fixed national-number-length table is
 * hand-authored from memory. Only the ITU calling code per country is a static fact
 * (src/lib/calling-codes.ts); the valid national-significant-number (NSN) digit lengths
 * are *calibrated from the sheet's own data* (calibrateNsnLengths) before anything is
 * normalized, and a number that matches no recognized shape — for its own country or, as
 * a diaspora fallback, any other country in this dataset — is rejected and logged, never
 * guessed into a plausible-looking but wrong E.164 value.
 *
 * Run: npx tsx --env-file=.env.local scripts/load-region-partners.ts
 */
import ExcelJS from "exceljs";
import { normalizePhoneForCallingCode } from "../src/lib/phone";
import { COUNTRY_CALLING_CODES } from "../src/lib/calling-codes";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATA = process.env.POC_DATA_DIR ?? "./Data";
const SOURCE_PREFIX = "region_import_";

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// ---------------------------------------------------------------------------
// Sheet -> country map. Explicit, not inferred: sheet titles are the office's own
// spelling/versioning quirks (trailing spaces, "MALAWI 2", three separate PNG sheets),
// the country is the real-world fact we need for region reporting later.
// ---------------------------------------------------------------------------

type SheetSpec = { sheet: string; country: string };

const AFRICA_SHEETS: SheetSpec[] = [
  { sheet: "BOTSWANA", country: "Botswana" },
  { sheet: "BENIN", country: "Benin" },
  { sheet: "CAMEROUN", country: "Cameroon" },
  { sheet: "BURKINA FASO", country: "Burkina Faso" },
  { sheet: "COTE DIVOIRE", country: "Côte d'Ivoire" },
  { sheet: "C.A.R", country: "Central African Republic" },
  { sheet: "CONGO BRAZZAVILLE", country: "Congo-Brazzaville" },
  { sheet: "DR CONGO", country: "DR Congo" },
  { sheet: "ETHIOPIA", country: "Ethiopia" },
  { sheet: "EQUATORIAL GUINEA", country: "Equatorial Guinea" },
  { sheet: "GABON", country: "Gabon" },
  { sheet: "GAMBIA", country: "Gambia" },
  { sheet: "GUINEA BISSAU", country: "Guinea-Bissau" },
  { sheet: "GUINEA CONAKRY", country: "Guinea" },
  { sheet: "KENYA", country: "Kenya" },
  { sheet: "LIBERIA", country: "Liberia" },
  { sheet: "LESOTHO", country: "Lesotho" },
  { sheet: "MALAWI 2", country: "Malawi" },
  { sheet: "MALI", country: "Mali" },
  { sheet: "MOZAMBIQUE", country: "Mozambique" },
  { sheet: "NAMIBIA", country: "Namibia" },
  { sheet: "NIGERIA", country: "Nigeria" },
  { sheet: "NIGER", country: "Niger" },
  { sheet: "RWANDA", country: "Rwanda" },
  { sheet: "SENEGAL", country: "Senegal" },
  { sheet: "SEYCHELLES", country: "Seychelles" },
  { sheet: "SIERRA LEONE", country: "Sierra Leone" },
  { sheet: "SOUTH AFRICA", country: "South Africa" },
  { sheet: "SWAZILAND", country: "Eswatini" },
  { sheet: "TANZANIA", country: "Tanzania" },
  { sheet: "TOGO", country: "Togo" },
  { sheet: "UGANDA", country: "Uganda" },
  { sheet: "ZAMBIA", country: "Zambia" },
  { sheet: "Zimbabwe ", country: "Zimbabwe" },
];

const INTL_SHEETS: SheetSpec[] = [
  { sheet: "ANTIGUA", country: "Antigua and Barbuda" },
  { sheet: "AUSTRALIA ", country: "Australia" },
  { sheet: "Copy of AUSTRALIA 2021", country: "Australia" },
  { sheet: "AUSTRIA", country: "Austria" },
  { sheet: "BARBADOS", country: "Barbados" },
  { sheet: "BELGIUM", country: "Belgium" },
  { sheet: "BRAZIL", country: "Brazil" },
  { sheet: "DUBAI", country: "United Arab Emirates" },
  { sheet: "FIJI 2022", country: "Fiji" },
  { sheet: "QATAR", country: "Qatar" },
  { sheet: "FRANCE", country: "France" },
  { sheet: "GERMANY", country: "Germany" },
  { sheet: "GUYANA", country: "Guyana" },
  { sheet: "HOLLAND", country: "Netherlands" },
  { sheet: "HUNGARY", country: "Hungary" },
  { sheet: "INDIA", country: "India" },
  { sheet: "ITALY", country: "Italy" },
  { sheet: "JAMAICA", country: "Jamaica" },
  { sheet: "NEW ZEALAND ", country: "New Zealand" },
  { sheet: "PHILIPPINES", country: "Philippines" },
  { sheet: "PNG(New)", country: "Papua New Guinea" },
  { sheet: "PNG 2021", country: "Papua New Guinea" },
  { sheet: "old PNG", country: "Papua New Guinea" },
  { sheet: "PORTUGAL", country: "Portugal" },
  { sheet: "SAMOA", country: "Samoa" },
  { sheet: "SOLOMON ISLAND", country: "Solomon Islands" },
  { sheet: "ST KITTS", country: "Saint Kitts and Nevis" },
  { sheet: "SPAIN", country: "Spain" },
  { sheet: "ST LUCIA", country: "Saint Lucia" },
  { sheet: "SWITZERLAND", country: "Switzerland" },
  { sheet: "SWEDEN", country: "Sweden" },
  { sheet: "THAILAND", country: "Thailand" },
  { sheet: "TONGA", country: "Tonga" },
  { sheet: "TRINIDAD & TOBAGO", country: "Trinidad and Tobago" },
  { sheet: "UK", country: "United Kingdom" },
  { sheet: "USA", country: "United States" },
  { sheet: "VANUATU ", country: "Vanuatu" },
];

const ITALY_SHEETS: SheetSpec[] = [{ sheet: "Table 1", country: "Italy" }];
// "Sheet1" in ITALY REDACTED.xlsx is blank — deliberately not listed, so it is skipped.

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------------------------------------
// Reading + column detection. Real headers vary in spelling ("WATHAAP N°",
// "WHATSAPPNO", "Full Name") and several sheets have no usable header row at all (the
// first data row landed where the header should be — see docs/decisions.md for the
// catalogued cases). Detection: find the first of the first 5 rows containing a
// recognizable label; label the columns it does have; any of name/phone/branch left
// unlabeled falls back to the leftmost still-unclaimed column, in that priority order
// — the one positional convention every sheet in this dataset actually follows.
// ---------------------------------------------------------------------------

type Role =
  "name" | "firstName" | "familyName" | "phone" | "branch" | "counter";

const LABEL_PATTERNS: [RegExp, Role][] = [
  [/^(FULL\s*NAME|NAME)$/i, "name"],
  [/^FIRST\s*NAME$/i, "firstName"],
  [/^(FAMILY\s*NAME|SURNAME)$/i, "familyName"],
  [
    /^(WHATSAPP\s*NO\.?|WHATSAPPNO|WATHAAP\s*N[°O]?|WHATSAPP|TELEPHONE\s*NO\.?|TELEPHONE|PHONE(\s*NO\.?)?)$/i,
    "phone",
  ],
  [/^BRANCH(ES)?$/i, "branch"],
  [/^(NO\.?|#)$/i, "counter"],
];

/**
 * exceljs's `CellValue` types are declared, not runtime-checked — real spreadsheets in
 * this dataset store a *number* in a `CellHyperlinkValue.text` field despite the "string"
 * declaration (a hyperlinked phone number, e.g. Uganda). Every extracted field is
 * coerced through `String()` rather than trusted at its declared type.
 */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v !== "object") return String(v);
  if ("richText" in v) return v.richText.map((t) => String(t.text)).join("");
  if ("error" in v) return String(v.error);
  // Prefer the literal formula text over `result`: Excel sometimes misparses a typed
  // phone number as an arithmetic expression (e.g. "678-7763790" evaluates to -7763112),
  // corrupting the digits. The raw formula string is what the office actually typed.
  if ("formula" in v) return String(v.formula ?? "");
  if ("sharedFormula" in v) return String(v.sharedFormula);
  if ("text" in v) return String(v.text);
  return "";
}

function readSheetRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cellText(cell).trim();
    });
    rows.push(cells);
  });
  return rows;
}

function detectRoles(rows: string[][]): {
  dataStart: number;
  roles: (Role | undefined)[];
} {
  const scanLimit = Math.min(5, rows.length);
  let headerIdx = -1;
  for (let r = 0; r < scanLimit; r++) {
    const score = rows[r].filter((c) =>
      LABEL_PATTERNS.some(([re]) => re.test(c)),
    ).length;
    if (score >= 1) {
      headerIdx = r;
      break;
    }
  }
  const width = Math.max(1, ...rows.slice(0, scanLimit).map((r) => r.length));
  const roles: (Role | undefined)[] = new Array(width).fill(undefined);
  if (headerIdx >= 0) {
    rows[headerIdx].forEach((cell, i) => {
      const hit = LABEL_PATTERNS.find(([re]) => re.test(cell));
      if (hit) roles[i] = hit[1];
    });
  }
  // A separate firstName/familyName pair (Italy's Table 1) already satisfies "name" —
  // the fallback must not also claim a leftover column (Amount, in Italy's case) for it.
  const nameAlreadyCovered =
    roles.includes("name") ||
    roles.includes("firstName") ||
    roles.includes("familyName");
  for (const want of ["name", "phone", "branch"] as const) {
    if (want === "name" && nameAlreadyCovered) continue;
    if (roles.includes(want)) continue;
    const idx = roles.findIndex((r) => r === undefined);
    if (idx >= 0) roles[idx] = want;
  }
  return { dataStart: headerIdx >= 0 ? headerIdx + 1 : 0, roles };
}

type RawRecord = {
  name: string;
  rawPhone: string;
  branch: string | null;
  notes: string | null;
};

/** Extract name/phone/branch from every non-blank data row, plus Amount+Payment Type as `notes` when present (Italy's Table 1). */
function extractRows(rows: string[][]): RawRecord[] {
  const { dataStart, roles } = detectRoles(rows);
  const header = dataStart > 0 ? rows[dataStart - 1] : [];
  const amountIdx = header.findIndex((c) => /^AMOUNT$/i.test(c));
  const paymentTypeIdx = header.findIndex((c) => /^PAYMENT\s*TYPE$/i.test(c));

  const out: RawRecord[] = [];
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c)) continue; // blank spacer row — not data, not a reject

    let name = "";
    let firstName = "";
    let familyName = "";
    let rawPhone = "";
    let branch: string | null = null;
    roles.forEach((role, i) => {
      const v = row[i] ?? "";
      if (role === "name") name = v;
      else if (role === "firstName") firstName = v;
      else if (role === "familyName") familyName = v;
      else if (role === "phone") rawPhone = v;
      else if (role === "branch") branch = v || null;
    });
    if (!name && (firstName || familyName))
      name = `${firstName} ${familyName}`.trim();

    let notes: string | null = null;
    if (amountIdx >= 0 || paymentTypeIdx >= 0) {
      const amount = amountIdx >= 0 ? row[amountIdx] : "";
      const paymentType = paymentTypeIdx >= 0 ? row[paymentTypeIdx] : "";
      if (amount || paymentType) {
        notes = `Region import pledge (directory-only, not reconciled giving): ${amount || "?"} / ${paymentType || "?"}`;
      }
    }

    out.push({
      name: cleanName(name),
      rawPhone: rawPhone.trim(),
      branch: cleanBranch(branch),
      notes,
    });
  }
  return out;
}

/** Strip a lone trailing comma from office naming conventions; title-case a name that arrived ALL CAPS (Italy's source sheet). Mixed-case names (incl. "SURNAME Firstname" conventions) are left untouched. */
function cleanName(raw: string): string {
  let s = raw.trim().replace(/,$/, "").trim().replace(/\s+/g, " ");
  if (s && !/[a-z]/.test(s) && /[A-Z]/.test(s))
    s = s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return s;
}

function cleanBranch(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").trim();
  return s || null;
}

// ---------------------------------------------------------------------------
// Phone calibration. See file header: nsnLengths per country are derived from the
// sheet's own numbers, not hand-authored from memory.
// ---------------------------------------------------------------------------

function calibrateNsnLengths(country: string, rawPhones: string[]): number[] {
  const cc = COUNTRY_CALLING_CODES[country];
  if (!cc) return [];

  const codedCandidates = new Map<number, number>(); // nsn length -> count, among numbers that already carry `cc`
  const allLengths = new Map<number, number>();
  for (const raw of rawPhones) {
    const digits = raw.replace(/^\+/, "").replace(/\D/g, "");
    if (!digits) continue;
    allLengths.set(digits.length, (allLengths.get(digits.length) ?? 0) + 1);
    if (digits.startsWith(cc) && digits.length > cc.length) {
      const nsn = digits.length - cc.length;
      codedCandidates.set(nsn, (codedCandidates.get(nsn) ?? 0) + 1);
    }
  }

  if (codedCandidates.size === 0) {
    // Nothing in this sheet carries the calling code at all — fall back to whatever
    // digit length is most common and treat it as a bare NSN.
    let best = -1;
    let bestCount = 0;
    for (const [len, count] of allLengths) {
      if (count > bestCount) {
        best = len;
        bestCount = count;
      }
    }
    return best >= 0 ? [best] : [];
  }

  // Always keep the mode itself (even a country with only 2-3 already-coded samples
  // must calibrate), plus any secondary length that's independently well supported —
  // real dual-length numbering plans exist (old vs new mobile formats).
  const maxCount = Math.max(...codedCandidates.values());
  const threshold = Math.max(2, 0.15 * maxCount);
  return [...codedCandidates.entries()]
    .filter(([, count]) => count === maxCount || count >= threshold)
    .map(([nsn]) => nsn);
}

/** Normalize against the sheet's own country first, then — for a genuine diaspora number written in a different country's format — every other country in this dataset. Rejects (null) rather than guessing when nothing matches. */
function normalizeRegionalPhone(
  raw: string,
  country: string,
  nsnByCountry: Map<string, number[]>,
): string | null {
  const cc = COUNTRY_CALLING_CODES[country];
  const own = cc
    ? normalizePhoneForCallingCode(raw, cc, nsnByCountry.get(country) ?? [])
    : null;
  if (own) return own;

  for (const [otherCountry, otherCc] of Object.entries(COUNTRY_CALLING_CODES)) {
    if (otherCountry === country) continue;
    const lengths = nsnByCountry.get(otherCountry);
    if (!lengths || lengths.length === 0) continue;
    const hit = normalizePhoneForCallingCode(raw, otherCc, lengths);
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Workbook loading
// ---------------------------------------------------------------------------

async function loadWorkbookSheets(
  path: string,
  specs: SheetSpec[],
): Promise<Map<string, { country: string; rows: string[][] }>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const out = new Map<string, { country: string; rows: string[][] }>();
  for (const { sheet, country } of specs) {
    const ws = wb.getWorksheet(sheet);
    if (!ws) {
      console.warn(`WARN sheet not found: ${path} :: ${sheet}`);
      continue;
    }
    out.set(`${path}::${sheet}`, { country, rows: readSheetRows(ws) });
  }
  return out;
}

type PartnerRow = {
  full_name: string;
  whatsapp_number: string;
  country: string;
  church: string | null;
  notes: string | null;
  status: "new";
  source: string;
  preferred_communication_method: "whatsapp";
};

async function insert(table: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!r.ok)
      throw new Error(`INSERT ${table} @${i}: ${r.status} ${await r.text()}`);
  }
}

async function del(table: string, filter: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { ...H, Prefer: "return=minimal" },
  });
  if (!r.ok) throw new Error(`DELETE ${table}: ${r.status} ${await r.text()}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sheets = new Map<
    string,
    { country: string; rows: string[][]; sourceTag: string }
  >();

  const africa = await loadWorkbookSheets(
    `${DATA}/AFRICA REDACTED.xlsx`,
    AFRICA_SHEETS,
  );
  for (const [key, v] of africa)
    sheets.set(key, {
      ...v,
      sourceTag: `${SOURCE_PREFIX}africa_${slug(v.country)}`,
    });

  const intl = await loadWorkbookSheets(
    `${DATA}/INTL REDACTED.xlsx`,
    INTL_SHEETS,
  );
  for (const [key, v] of intl) {
    const sheetName = key.split("::")[1];
    sheets.set(key, {
      ...v,
      sourceTag: `${SOURCE_PREFIX}intl_${slug(sheetName)}`,
    });
  }

  const italy = await loadWorkbookSheets(
    `${DATA}/ITALY REDACTED.xlsx`,
    ITALY_SHEETS,
  );
  for (const [key, v] of italy)
    sheets.set(key, { ...v, sourceTag: `${SOURCE_PREFIX}italy_giving` });

  // Phase 1: calibrate NSN lengths per country from every sheet assigned to it.
  const rawPhonesByCountry = new Map<string, string[]>();
  const extractedBySheet = new Map<
    string,
    { sourceTag: string; country: string; records: RawRecord[] }
  >();
  for (const [key, { country, rows, sourceTag }] of sheets) {
    const records = extractRows(rows);
    extractedBySheet.set(key, { sourceTag, country, records });
    const bucket = rawPhonesByCountry.get(country) ?? [];
    for (const rec of records) if (rec.rawPhone) bucket.push(rec.rawPhone);
    rawPhonesByCountry.set(country, bucket);
  }
  const nsnByCountry = new Map<string, number[]>();
  // Ghana isn't one of the countries being loaded here, but its own partners (the
  // existing 15,329-row POC import) already established nsn=[9] — real Ghanaian
  // numbers turn up as diaspora/coordinator numbers scattered across these sheets
  // (BENMP is Ghana-based), so seed it rather than leaving it uncalibrated.
  nsnByCountry.set("Ghana", [9]);
  for (const [country, phones] of rawPhonesByCountry) {
    nsnByCountry.set(country, calibrateNsnLengths(country, phones));
  }
  for (const [country, lengths] of nsnByCountry) {
    console.log(
      `calibrated ${country}: cc=${COUNTRY_CALLING_CODES[country] ?? "?"} nsnLengths=[${lengths.join(",")}]`,
    );
  }

  // Phase 2: build partner rows, rejecting (and logging) anything that doesn't resolve.
  const partners: PartnerRow[] = [];
  const rejects: {
    sourceTag: string;
    name: string;
    rawPhone: string;
    reason: string;
  }[] = [];
  const bySourceTag = new Map<string, { ok: number; rejected: number }>();
  let duplicates = 0;
  const seen = new Set<string>();

  for (const [, { sourceTag, country, records }] of extractedBySheet) {
    for (const rec of records) {
      if (!rec.name) {
        rejects.push({
          sourceTag,
          name: rec.name,
          rawPhone: rec.rawPhone,
          reason: "missing name",
        });
        const s = bySourceTag.get(sourceTag) ?? { ok: 0, rejected: 0 };
        s.rejected++;
        bySourceTag.set(sourceTag, s);
        continue;
      }
      if (!rec.rawPhone) {
        rejects.push({
          sourceTag,
          name: rec.name,
          rawPhone: rec.rawPhone,
          reason: "missing phone",
        });
        const s = bySourceTag.get(sourceTag) ?? { ok: 0, rejected: 0 };
        s.rejected++;
        bySourceTag.set(sourceTag, s);
        continue;
      }
      const phone = normalizeRegionalPhone(rec.rawPhone, country, nsnByCountry);
      if (!phone) {
        rejects.push({
          sourceTag,
          name: rec.name,
          rawPhone: rec.rawPhone,
          reason: "unrecognized phone shape",
        });
        const s = bySourceTag.get(sourceTag) ?? { ok: 0, rejected: 0 };
        s.rejected++;
        bySourceTag.set(sourceTag, s);
        continue;
      }
      const dedupeKey = `${rec.name.toLowerCase()}|${phone}`;
      if (seen.has(dedupeKey)) {
        duplicates++;
        continue;
      }
      seen.add(dedupeKey);
      const s = bySourceTag.get(sourceTag) ?? { ok: 0, rejected: 0 };
      s.ok++;
      bySourceTag.set(sourceTag, s);
      partners.push({
        full_name: rec.name,
        whatsapp_number: phone,
        country,
        church: rec.branch,
        notes: rec.notes,
        status: "new",
        source: sourceTag,
        preferred_communication_method: "whatsapp",
      });
    }
  }

  console.log("--- per-sheet summary (source | ok | rejected) ---");
  for (const [sourceTag, s] of [...bySourceTag].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`  ${sourceTag} | ${s.ok} | ${s.rejected}`);
  }

  console.log(
    `parsed: ${partners.length} partners, ${rejects.length} rejects, ${duplicates} exact duplicates dropped`,
  );
  for (const rej of rejects) {
    console.log(
      `REJECT source=${rej.sourceTag} name=${JSON.stringify(rej.name)} phone=${JSON.stringify(rej.rawPhone)} reason=${rej.reason}`,
    );
  }

  if (dryRun) {
    console.log(
      "DRY RUN — no database writes. Re-run without --dry-run to load.",
    );
    return;
  }

  await del("partners", `source=like.${SOURCE_PREFIX}*`); // idempotent reload
  await insert("partners", partners);

  console.log(
    `loaded ✓  partners=${partners.length} across ${sheets.size} sheets`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
