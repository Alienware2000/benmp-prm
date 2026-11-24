// src/lib/poc/paging.ts
// Read every row of a PostgREST query, which caps each response at 1,000 rows.
// Pages are fetched `concurrency` at a time instead of one after another: each
// round trip to Supabase costs ~0.35 s, so the 19 pages of `partners` took ~15 s
// in sequence (the 2026-11-24 slowdown) and take a few seconds this way.
// The query must have a stable `order` (end it on a unique column) so offsets
// don't shift between pages.

export const PAGE_SIZE = 1000;
const CONCURRENCY = 6;

export async function pageAll<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  { pageSize = PAGE_SIZE, concurrency = CONCURRENCY, maxRows = Infinity } = {},
): Promise<T[]> {
  const first = await fetchPage(0, pageSize);
  if (first.length < pageSize) return first;
  const all = [...first];
  for (let next = pageSize; next < maxRows; next += pageSize * concurrency) {
    const offsets = Array.from(
      { length: concurrency },
      (_, i) => next + i * pageSize,
    ).filter((o) => o < maxRows);
    const pages = await Promise.all(offsets.map((o) => fetchPage(o, pageSize)));
    for (const page of pages) {
      all.push(...page);
      if (page.length < pageSize) return all;
    }
  }
  return all;
}

/** `fn` over `items`, at most `concurrency` at a time; results keep `items`' order. */
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = CONCURRENCY,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return out;
}
