import { describe, expect, it } from "vitest";
import {
  buildClaimableGivers,
  maskPhone,
  mentionedName,
  usefulNotes,
  type UnassignedGiverRow,
} from "./claim";

describe("maskPhone", () => {
  it("keeps only the last 3 digits", () => {
    expect(maskPhone("+233244123456")).toBe("•••456");
  });
  it("returns null without a usable phone", () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone("12")).toBeNull();
  });
});

describe("usefulNotes", () => {
  it("drops numbers, ministry names and duplicates", () => {
    expect(
      usefulNotes([
        "1",
        "Benmp",
        "BENMP",
        "Tmc tikrom",
        "tmc Tikrom",
        "Healing Jesus Campaign",
        "Techiman",
      ]),
    ).toEqual(["Tmc tikrom", "Techiman"]);
  });
  it("strips Ecobank reference prefixes", () => {
    expect(
      usefulNotes([
        "H29SIP1191790278//5689276204//TRF BO JOHN TANKO BAWA IFO HEALING JESUS CRUSADE",
        "H13yywf262170002//5697499996//RRN:00001678748420260805103732-GIP INCOMING B/O FRANCIS IFO HEALING JESUS CAMPAIGN Transfer",
      ]),
    ).toEqual(["TRF BO JOHN TANKO BAWA", "INCOMING B/O FRANCIS"]);
  });
  it("keeps at most three", () => {
    expect(usefulNotes(["aaa", "bbb", "ccc", "ddd"])).toHaveLength(3);
  });
});

describe("mentionedName", () => {
  it("matches a hub or church name as whole words, any case", () => {
    expect(mentionedName(["Tmc tikrom"], ["Bantama", "Tikrom"])).toBe("Tikrom");
    expect(mentionedName(["parkoso-TMC"], ["Parkoso"])).toBe("Parkoso");
  });
  it("does not match inside a longer word or on very short names", () => {
    expect(mentionedName(["Tikromase"], ["Tikrom"])).toBeNull();
    expect(mentionedName(["Tmc tikrom"], ["TMC"])).toBeNull();
  });
});

describe("buildClaimableGivers", () => {
  const row = (
    id: string,
    last: string,
    notes: string[],
  ): UnassignedGiverRow => ({
    id,
    full_name: `Giver ${id}`,
    phone: "+233244000" + id.padStart(3, "0"),
    country: "Ghana",
    last_gift_at: last,
    gift_count: 1,
    recent_notes: notes,
  });

  it("lists givers who mention the hub first, then newest gift first", () => {
    const rows = [
      row("1", "2026-09-30T00:00:00Z", ["benmp"]),
      row("2", "2026-08-01T00:00:00Z", ["Tikrom branch"]),
      row("3", "2026-09-15T00:00:00Z", []),
    ];
    const givers = buildClaimableGivers(rows, ["Tikrom"]);
    expect(givers.map((g) => [g.id, g.mentions])).toEqual([
      ["2", "Tikrom"],
      ["1", null],
      ["3", null],
    ]);
    expect(givers[0].phoneHint).toBe("•••002");
    expect(JSON.stringify(givers)).not.toContain("+233");
  });
});
