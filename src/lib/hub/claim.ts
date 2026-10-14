// src/lib/hub/claim.ts
// What a hub admin sees when claiming an unassigned giver (Decision 0033): enough to
// recognise their own member, nothing more. The phone is masked to its last 3 digits
// here on the server, the payer notes are cleaned of bank boilerplate, and a giver
// whose notes name this hub or one of its churches is flagged and listed first.

export type UnassignedGiverRow = {
  id: string;
  full_name: string;
  phone: string | null;
  country: string | null;
  last_gift_at: string;
  gift_count: number;
  recent_notes: string[] | null;
};

export type ClaimableGiver = {
  id: string;
  name: string;
  /** "•••123", or null when there is no phone. */
  phoneHint: string | null;
  lastGiftAt: string;
  giftCount: number;
  notes: string[];
  /** The hub or church name a note mentions, when one does. */
  mentions: string | null;
};

export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 3 ? `•••${digits.slice(-3)}` : null;
}

/** Notes that say nothing about who or where the giver is. */
const UNINFORMATIVE =
  /^(benmp|hjc|hjcm|healing jesus( campaign| crusade)?|offering|seed|tithe|partner(ship)?|donation|payment|momo|transfer)$/i;

/** A run of 7+ digits (spaces, dashes allowed): a phone or account number. */
const LONG_NUMBER = /\+?\d(?:[\s-]?\d){6,}/g;

/** Mask every long number in free text (names made from bank narrations carry account numbers). */
export const maskNumbers = (text: string) =>
  text.replace(LONG_NUMBER, (m) => maskPhone(m) ?? "");

/**
 * Strip Ecobank's boilerplate from a narration: the reference prefix
 * ("H29SIP…//5689…//"), the "RRN:…" token, and the "IFO HEALING JESUS …" tail.
 * Givers often type their phone into the note ("0244…820-Hub 1"), so long numbers
 * are masked like the phone column.
 */
function cleanNote(note: string): string {
  return maskNumbers(
    note
      .replace(/^[^\s/]*\/\/[^\s/]*\/\//, "")
      .replace(/RRN:\S+/g, "")
      .replace(/\bIFO HEALING JESUS\b.*$/i, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function usefulNotes(
  notes: string[] | null | undefined,
  max = 3,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of notes ?? []) {
    const note = cleanNote(raw);
    if (note.length < 3 || !/[a-z]/i.test(note) || UNINFORMATIVE.test(note))
      continue;
    const key = note.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(note);
    if (out.length === max) break;
  }
  return out;
}

const normalize = (s: string) =>
  ` ${s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()} `;

/**
 * The first hub/church name that appears as whole words in any note. Names shorter
 * than 4 letters are skipped: too many accidental hits ("TMC", "AG").
 */
export function mentionedName(notes: string[], names: string[]): string | null {
  const haystacks = notes.map(normalize);
  for (const name of names) {
    const needle = normalize(name);
    if (needle.trim().length < 4) continue;
    if (haystacks.some((h) => h.includes(needle))) return name;
  }
  return null;
}

/**
 * Rows for the claim screen, givers who mention this hub first, then the most
 * recent gift first. `names` is the hub's own name followed by its church names.
 */
export function buildClaimableGivers(
  rows: UnassignedGiverRow[],
  names: string[],
): ClaimableGiver[] {
  return rows
    .map((row) => {
      const notes = usefulNotes(row.recent_notes);
      return {
        id: row.id,
        name: maskNumbers(row.full_name),
        phoneHint: maskPhone(row.phone),
        lastGiftAt: row.last_gift_at,
        giftCount: row.gift_count,
        notes,
        mentions: mentionedName(notes, names),
      };
    })
    .sort(
      (a, b) =>
        Number(!!b.mentions) - Number(!!a.mentions) ||
        b.lastGiftAt.localeCompare(a.lastGiftAt),
    );
}
