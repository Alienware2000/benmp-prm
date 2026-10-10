// src/lib/poc/in-list.ts
// PostgREST `col=in.(a,b,c)` filters travel in the URL. Ecobank payment references
// embed the full narration (~130 chars, more once encoded), so a fixed count of
// values per request overflowed the request line (UND_ERR_HEADERS_OVERFLOW at
// ~17 KB for 100 refs). Chunk by encoded length instead.
//
// Narrations also contain commas and parentheses, which PostgREST reads as list
// syntax — unquoted, such a reference silently never matched. Every value is
// therefore double-quoted (with `\` and `"` escaped) before encoding.

/** PostgREST in-list literal: `"value"` with backslashes and quotes escaped. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Max encoded characters of in-list values per request — well under the ~16 KB header limit. */
export const MAX_IN_LIST_CHARS = 4000;

/**
 * Split values into quoted, URL-encoded, comma-joined chunks ready for `in.(${chunk})`,
 * each at most MAX_IN_LIST_CHARS (a single longer value gets its own chunk) and at
 * most `maxValues` values.
 */
export function inListChunks(values: string[], { maxValues = 500 }: { maxValues?: number } = {}): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const value of values) {
    const encoded = encodeURIComponent(quote(value));
    const added = (current.length > 0 ? 1 : 0) + encoded.length;
    if (current.length > 0 && (length + added > MAX_IN_LIST_CHARS || current.length >= maxValues)) {
      chunks.push(current.join(","));
      current = [];
      length = 0;
    }
    length += (current.length > 0 ? 1 : 0) + encoded.length;
    current.push(encoded);
  }
  if (current.length > 0) chunks.push(current.join(","));
  return chunks;
}
