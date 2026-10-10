import { describe, expect, it } from "vitest";
import { MAX_IN_LIST_CHARS, inListChunks } from "./in-list";

describe("inListChunks", () => {
  it("returns no chunks for no values", () => {
    expect(inListChunks([])).toEqual([]);
  });

  it("keeps short values in one chunk, URL-encoded and comma-joined", () => {
    expect(inListChunks(["momo:1", "momo:2"])).toEqual(["momo%3A1,momo%3A2"]);
  });

  it("splits long references so no chunk exceeds the limit", () => {
    // Ecobank references embed the narration: ~130 chars, ~170 once encoded.
    const refs = Array.from({ length: 111 }, (_, i) => `ecobank::${i}:2026-09-01:5000:TRANSFER FROM PARTNER NAME // B/O SOMEONE ${"X".repeat(60)}`);
    const chunks = inListChunks(refs);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(MAX_IN_LIST_CHARS);
    expect(chunks.join(",").split(",").map(decodeURIComponent)).toEqual(refs);
  });

  it("caps the number of values per chunk", () => {
    const chunks = inListChunks(Array.from({ length: 250 }, (_, i) => String(i)), { maxValues: 100 });
    expect(chunks.map((c) => c.split(",").length)).toEqual([100, 100, 50]);
  });

  it("puts a single oversized value in its own chunk rather than dropping it", () => {
    const huge = "y".repeat(MAX_IN_LIST_CHARS + 10);
    expect(inListChunks(["a", huge, "b"])).toEqual(["a", huge, "b"]);
  });
});
