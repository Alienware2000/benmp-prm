import { describe, expect, it } from "vitest";
import {
  validateCandidates,
  type CandidateRow,
  type ValidationContext,
} from "./ingest";

/**
 * Re-upload behaviour (Decision 0024): a hub admin re-uploading a corrected sheet
 * edits their OWN partners, but can never take over another hub's.
 */

const churches: ValidationContext["churches"] = [
  { id: "c-agona", name: "Agona Nkwanta", nameKey: "AGONA NKWANTA" },
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
  >,
): ValidationContext => ({
  churches,
  hubId: OWN_HUB,
  existingPhones: new Map(Object.entries(existing)),
});

describe("re-upload of a partner this hub already owns", () => {
  it("is an edit, not an error", () => {
    const [row] = validateCandidates(
      [cand({ name: "Ama Mensah-Boateng" })],
      ctx({
        "+233244123456": {
          hubNumber: 5,
          partnerId: "p-1",
          hubId: OWN_HUB,
        },
      }),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBe("p-1");
  });

  it("matches on the MoMo number as well as WhatsApp", () => {
    const [row] = validateCandidates(
      [cand()],
      ctx({
        "+233244123456": { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB },
      }),
    );
    expect(row.updatesPartnerId).toBe("p-1");
  });
});

describe("a number owned by another hub", () => {
  it("is still blocked, and names the hub", () => {
    const [row] = validateCandidates(
      [cand()],
      ctx({
        "+233244123456": {
          hubNumber: 12,
          partnerId: "p-9",
          hubId: OTHER_HUB,
        },
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

describe("ambiguous matches", () => {
  it("refuses a row whose two numbers belong to two different people", () => {
    // Updating either one would silently corrupt the other, so the admin resolves it.
    const [row] = validateCandidates(
      [cand({ momoPhone: "0244123456", whatsappPhone: "+233209999999" })],
      ctx({
        "+233244123456": { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB },
        "+233209999999": { hubNumber: 5, partnerId: "p-2", hubId: OWN_HUB },
      }),
    );
    expect(row.updatesPartnerId).toBeNull();
    expect(row.issues.map((i) => i.message).join(" ")).toContain(
      "two different people",
    );
  });

  it("allows both numbers pointing at the SAME existing partner", () => {
    const [row] = validateCandidates(
      [cand({ momoPhone: "0244123456", whatsappPhone: "+233209999999" })],
      ctx({
        "+233244123456": { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB },
        "+233209999999": { hubNumber: 5, partnerId: "p-1", hubId: OWN_HUB },
      }),
    );
    expect(row.issues).toEqual([]);
    expect(row.updatesPartnerId).toBe("p-1");
  });
});

describe("a genuinely new person", () => {
  it("has no partner to update", () => {
    const [row] = validateCandidates([cand()], ctx({}));
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
