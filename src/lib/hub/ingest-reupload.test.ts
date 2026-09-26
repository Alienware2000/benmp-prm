import { describe, expect, it } from "vitest";
import {
  validateCandidates,
  type CandidateRow,
  type ValidationContext,
} from "./ingest";

/**
 * Re-upload behaviour (Decisions 0024, 0028): a hub admin re-uploading a corrected sheet
 * edits their OWN partners, but can never take over another hub's.
 */

const churches: ValidationContext["churches"] = [
  { id: "c-agona", name: "Agona Nkwanta", nameKey: "AGONA NKWANTA" },
  { id: "c-acc", name: "ACC", nameKey: "ACC" },
];

const OWN_HUB = "hub-5";
const OTHER_HUB = "hub-12";

const cand = (over: Partial<CandidateRow> = {}): CandidateRow => ({
  rowIndex: 2,
  raw: [],
  name: "Ama Mensah",
  momoPhone: "0244123456",
  whatsappPhone: "+233244123456",
  church: "Agona Nkwanta",
  ...over,
});

const ctx = (
  existing: Record<
    string,
    { hubNumber: number | null; partnerId?: string; hubId?: string | null }
  > = {},
  existingPartners: Array<{
    partnerId: string;
    nameKey: string;
    name?: string;
  }> = [],
): ValidationContext => ({
  churches,
  hubId: OWN_HUB,
  existingPartners,
  existingPhones: new Map(Object.entries(existing)),
});

const OWN_PHONE = { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB };
const AMA = { partnerId: "p-1", nameKey: "AMA MENSAH", name: "Ama Mensah" };

