/**
 * ITU-T E.164 calling codes (digits only, no "+") for every country currently
 * represented in `public.partners` or its source spreadsheets — the Ghana POC plus the
 * Africa/international/Italy region imports (`scripts/load-region-partners.ts`).
 *
 * This is deliberately just the calling code, not an assumed NSN (national significant
 * number) length: real office spreadsheets mix formats per country, and guessing a fixed
 * NSN length from memory is exactly the "sloppy country code" failure mode to avoid. The
 * loader derives each country's valid NSN lengths empirically from its own data instead
 * (see `calibrateNsnLengths` there) and uses this table only to recognize the calling
 * code prefix and as the cross-country fallback when a sheet contains a diaspora number
 * written in a different country's format.
 *
 * NANP members (calling code "1") are listed individually because the sheets are
 * organized by country, but they share one calling code — disambiguation between them
 * lives in the area code inside the national number, not here.
 */
export const COUNTRY_CALLING_CODES: Readonly<Record<string, string>> = {
  Ghana: "233",

  // Africa
  Botswana: "267",
  Benin: "229",
  Cameroon: "237",
  "Burkina Faso": "226",
  "Côte d'Ivoire": "225",
  "Central African Republic": "236",
  "Congo-Brazzaville": "242",
  "DR Congo": "243",
  Ethiopia: "251",
  "Equatorial Guinea": "240",
  Gabon: "241",
  Gambia: "220",
  "Guinea-Bissau": "245",
  Guinea: "224",
  Kenya: "254",
  Liberia: "231",
  Lesotho: "266",
  Malawi: "265",
  Mali: "223",
  Mozambique: "258",
  Namibia: "264",
  Nigeria: "234",
  Niger: "227",
  Rwanda: "250",
  Senegal: "221",
  Seychelles: "248",
  "Sierra Leone": "232",
  "South Africa": "27",
  Eswatini: "268",
  Tanzania: "255",
  Togo: "228",
  Uganda: "256",
  Zambia: "260",
  Zimbabwe: "263",

  // International
  "Antigua and Barbuda": "1",
  Australia: "61",
  Austria: "43",
  Barbados: "1",
  Belgium: "32",
  Brazil: "55",
  "United Arab Emirates": "971",
  Fiji: "679",
  Qatar: "974",
  France: "33",
  Germany: "49",
  Guyana: "592",
  Netherlands: "31",
  Hungary: "36",
  India: "91",
  Italy: "39",
  Jamaica: "1",
  "New Zealand": "64",
  Philippines: "63",
  "Papua New Guinea": "675",
  Portugal: "351",
  Samoa: "685",
  "Solomon Islands": "677",
  "Saint Kitts and Nevis": "1",
  Spain: "34",
  "Saint Lucia": "1",
  Switzerland: "41",
  Sweden: "46",
  Thailand: "66",
  Tonga: "676",
  "Trinidad and Tobago": "1",
  "United Kingdom": "44",
  "United States": "1",
  Vanuatu: "678",
};
