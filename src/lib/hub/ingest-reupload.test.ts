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
  existingPartners: Array<{ partnerId: string; nameKey: string }> = [],
): ValidationContext => ({
  churches,
  hubId: OWN_HUB,
  existingPartners,
  existingPhones: new Map(Object.entries(existing)),
});

const OWN_PHONE = { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB };
const AMA = { partnerId: "p-1", nameKey: "AMA MENSAH" };

describe("same name AND same number: the same person (a re-upload)", () => {
  it("updates that partner", () => {
    const [row] = validateCandidates(
      [cand({ church: "ACC" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBe("p-1");
  });

  it("matches the name regardless of case and spacing", () => {
    const [row] = validateCandidates(
      [cand({ name: "  ama   MENSAH " })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    );
    expect(row.updatesPartnerId).toBe("p-1");
  });

  it("either number can be the match", () => {
    const [row] = validateCandidates(
      [cand({ momoPhone: "0244123456", whatsappPhone: "+233209999999" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBe("p-1");
  });
});

describe("same name, different number: a different person (Decision 0028)", () => {
  // The MSCI case: two real partners share a name. The second must be ADDED;
  // before, it overwrote the first person's number.
  it("is added as a new partner and the existing one is untouched", () => {
    const [row] = validateCandidates(
      [cand({ momoPhone: "0209999999", whatsappPhone: "+233209999999" })],
      ctx({}, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBeNull();
  });

  it("is added even when the hub already has several people with the name", () => {
    const [row] = validateCandidates(
      [
        cand({
          name: "John Tetteh",
          whatsappPhone: "+233209999999",
          momoPhone: "0209999999",
        }),
      ],
      ctx({}, [
        { partnerId: "p-1", nameKey: "JOHN TETTEH" },
        { partnerId: "p-2", nameKey: "JOHN TETTEH" },
      ]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBeNull();
  });
});

describe("same number, different name: a different person", () => {
  // e.g. a couple sharing a phone. Nobody is renamed.
  it("is added, and the existing partner is not renamed", () => {
    const [row] = validateCandidates(
      [cand({ name: "Kwesi Mensah" })],
      ctx({ "+233244123456": OWN_PHONE }, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBeNull();
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
    expect(rows.every((r) => r.updatesPartnerId === null)).toBe(true);
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
  it("has no partner to update", () => {
    const [row] = validateCandidates(
      [cand({ name: "Kofi Boateng" })],
      ctx({}, [AMA]),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBeNull();
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
