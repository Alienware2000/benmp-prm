/**
 * Calling code for each country a hub can be stamped with (hubs.country), so an
 * international hub's WhatsApp numbers resolve to its own country rather than to
 * Ghana (Decision 0027). Countries seeded in scripts/data/*-hubs-churches.json.
 * A hub whose country isn't here (or "Europe", "Asia", which span many) gets
 * null: its numbers must then carry their own country code.
 */
const CALLING_CODES: Record<string, string> = {
  Ghana: "233",
  Benin: "229",
  "Burkina Faso": "226",
  Burundi: "257",
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
  // ESCHATOS: every country is a hub (Decisions 0034, 0035), read with full
  // national rules in src/lib/phone.ts. Jamaica shares +1 with North America;
  // "1876" adds its area code so a bare local number resolves to Jamaica, not the US.
  Brazil: "55",
  Jamaica: "1876",
  "Costa Rica": "506",
  Guatemala: "502",
  Nicaragua: "505",
  Panama: "507",
  Guyana: "592",
  Colombia: "57",
  Chile: "56",
  Paraguay: "595",
  Bangladesh: "880",
  Cambodia: "855",
  India: "91",
  Malaysia: "60",
  Taiwan: "886",
  Thailand: "66",
  Vietnam: "84",
  Morocco: "212",
  Qatar: "974",
  "United Arab Emirates": "971",
  UAE: "971",
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
