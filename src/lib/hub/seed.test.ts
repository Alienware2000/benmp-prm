import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeChurchKey, parseHubSeed, parseNamedHubSeed } from "./seed";

const validDoc = {
  hubs: [
    { hubNumber: 1, leader: "Ama Mensah", churches: ["Agona Nkwanta", "ACC"] },
    { hubNumber: 2, leader: "Kofi Boateng", churches: ["Akropong"] },
    { hubNumber: 3, leader: "Yaw Owusu", churches: ["Akropong", "Tesano"] },
  ],
};

describe("normalizeChurchKey", () => {
  it("collapses case and whitespace", () => {
    expect(normalizeChurchKey("  agona   nkwanta ")).toBe("AGONA NKWANTA");
    expect(normalizeChurchKey("Agona Nkwanta")).toBe("AGONA NKWANTA");
  });

  it("strips invisible characters (real workbook had word-joiners)", () => {
    expect(normalizeChurchKey("⁠akrokerri")).toBe("AKROKERRI");
    expect(normalizeChurchKey("﻿Assin​ Juaso")).toBe("ASSIN JUASO");
  });
});

describe("parseHubSeed", () => {
  it("accepts a valid document, counting churches per hub", () => {
    const parsed = parseHubSeed(validDoc);
    expect(parsed.hubs).toHaveLength(3);
    expect(parsed.churchCount).toBe(5);
  });

  it("allows the same church name in different hubs", () => {
    // Akropong exists in hubs 2 and 3 above — real churches share names across hubs.
    expect(() => parseHubSeed(validDoc)).not.toThrow();
  });

  it("rejects a duplicate church within one hub, case-insensitively", () => {
    const doc = {
      hubs: [{ hubNumber: 1, leader: "A B", churches: ["Tesano", "TESANO "] }],
    };
    expect(() => parseHubSeed(doc)).toThrow(/duplicate church/);
  });

  it("rejects duplicate and gapped hub numbers", () => {
    expect(() =>
      parseHubSeed({
        hubs: [
          { hubNumber: 1, leader: "A B", churches: ["X Y"] },
          { hubNumber: 1, leader: "C D", churches: ["Z W"] },
        ],
      }),
    ).toThrow(/duplicate hubNumber/);
    expect(() =>
      parseHubSeed({
        hubs: [
          { hubNumber: 1, leader: "A B", churches: ["X Y"] },
          { hubNumber: 3, leader: "C D", churches: ["Z W"] },
        ],
      }),
    ).toThrow(/gap/);
  });

  it("rejects empty leaders, empty church lists, and empty names", () => {
    expect(() =>
      parseHubSeed({ hubs: [{ hubNumber: 1, leader: " ", churches: ["X"] }] }),
    ).toThrow(/leader/);
    expect(() =>
      parseHubSeed({ hubs: [{ hubNumber: 1, leader: "A", churches: [] }] }),
    ).toThrow(/non-empty array/);
    expect(() =>
      parseHubSeed({ hubs: [{ hubNumber: 1, leader: "A", churches: [""] }] }),
    ).toThrow(/empty church name/);
  });

  it("validates the real committed seed: 31 hubs, 810 churches", () => {
    const doc = JSON.parse(
      readFileSync(
        join(__dirname, "../../../scripts/data/ghana-hubs-churches.json"),
        "utf8",
      ),
    );
    const parsed = parseHubSeed(doc);
    expect(parsed.hubs).toHaveLength(31);
    expect(parsed.churchCount).toBe(810);
    expect(parsed.hubs.map((h) => h.hubNumber)).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
  });
});

describe("parseNamedHubSeed", () => {
  const hub = (over: Record<string, unknown> = {}) => ({
    name: "Kpandai",
    leader: "Ps George Akuobeagye Kumah",
    churches: ["Kpandai Main", "Jetiman"],
    ...over,
  });

  it("accepts a well-formed named region and counts churches", () => {
    const out = parseNamedHubSeed({
      hubs: [hub(), hub({ name: "Tumu", churches: ["Tumu"] })],
    });
    expect(out.hubs.map((h) => h.name)).toEqual(["Kpandai", "Tumu"]);
    expect(out.churchCount).toBe(3);
  });

  it("defaults displayName to the name and allows an override", () => {
    const out = parseNamedHubSeed({
      hubs: [hub(), hub({ name: "Mankesim", displayName: "Mankessim" })],
    });
    expect(out.hubs[0].displayName).toBe("Kpandai");
    expect(out.hubs[1].displayName).toBe("Mankessim");
  });

  it("rejects two hubs whose names differ only by case or spacing", () => {
    expect(() =>
      parseNamedHubSeed({
        hubs: [hub({ name: "Tamale North" }), hub({ name: "TAMALE  north" })],
      }),
    ).toThrow(/duplicate hub name/);
  });

  it("rejects a duplicate church inside one hub", () => {
    expect(() =>
      parseNamedHubSeed({ hubs: [hub({ churches: ["Kanimo", "KANIMO"] })] }),
    ).toThrow(/duplicate church/);
  });

  it("rejects a hub with no churches, and reports every problem at once", () => {
    expect(() =>
      parseNamedHubSeed({ hubs: [hub({ churches: [] }), hub({ name: "  " })] }),
    ).toThrow(
      /churches must be a non-empty array[\s\S]*name must be a non-empty string/,
    );
  });

  it("allows a blank leader — Wa arrived without an admin name", () => {
    const out = parseNamedHubSeed({
      hubs: [hub({ name: "Wa", leader: undefined })],
    });
    expect(out.hubs[0].leader).toBe("");
  });

  it("does not require contiguity the way the numbered seed does", () => {
    expect(() =>
      parseNamedHubSeed({ hubs: [hub({ name: "Zebilla" })] }),
    ).not.toThrow();
  });
});

describe("the real UJ Ghana seed file", () => {
  const doc = JSON.parse(
    readFileSync(
      join(__dirname, "../../../scripts/data/uj-hubs-churches.json"),
      "utf8",
    ),
  );

  it("parses to 26 hubs and 321 churches", () => {
    const parsed = parseNamedHubSeed(doc);
    expect(parsed.hubs).toHaveLength(26);
    expect(parsed.churchCount).toBe(321);
  });

  it("holds the office's cross-hub rulings", () => {
    const by = new Map(
      parseNamedHubSeed(doc).hubs.map((h) => [
        h.name,
        h.churches.map(normalizeChurchKey),
      ]),
    );
    // Gballa -> Walewale only, Yankazia -> Gushegu only, Nanori -> Nalerigu only.
    expect(by.get("Walewale")).toContain("GBALLA");
    expect(by.get("Nalerigu")).not.toContain("GBALLA");
    expect(by.get("Gushegu")).toContain("YANKAZIA");
    expect(by.get("Nalerigu")).not.toContain("YANKAZIA");
    expect(by.get("Nalerigu")).toContain("NANORI");
    expect(by.get("Walewale")).not.toContain("NANORI");
    // Gilgal is not a hub; its two churches sit under JITM.
    expect([...by.keys()]).not.toContain("Gilgal");
    expect(by.get("JITM")).toEqual(
      expect.arrayContaining(["GILGAL", "KOKROBITE"]),
    );
  });

  it("gives every hub at least one church, Wa included", () => {
    for (const h of parseNamedHubSeed(doc).hubs) {
      expect(h.churches.length, h.name).toBeGreaterThan(0);
    }
  });
});
