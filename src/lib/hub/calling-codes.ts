/**
 * Calling code for each country a hub can be stamped with (hubs.country), so an
 * international hub's WhatsApp numbers resolve to its own country rather than to
 * Ghana (Decision 0027). Countries seeded in scripts/data/*-hubs-churches.json.
 * A hub whose country isn't here (or "Europe", which spans many) gets null: its
 * numbers must then carry their own country code.
 */
const CALLING_CODES: Record<string, string> = {
  Ghana: "233",
  Benin: "229",
  "Burkina Faso": "226",
  "Cape Verde": "238",
  "Central African Republic": "236",
  Chad: "235",
  Congo: "242",
  "Equatorial Guinea": "240",
  Eswatini: "268",
  Gabon: "241",
  Gambia: "220",
  "Guinea Conakry": "224",
  Guinea: "224",
  "Guinea-Bissau": "245",
  Kenya: "254",
  Lesotho: "266",
  Liberia: "231",
  Malawi: "265",
  Mali: "223",
  Mozambique: "258",
  Namibia: "264",
  Niger: "227",
  Nigeria: "234",
  Rwanda: "250",
  "São Tomé": "239",
  "Sao Tome": "239",
  Senegal: "221",
  Seychelles: "248",
  "South Africa": "27",
  Tanzania: "255",
  Togo: "228",
  Uganda: "256",
  "South Sudan": "211",
};

/** Calling code digits (no "+") for a hub's country, or null when unknown/mixed. */
export function callingCodeForCountry(
  country: string | null | undefined,
): string | null {
  if (!country) return null;
  const key = country.trim();
  if (CALLING_CODES[key]) return CALLING_CODES[key];
  // "Uganda & South Sudan" style: take the first named country.
  const first = key.split(/\s*[&/,]\s*/)[0];
  return CALLING_CODES[first] ?? null;
}
