import { normalizePhone } from "../phone";
import { collapseDoubledName, parseAmountToMinor } from "../ingest";

export type PaymentSource = "momo" | "ecobank" | "paystack_onetime" | "paystack_recurring";

export type RawPaymentRow = Record<string, string>;

export type NormalizedPaymentRow = {
  source: PaymentSource;
  sourceRowId: string;
  transactionDate: string;
  amountMinor: number;
  currency: string;
  payerName: string | null;
  payerPhoneOrAccount: string | null;
  providerReference: string;
  rawRow: RawPaymentRow;
};

export type PaymentParseReject = {
  index: number;
  reason: string;
  rawRow: RawPaymentRow;
};

export type PaymentParseResult = {
  rows: NormalizedPaymentRow[];
  rejects: PaymentParseReject[];
  skipped: PaymentParseReject[];
};

export type PartnerForPaymentMatch = {
  id: string;
  fullName: string;
  momoPhoneNumber: string | null;
  whatsappNumber: string | null;
  church: string | null;
  country: string | null;
};

export type PaymentMatchResult = {
  row: NormalizedPaymentRow;
  status: "auto" | "review";
  reason: string;
  partner: PartnerForPaymentMatch | null;
  candidates: PartnerForPaymentMatch[];
};

export type PocPaymentInsertRow = {
  reference: string;
  paid_at: string;
  status: "Successful";
  payer_name: string | null;
  payer_phone_e164: string | null;
  amount_minor: number;
  currency: string;
  payment_method: string | null;
  raw_row: Record<string, unknown>;
};

const TITLES = new Set([
  "apostle",
  "bishop",
  "rev",
  "reverend",
  "pastor",
  "dr",
  "mr",
  "mrs",
  "miss",
  "ms",
  "prof",
  "prophet",
  "lady",
]);

