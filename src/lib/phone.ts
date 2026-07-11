/**
 * Phone normalization to E.164 — the matching key for MoMo payments and messaging.
 *
 * Ghana-first: MoMo statements and the registration sheet carry numbers in mixed
 * shapes (0244123456, +233244123456, 233244123456, or a bare 244123456). Matching a
 * payment to a partner is only reliable once both sides collapse to one canonical form.
 */

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
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already international: keep the leading +, drop the rest of the noise.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (defaultCountry === "GH") {
    // 0244123456 (leading-zero national form)
    if (digits.length === GHANA_NSN_LEN + 1 && digits.startsWith("0")) {
      return `+${GHANA_CC}${digits.slice(1)}`;
    }
    // 233244123456 (country code, no +)
    if (digits.length === GHANA_CC.length + GHANA_NSN_LEN && digits.startsWith(GHANA_CC)) {
      return `+${digits}`;
    }
    // 244123456 (bare national significant number, leading zero dropped)
    if (digits.length === GHANA_NSN_LEN) {
      return `+${GHANA_CC}${digits}`;
    }
  }

  // Some other country code baked in without a +: best effort.
  if (digits.length >= 11) return `+${digits}`;

  return null;
}

/** True when two raw phone strings normalize to the same E.164 number. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na !== null && na === nb;
}