describe("same person: name AND number both match (Decision 0028)", () => {
  it("updates that partner without asking", () => {
    const [row] = validateCandidates(
      [cand({ church: "ACC" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBe("p-1");
    expect(row.matchChoices).toEqual([]);
  });

  it("matches the name regardless of case and spacing", () => {
    const [row] = validateCandidates(
      [cand({ name: "  ama   MENSAH " })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    );
    expect(row.updatesPartnerId).toBe("p-1");
  });

  it("matches on either number: both pointing at the same partner is fine", () => {
    const [row] = validateCandidates(
      [cand({ momoPhone: "0244123456", whatsappPhone: "+233209999999" })],
      ctx(
        {
          "+233244123456": OWN_PHONE,
          "+233209999999": OWN_PHONE,
        },
        [AMA],
      ),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBe("p-1");
  });
});

describe("only the name matches: ask, never guess", () => {
  // The MSCI case: a second John Mensah used to OVERWRITE the first one's number.
  const row = (match?: string) =>
    validateCandidates(
      [
        cand({
          momoPhone: "0209999999",
          whatsappPhone: "+233209999999",
          match,
        }),
      ],
      ctx({}, [AMA]),
    )[0];

  it("asks the admin, offering the existing person", () => {
    const r = row();
    expect(r.updatesPartnerId).toBeNull();
    expect(r.issues.map((i) => i.field)).toEqual(["match"]);
    expect(r.matchChoices.map((c) => c.partnerId)).toEqual(["p-1"]);
    expect(r.matchChoices[0].name).toBe("Ama Mensah");
  });

  it("'same person' updates them (a corrected number)", () => {
    const r = row("p-1");
    expect(r.issues).toEqual([]);
    expect(r.updatesPartnerId).toBe("p-1");
  });

  it("'different person' adds a second partner with the same name", () => {
    const r = row("new");
    expect(r.issues).toEqual([]);
    expect(r.updatesPartnerId).toBeNull();
  });

  it("offers every existing partner who shares the name", () => {
    const r = validateCandidates(
      [cand({ name: "John Tetteh", match: "p-2" })],
      ctx({}, [
        { partnerId: "p-1", nameKey: "JOHN TETTEH" },
        { partnerId: "p-2", nameKey: "JOHN TETTEH" },
      ]),
    )[0];
    expect(r.issues).toEqual([]);
    expect(r.updatesPartnerId).toBe("p-2");
    expect(r.matchChoices).toHaveLength(2);
  });

  it("an answer that is not one of the choices is not accepted", () => {
    const r = row("p-999");
    expect(r.updatesPartnerId).toBeNull();
    expect(r.issues.map((i) => i.field)).toEqual(["match"]);
  });
});

describe("only the number matches: ask, never guess", () => {
  // A corrected name, or two people sharing a phone (a couple).
  it("asks, then renames on 'same person' or adds on 'different person'", () => {
    const ask = validateCandidates(
      [cand({ name: "Kwesi Mensah" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    )[0];
    expect(ask.issues.map((i) => i.field)).toEqual(["match"]);
    expect(ask.matchChoices.map((c) => c.partnerId)).toEqual(["p-1"]);

    const same = validateCandidates(
      [cand({ name: "Kwesi Mensah", match: "p-1" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    )[0];
    expect(same.updatesPartnerId).toBe("p-1");

    const other = validateCandidates(
      [cand({ name: "Kwesi Mensah", match: "new" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    )[0];
    expect(other.issues).toEqual([]);
    expect(other.updatesPartnerId).toBeNull();
  });

  it("name and number pointing at two different people offers both", () => {
    const r = validateCandidates(
      [cand()],
      ctx(
        { "+233244123456": { hubNumber: 5, partnerId: "p-2", hubId: OWN_HUB } },
        [AMA],
      ),
    )[0];
    expect(r.updatesPartnerId).toBeNull();
    expect(r.matchChoices.map((c) => c.partnerId).sort()).toEqual([
      "p-1",
      "p-2",
    ]);
  });
});

describe("within one file", () => {
  it("two rows with the same name but different numbers are two people", () => {
    const rows = validateCandidates(
      [
        cand({
          rowIndex: 2,
          name: "John Mensah",
          whatsappPhone: "+447700900101",
          momoPhone: "0244123456",
        }),
        cand({
          rowIndex: 3,
          name: "John Mensah",
          whatsappPhone: "+447700900202",
          momoPhone: "0244123457",
        }),
      ],
      ctx(),
    );
    expect(rows.every((r) => r.issues.length === 0)).toBe(true);
  });

  it("the same name and WhatsApp number twice is a duplicate row", () => {
    const rows = validateCandidates(
      [
        cand({ rowIndex: 2, name: "John Mensah" }),
        cand({ rowIndex: 7, name: "john  mensah" }),
      ],
      ctx(),
    );
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues[0].message).toMatch(/row 2/);
  });

  it("two rows cannot both update the same existing person", () => {
    const rows = validateCandidates(
      [
        cand({
          rowIndex: 2,
          whatsappPhone: "+233209999998",
          momoPhone: "0209999998",
          match: "p-1",
        }),
        cand({
          rowIndex: 3,
          whatsappPhone: "+233209999999",
          momoPhone: "0209999999",
          match: "p-1",
        }),
      ],
      ctx({}, [AMA]),
    );
    expect(rows[0].updatesPartnerId).toBe("p-1");
    expect(rows[1].updatesPartnerId).toBeNull();
    expect(rows[1].issues[0].message).toMatch(/Row 2 .* already updates/);
  });
});

describe("a number owned by another hub", () => {
  it("is still blocked, and names the hub", () => {
    const [row] = validateCandidates(
      [cand()],
      ctx({
        "+233244123456": { hubNumber: 12, partnerId: "p-9", hubId: OTHER_HUB },
      }),
    );
    expect(row.updatesPartnerId).toBeNull();
    expect(row.issues.map((i) => i.message)).toContain(
      "This number is already in the system for Hub 12.",
    );
  });

  it("is still blocked when the partner predates hubs", () => {
    const [row] = validateCandidates(
      [cand()],
      ctx({ "+233244123456": { hubNumber: null, hubId: null } }),
    );
    expect(row.updatesPartnerId).toBeNull();
    expect(row.issues).not.toEqual([]);
  });
});

describe("a genuinely new person", () => {
  it("has no partner to update and nothing to ask", () => {
    const [row] = validateCandidates(
      [cand({ name: "Kofi Boateng" })],
      ctx({}, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBeNull();
    expect(row.matchChoices).toEqual([]);
  });
});

describe("without a hub in context", () => {
  it("blocks every existing number, as before", () => {
    // The staff-side callers pass no hubId; they must not gain edit powers by default.
    const [row] = validateCandidates([cand()], {
      churches,
      existingPhones: new Map([
        ["+233244123456", { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB }],
      ]),
    });
    expect(row.updatesPartnerId).toBeNull();
    expect(row.issues).not.toEqual([]);
  });
});