export function normalizePartnerName(name: string | null | undefined): string {
  if (!name) return "";
  return collapseDoubledName(name)
    .toLowerCase()
    .replace(/[.,'’`"()\[\]{}]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !TITLES.has(part))
    .join(" ");
}

function nameTokens(name: string | null | undefined): string[] {
  return normalizePartnerName(name).split(" ").filter(Boolean);
}

export function firstLastNameKey(name: string | null | undefined): string {
  const tokens = nameTokens(name);
  if (tokens.length < 2) return "";
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

export function ghanaLastNineKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 9) return null;
  const lastNine = digits.slice(-9);
  return /^[25]\d{8}$/.test(lastNine) ? lastNine : null;
}

function extractMomoPhone(raw: string): string | null {
  const explicit = normalizePhone(raw);
  if (explicit) return explicit;
  const lastNine = ghanaLastNineKey(raw);
  return lastNine ? `+233${lastNine}` : null;
}

function cell(row: RawPaymentRow, key: string): string {
  return (row[key] ?? "").trim();
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const bank = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  if (bank) {
    const day = Number(bank[1]);
    const months = [
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
    const month = months.indexOf(bank[2].toLowerCase());
    if (month === -1) return null;
    const yearRaw = Number(bank[3]);
    const year = bank[3].length === 2 ? 2000 + yearRaw : yearRaw;
    return new Date(Date.UTC(year, month, day)).toISOString();
  }

  const isoLike = s.includes("T") ? s : s.replace(" ", "T");
  const date = new Date(isoLike.endsWith("Z") ? isoLike : `${isoLike}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseMomoRows(rows: RawPaymentRow[]): PaymentParseResult {
  const out: NormalizedPaymentRow[] = [];
  const rejects: PaymentParseReject[] = [];
  const skipped: PaymentParseReject[] = [];

  rows.forEach((row, index) => {
    if (cell(row, "Status").toLowerCase() !== "successful") {
      skipped.push({ index, reason: "not successful", rawRow: row });
      return;
    }
    const id = cell(row, "Id");
    if (!id) {
      rejects.push({ index, reason: "missing Id", rawRow: row });
      return;
    }
    const amountMinor = parseAmountToMinor(cell(row, "Amount"));
    if (amountMinor == null) {
      rejects.push({ index, reason: "invalid amount", rawRow: row });
      return;
    }
    const transactionDate = parseDate(cell(row, "Date"));
    if (!transactionDate) {
      rejects.push({ index, reason: "invalid date", rawRow: row });
      return;
    }
    const payerName = collapseDoubledName(cell(row, "From name")) || null;
    const payerPhoneOrAccount =
      extractMomoPhone(cell(row, "From")) ?? extractMomoPhone(cell(row, "From account"));
    out.push({
      source: "momo",
      sourceRowId: id,
      transactionDate,
      amountMinor,
      currency: "GHS",
      payerName,
      payerPhoneOrAccount,
      providerReference: id,
      rawRow: row,
    });
  });

  return { rows: out, rejects, skipped };
}

function cleanBankName(raw: string): string | null {
  const cleaned = raw
    .replace(/,?\s*STANDING ORDER.*$/i, "")
    .replace(/\s+PER\s+.*$/i, "")
    .replace(/\s+IFO\s+.*$/i, "")
    .replace(/\s+ON\s+EVERY\s+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function extractEcobankPayerName(narration: string): string | null {
  const text = narration.trim();
  if (!text) return null;
  const afterDoubleSlash = text.split("//").pop()?.trim() ?? text;

  const byCash = afterDoubleSlash.match(/CASH\s+DEPOSIT\s+BY\s+(.+)$/i);
  if (byCash) return cleanBankName(byCash[1]);

  const bo = afterDoubleSlash.match(/\bB\/?O\s+(.+)$/i) ?? afterDoubleSlash.match(/\bBO\s+(.+)$/i);
  if (bo) return cleanBankName(bo[1]);

  return cleanBankName(afterDoubleSlash);
}

export function parseEcobankRows(rows: RawPaymentRow[]): PaymentParseResult {
  const out: NormalizedPaymentRow[] = [];
  const rejects: PaymentParseReject[] = [];
  const skipped: PaymentParseReject[] = [];

  rows.forEach((row, index) => {
    const credit = cell(row, "Credit");
    if (!credit) {
      skipped.push({ index, reason: "not a credit row", rawRow: row });
      return;
    }
    const amountMinor = parseAmountToMinor(credit);
    if (amountMinor == null) {
      rejects.push({ index, reason: "invalid credit amount", rawRow: row });
      return;
    }
    const transactionDate = parseDate(cell(row, "VALUE_DATE"));
    if (!transactionDate) {
      rejects.push({ index, reason: "invalid value date", rawRow: row });
      return;
    }
    const account = cell(row, "Account");
    const srNo = cell(row, "Sr. No.") || String(index + 1);
    const narration = cell(row, "Narration");
    const datePart = transactionDate.slice(0, 10);
    const sourceRowId = `${account}:${srNo}:${datePart}:${amountMinor}:${narration}`;

    out.push({
      source: "ecobank",
      sourceRowId,
      transactionDate,
      amountMinor,
      currency: cell(row, "Account Currency") || "GHS",
      payerName: extractEcobankPayerName(narration),
      payerPhoneOrAccount: null,
      providerReference: sourceRowId,
      rawRow: row,
    });
  });

  return { rows: out, rejects, skipped };
}

// ---------------------------------------------------------------------------
// Paystack one-time CSV
// ---------------------------------------------------------------------------
// Columns: Reference, Transaction Date, Customer (fullname), Amount Paid,
// Country Code, Currency, Channel, Status, Transaction ID, …
// Amount Paid is in cedis (GHS) — may include decimals.
// Only "success" status rows are imported.

function parsePaystackOnetimeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Format: "Sep 1st, 2026 05:55:26 AM"
  const m = s.match(/^(\w{3})\s+(\d{1,2})(?:st|nd|rd|th),?\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[m[1].toLowerCase()];
    if (month === undefined) return null;
    const day = Number(m[2]);
    const year = Number(m[3]);
    let hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);
    if (m[7].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (m[7].toUpperCase() === "AM" && hour === 12) hour = 0;
    return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
  }
  return parseDate(s);
}

export function parsePaystackOnetimeRows(rows: RawPaymentRow[]): PaymentParseResult {
  const out: NormalizedPaymentRow[] = [];
  const rejects: PaymentParseReject[] = [];
  const skipped: PaymentParseReject[] = [];

  rows.forEach((row, index) => {
    const status = cell(row, "Status").toLowerCase();
    if (status !== "success") {
      skipped.push({ index, reason: `not successful (${status})`, rawRow: row });
      return;
    }
    const reference = cell(row, "Reference");
    if (!reference) {
      rejects.push({ index, reason: "missing Reference", rawRow: row });
      return;
    }
    const amountStr = cell(row, "Amount Paid");
    // Paystack one-time: Amount Paid is in cedis (may have decimals)
    const amountMinor = parseAmountToMinor(amountStr);
    if (amountMinor == null) {
      rejects.push({ index, reason: "invalid amount", rawRow: row });
      return;
    }
    const transactionDate = parsePaystackOnetimeDate(cell(row, "Transaction Date"));
    if (!transactionDate) {
      rejects.push({ index, reason: "invalid transaction date", rawRow: row });
      return;
    }
    const payerName = cell(row, "Customer (fullname)") || null;
    const channel = cell(row, "Channel");
    const currency = cell(row, "Currency") || "GHS";

    out.push({
      source: "paystack_onetime",
      sourceRowId: reference,
      transactionDate,
      amountMinor,
      currency,
      payerName,
      payerPhoneOrAccount: null,
      providerReference: reference,
      rawRow: { ...row, _payment_method: channel === "mobile_money" ? "paystack_mobile_money" : channel === "bank_transfer" ? "paystack_bank_transfer" : "paystack_card" },
    });
  });

  return { rows: out, rejects, skipped };
}

// ---------------------------------------------------------------------------
// Paystack recurring CSV
// ---------------------------------------------------------------------------
// Columns: First name, Last name, Phone number, Plan amount (GHS) [in pesewas!],
// Total amount paid so far (GHS) [in cedis], Subscription code,
// Most recent payment date, No. of payments, Subscription status, …
// Plan amount (GHS) is in pesewas; Total amount paid so far (GHS) is in cedis.
// Only "active-renewing" and "active-non-renewing" subscriptions are imported.

function parsePaystackRecurringDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Format: "Sep 8, 2026 7:01:27 pm" or "Sep 8, 2026 7:01:00 pm"
  const m = s.match(/^(\w{3})\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[m[1].toLowerCase()];
    if (month === undefined) return null;
    const day = Number(m[2]);
    const year = Number(m[3]);
    let hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);
    if (m[7].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (m[7].toUpperCase() === "AM" && hour === 12) hour = 0;
    return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
  }
  return parseDate(s);
}

export function parsePaystackRecurringRows(rows: RawPaymentRow[]): PaymentParseResult {
  const out: NormalizedPaymentRow[] = [];
  const rejects: PaymentParseReject[] = [];
  const skipped: PaymentParseReject[] = [];

  rows.forEach((row, index) => {
    const status = cell(row, "Subscription status").toLowerCase();
    if (!status.startsWith("active")) {
      skipped.push({ index, reason: `not active (${status})`, rawRow: row });
      return;
    }

    const subscriptionCode = cell(row, "Subscription code");
    if (!subscriptionCode) {
      rejects.push({ index, reason: "missing Subscription code", rawRow: row });
      return;
    }

    // Plan amount (GHS) is in pesewas
    const planAmountPesewas = Number(cell(row, "Plan amount (GHS)"));
    if (Number.isNaN(planAmountPesewas) || planAmountPesewas <= 0) {
      rejects.push({ index, reason: "invalid plan amount", rawRow: row });
      return;
    }
    const amountMinor = planAmountPesewas; // pesewas = minor units

    const transactionDate = parsePaystackRecurringDate(cell(row, "Most recent payment date"));
    if (!transactionDate) {
      rejects.push({ index, reason: "invalid most recent payment date", rawRow: row });
      return;
    }

    const firstName = cell(row, "First name");
    const lastName = cell(row, "Last name");
    const payerName = [firstName, lastName].filter(Boolean).join(" ") || null;
    const phoneRaw = cell(row, "Phone number");
    const payerPhoneOrAccount = phoneRaw ? (normalizePhone(phoneRaw) ?? phoneRaw) : null;

    out.push({
      source: "paystack_recurring",
      sourceRowId: subscriptionCode,
      transactionDate,
      amountMinor,
      currency: "GHS",
      payerName,
      payerPhoneOrAccount,
      providerReference: subscriptionCode,
      rawRow: { ...row, _payment_method: "paystack_card" },
    });
  });

  return { rows: out, rejects, skipped };
}

function partnerPhones(partner: PartnerForPaymentMatch): string[] {
  return [partner.momoPhoneNumber, partner.whatsappNumber]
    .map((phone) => normalizePhone(phone))
    .filter((phone): phone is string => Boolean(phone));
}

function addToMultiMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function matchNormalizedRows(
  rows: NormalizedPaymentRow[],
  partners: PartnerForPaymentMatch[],
): PaymentMatchResult[] {
  const byPhone = new Map<string, PartnerForPaymentMatch>();
  const byName = new Map<string, PartnerForPaymentMatch[]>();
  const byFirstLastName = new Map<string, PartnerForPaymentMatch[]>();

  for (const partner of partners) {
    for (const phone of partnerPhones(partner)) {
      if (!byPhone.has(phone)) byPhone.set(phone, partner);
      const lastNine = ghanaLastNineKey(phone);
      if (lastNine && !byPhone.has(lastNine)) byPhone.set(lastNine, partner);
    }
    const nameKey = normalizePartnerName(partner.fullName);
    if (nameKey) addToMultiMap(byName, nameKey, partner);
    const firstLast = firstLastNameKey(partner.fullName);
    if (firstLast) addToMultiMap(byFirstLastName, firstLast, partner);
  }

  return rows.map((row) => {
    const phone = normalizePhone(row.payerPhoneOrAccount);
    const phoneKey = phone ?? ghanaLastNineKey(row.payerPhoneOrAccount);
    const phoneMatch = phone ? byPhone.get(phone) : undefined;
    const lastNineMatch = phoneKey ? byPhone.get(phoneKey) : undefined;
    if (phoneMatch ?? lastNineMatch) {
      const partner = phoneMatch ?? lastNineMatch;
      return {
        row,
        status: "auto",
        reason: "Exact phone match",
        partner: partner ?? null,
        candidates: partner ? [partner] : [],
      };
    }

    const nameKey = normalizePartnerName(row.payerName);
    const nameMatches = nameKey ? (byName.get(nameKey) ?? []) : [];
    if (nameMatches.length === 1) {
      return {
        row,
        status: "auto",
        reason: "Unique exact name match",
        partner: nameMatches[0],
        candidates: nameMatches,
      };
    }

    const firstLastMatches = firstLastNameKey(row.payerName)
      ? (byFirstLastName.get(firstLastNameKey(row.payerName)) ?? [])
      : [];
    if (firstLastMatches.length === 1) {
      return {
        row,
        status: "auto",
        reason: "Unique first-last name match",
        partner: firstLastMatches[0],
        candidates: firstLastMatches,
      };
    }

    return {
      row,
      status: "review",
      reason:
        nameMatches.length > 1 || firstLastMatches.length > 1
          ? "Multiple exact name matches"
          : "No safe match",
      partner: null,
      candidates: nameMatches.length > 0 ? nameMatches : firstLastMatches,
    };
  });
}

export function bestPartnerPhone(partner: PartnerForPaymentMatch): string | null {
  return normalizePhone(partner.momoPhoneNumber) ?? normalizePhone(partner.whatsappNumber);
}

/** Map a payment source + raw row to a payment_method enum value for the payments table. */
function resolvePaymentMethod(row: NormalizedPaymentRow): string | null {
  const rawMethod = row.rawRow?._payment_method;
  if (typeof rawMethod === "string") return rawMethod;
  switch (row.source) {
    case "momo": return "mobile_money";
    case "ecobank": return "bank_transfer";
    case "paystack_onetime":
    case "paystack_recurring": return "paystack_card";
    default: return null;
  }
}

export function buildPaymentRows(
  matches: Array<{ row: NormalizedPaymentRow; partner: PartnerForPaymentMatch | null }>,
): PocPaymentInsertRow[] {
  return matches.map(({ row, partner }) => ({
    reference: `${row.source}:${row.providerReference}`,
    paid_at: row.transactionDate,
    status: "Successful",
    payer_name: row.payerName ?? partner?.fullName ?? null,
    payer_phone_e164: normalizePhone(row.payerPhoneOrAccount) ?? (partner ? bestPartnerPhone(partner) : null),
    amount_minor: row.amountMinor,
    currency: row.currency || "GHS",
    payment_method: resolvePaymentMethod(row),
    raw_row: {
      ...row.rawRow,
      ...(partner ? { matched_partner_id: partner.id } : {}),
      source: row.source,
    },
  }));
}

export function isPaidInMonth(
  contributions: Array<{ partnerId: string; paidAt: string }>,
  partnerId: string,
  month: string,
): boolean {
  return contributions.some(
    (contribution) => contribution.partnerId === partnerId && contribution.paidAt.slice(0, 7) === month,
  );
}

export function parseJsonArray(raw: string | null | undefined): unknown[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

export function parseJsonObject(raw: string | null | undefined): Record<string, unknown> {
  const text = (raw ?? "").trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
