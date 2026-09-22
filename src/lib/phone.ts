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
  // bare NSN, no calling code at all. A leading 0 is never part of an NSN —
  // it is the trunk prefix, handled below — so "024412345" (one digit short
  // of the 0<nsn> form) must not be misread as a 9-digit NSN.
  if (!digits.startsWith("0") && nsnLengths.includes(digits.length)) {
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
 *
 * defaultCountry = "GH": Ghana mobile numbers only (9 NSN digits).
 * defaultCountry = null: international numbers accepted; recognizes explicit
 *   "+" input or a bare digit string of 8-15 digits (best-effort E.164).
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: "GH" | null = "GH",
): string | null {
  if (defaultCountry === "GH") {
    return normalizePhoneForCallingCode(raw, GHANA_CC, [GHANA_NSN_LEN]);
  }

  // International / any-country mode.
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * WhatsApp number for a hub OUTSIDE Ghana (Decision 0027). Spreadsheets from
 * international hubs carry numbers in every shape Ghana's do, but for their own
 * country: "0999 123 456" (local trunk form), "999123456" (Excel dropped the 0),
 * "265999123456" (Excel dropped the +), "+265 999 123 456", "00265…". With the
 * hub's calling code known, every shape resolves to that country; without one,
 * only shapes that carry their own country code are accepted.
 * Returns E.164 or null. Never throws.
 */
export function normalizeWhatsappPhone(
  raw: string | null | undefined,
  callingCode: string | null,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  // "00" is the international dialling prefix in most of the world.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (callingCode) {
    // Already carries its own country code (Excel stripped the "+").
    if (
      digits.startsWith(callingCode) &&
      digits.length - callingCode.length >= 7 &&
      digits.length <= 15
    ) {
      return `+${digits}`;
    }
    // Local trunk form "0…": drop the 0, prepend the hub's country.
    if (digits.startsWith("0")) {
      const nsn = digits.slice(1);
      return nsn.length >= 7 && nsn.length <= 10
        ? `+${callingCode}${nsn}`
        : null;
    }
    // Bare national number (a spreadsheet dropped the leading 0).
    if (digits.length >= 7 && digits.length <= 10) {
      return `+${callingCode}${digits}`;
    }
  }
  // No calling code known, or a longer number: it must carry its own.
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")
    ? `+${digits}`
    : null;
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
