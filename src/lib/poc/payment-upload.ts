import { normalizePhone } from "../phone";
import { collapseDoubledName, parseAmountToMinor } from "../ingest";

export type PaymentSource = "momo" | "ecobank";

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
    const payerPhoneOrAccount = normalizePhone(cell(row, "From account"));
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

function partnerPhones(partner: PartnerForPaymentMatch): string[] {
  return [partner.momoPhoneNumber, partner.whatsappNumber]
    .map((phone) => normalizePhone(phone))
    .filter((phone): phone is string => Boolean(phone));
}

export function matchNormalizedRows(
  rows: NormalizedPaymentRow[],
  partners: PartnerForPaymentMatch[],
): PaymentMatchResult[] {
  const byPhone = new Map<string, PartnerForPaymentMatch>();
  const byName = new Map<string, PartnerForPaymentMatch[]>();

  for (const partner of partners) {
    for (const phone of partnerPhones(partner)) if (!byPhone.has(phone)) byPhone.set(phone, partner);
    const nameKey = normalizePartnerName(partner.fullName);
    if (nameKey) byName.set(nameKey, [...(byName.get(nameKey) ?? []), partner]);
  }

  return rows.map((row) => {
    const phone = normalizePhone(row.payerPhoneOrAccount);
    const phoneMatch = phone ? byPhone.get(phone) : undefined;
    if (phoneMatch) {
      return {
        row,
        status: "auto",
        reason: "Exact phone match",
        partner: phoneMatch,
        candidates: [phoneMatch],
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

    return {
      row,
      status: "review",
      reason: nameMatches.length > 1 ? "Multiple exact name matches" : "No safe match",
      partner: null,
      candidates: nameMatches,
    };
  });
}

export function bestPartnerPhone(partner: PartnerForPaymentMatch): string | null {
  return normalizePhone(partner.momoPhoneNumber) ?? normalizePhone(partner.whatsappNumber);
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
