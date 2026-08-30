import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeChurchKey, parseHubSeed } from "./seed";

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
