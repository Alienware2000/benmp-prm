import { describe, expect, it } from "vitest";
import { computeFileHash, findDuplicateBatch, type ExistingBatch } from "./import-dedup";

describe("computeFileHash", () => {
  it("returns a 64-char hex string", () => {
    const buf = new ArrayBuffer(4);
    const view = new Uint8Array(buf);
    view[0] = 1; view[1] = 2; view[2] = 3; view[3] = 4;
    const hash = computeFileHash(buf);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same content produces same hash", () => {
    const buf1 = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const buf2 = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    expect(computeFileHash(buf1)).toBe(computeFileHash(buf2));
  });

  it("differs for different content", () => {
    const buf1 = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const buf2 = new TextEncoder().encode("hello earth").buffer as ArrayBuffer;
    expect(computeFileHash(buf1)).not.toBe(computeFileHash(buf2));
  });
});

describe("findDuplicateBatch", () => {
  it("returns the prior batch when provider + hash match", async () => {
    const mockBatch: ExistingBatch = {
      id: "batch-1",
      provider: "momo",
      filename: "test.csv",
      status: "processed",
      row_count: 100,
      created_at: "2026-09-23T00:00:00Z",
    };
    const mockRest = async <T>(path: string): Promise<T> => {
      if (path.includes("file_hash=eq.abc123")) return [mockBatch] as T;
      return [] as T;
    };
    const result = await findDuplicateBatch("momo", "abc123", mockRest);
    expect(result).toEqual(mockBatch);
  });

  it("returns null when no match", async () => {
    const mockRest = async <T>(): Promise<T> => [] as T;
    const result = await findDuplicateBatch("momo", "notfound", mockRest);
    expect(result).toBeNull();
  });
});