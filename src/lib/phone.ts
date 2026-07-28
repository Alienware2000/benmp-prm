/**
 * Phone normalization to E.164 — the matching key for MoMo payments, messaging, and
 * partner matching across every country in the partner base (not just Ghana).
 *
 * `normalizePhoneForCallingCode` is the general primitive: given a country's calling
 * code and the national-significant-number (NSN) digit lengths that are actually valid
 * for it, it recognizes the shapes real office spreadsheets use (0244123456,
 * +233244123456, 233244123456, bare 244123456) and returns E.164 or null. It never
 * guesses — an input whose digit count doesn't match one of the recognized shapes
 * returns null rather than dumping raw digits behind a "+".
 *
 * `normalizePhone` is the Ghana-specific convenience wrapper every existing caller uses
 * (MoMo statements and the registration sheet carry Ghanaian numbers in exactly the
 * shapes above).
 */

/**
 * Return the E.164 form for a raw phone string given an explicit calling code (digits
 * only, e.g. "233", "44", "1") and the NSN lengths considered valid for it. Recognizes:
 *  - "+<digits>": already international; accepted at 8-15 digits total (E.164 bounds).
 *  - "<cc><nsn>": calling code already present, remainder length in `nsnLengths`.
 *  - "<nsn>": bare national number, length in `nsnLengths` — `cc` is prepended.
 *  - "0<nsn>": national trunk-prefix form — the leading 0 is dropped, `cc` is prepended.
 * Anything else returns null. Never throws.
 */
export function normalizePhoneForCallingCode(
  raw: string | null | undefined,
  cc: string,
  nsnLengths: readonly number[],
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already international: keep the leading +, drop the rest of the noise.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // <cc><nsn>, no leading +
  if (digits.startsWith(cc) && nsnLengths.includes(digits.length - cc.length)) {
    return `+${digits}`;
  }
  // bare NSN, no calling code at all
  if (nsnLengths.includes(digits.length)) {
    return `+${cc}${digits}`;
  }
  // 0<nsn>, national trunk-prefix form
  if (digits.startsWith("0") && nsnLengths.includes(digits.length - 1)) {
    return `+${cc}${digits.slice(1)}`;
  }

  return null;
}

const GHANA_CC = "233";
const GHANA_NSN_LEN = 9; // national significant number length (after the country code / leading 0)

/**
 * Return the E.164 form (e.g. "+233244123456") or null if the input can't be
 * confidently normalized. Never throws.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: "GH" = "GH",
): string | null {
  if (defaultCountry !== "GH") return null;
  return normalizePhoneForCallingCode(raw, GHANA_CC, [GHANA_NSN_LEN]);
}

/** True when two raw phone strings normalize to the same E.164 number. */
export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na !== null && na === nb;
}
