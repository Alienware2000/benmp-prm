/**
 * First-name extraction for personalised broadcasts.
 *
 * The archived Ghana list is office-typed data: 99% carry a usable first name, but the
 * casing is inconsistent (1,549 are ALL CAPS, 17 all-lowercase) and a minority are
 * titles, initials or placeholders rather than names. "Dear LYDIA," reads as shouting
 * and "Dear MR." reads as broken, so both must fall back or be repaired before sending.
 *
 * Deliberately conservative: anything not clearly a person's given name becomes the
 * neutral fallback. Addressing someone as "Dear Partner" is unremarkable; addressing
 * them as "Dear FL73" is not.
 */

/** Prefixes that are a title, not a name — the next word is the actual given name. */
const TITLES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "rev",
  "pastor",
  "ps",
  "bishop",
  "eld",
  "elder",
  "prof",
  "sir",
  "madam",
  "mad",
  "apostle",
  "evang",
  "evangelist",
  "deacon",
  "hon",
]);

export const FALLBACK_GREETING_NAME = "Partner";

/** Title Case one word, preserving internal hyphens and apostrophes (Ama-Serwaa, D'Almeida). */
function titleCase(word: string): string {
  return word.replace(
    /[A-Za-zÀ-ɏ]+/g,
    (part) => part[0].toUpperCase() + part.slice(1).toLowerCase(),
  );
}

/**
 * The name to greet someone by, or `FALLBACK_GREETING_NAME` when the record has no
 * usable one.
 *
 * Rules, in order: strip titles; require a run of letters at least two long (so "K."
 * and initials fall back); reject anything containing a digit; then normalise casing.
 */
export function greetingName(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return FALLBACK_GREETING_NAME;
  // The directory renders unusable names as this sentinel; treat it as absent.
  if (trimmed.toLowerCase() === "unknown") return FALLBACK_GREETING_NAME;

  const words = trimmed.split(/\s+/).filter(Boolean);
  for (const word of words) {
    const bare = word.replace(/[.,]/g, "");
    if (TITLES.has(bare.toLowerCase())) continue; // a title, keep looking
    // A name is letters (plus hyphen/apostrophe), at least two long, with no digits.
    if (!/^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'’-]+$/.test(bare)) {
      return FALLBACK_GREETING_NAME;
    }
    return titleCase(bare);
  }
  // Every word was a title.
  return FALLBACK_GREETING_NAME;
}
