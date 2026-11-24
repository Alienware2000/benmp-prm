import { describe, expect, it } from "vitest";
import { mapConcurrent, pageAll } from "./paging";

const table = (n: number) => Array.from({ length: n }, (_, i) => i);

function source(rows: number[]) {
  const calls: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchPage = async (offset: number, limit: number) => {
    calls.push(offset);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight -= 1;
    return rows.slice(offset, offset + limit);
  };
  return { fetchPage, calls, max: () => maxInFlight };
}

describe("pageAll", () => {
  it("returns a short first page with one request", async () => {
    const s = source(table(7));
    expect(await pageAll(s.fetchPage, { pageSize: 10 })).toEqual(table(7));
    expect(s.calls).toEqual([0]);
  });

  it("reads every row, in order, fetching later pages in parallel", async () => {
    const s = source(table(183));
    const rows = await pageAll(s.fetchPage, { pageSize: 10, concurrency: 4 });
    expect(rows).toEqual(table(183));
    expect(s.max()).toBe(4);
  });

  it("stops at an exact multiple of the page size", async () => {
    const s = source(table(30));
    expect(
      await pageAll(s.fetchPage, { pageSize: 10, concurrency: 2 }),
    ).toEqual(table(30));
  });

  it("respects a row cap", async () => {
    const s = source(table(1000));
    const rows = await pageAll(s.fetchPage, {
      pageSize: 10,
      concurrency: 3,
      maxRows: 50,
    });
    expect(rows).toEqual(table(50));
  });
});

describe("mapConcurrent", () => {
  it("keeps order and caps how many run at once", async () => {
    let inFlight = 0;
    let max = 0;
    const out = await mapConcurrent(
      [5, 1, 4, 2, 3, 0, 6],
      async (n) => {
        inFlight += 1;
        max = Math.max(max, inFlight);
        await new Promise((r) => setTimeout(r, n));
        inFlight -= 1;
        return n * 10;
      },
      3,
    );
    expect(out).toEqual([50, 10, 40, 20, 30, 0, 60]);
    expect(max).toBe(3);
  });
});
