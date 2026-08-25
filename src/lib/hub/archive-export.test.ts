import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("archive CSV export", () => {
  it("quotes commas, quotes, and newlines; serializes objects; empties nulls", () => {
    const csv = toCsv([
      { name: 'Ama "Junior" Mensah', note: "a,b", raw: { x: 1 }, gone: null },
      { name: "Kofi\nBoateng", note: "plain", raw: null, gone: "ok" },
    ]);
    expect(csv.split("\n")[0]).toBe("name,note,raw,gone");
    expect(csv).toContain('"Ama ""Junior"" Mensah","a,b","{""x"":1}",');
    expect(csv).toContain('"Kofi\nBoateng",plain,,ok');
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
