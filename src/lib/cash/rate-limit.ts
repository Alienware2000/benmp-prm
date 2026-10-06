// src/lib/cash/rate-limit.ts

/**
 * Minimal in-memory per-IP rate limiter. Accepts a Map (so tests can pass a
 * fresh one) and returns true if the IP is under the limit, false if over.
 *
 * Entries are arrays of timestamps; old timestamps are pruned on each call.
 * Not shared across server instances — acceptable for a monthly form. Swap to
 * Upstash Redis if abuse appears; the interface stays the same.
 */
export type RateLimitMap = Map<string, number[]>;

export function checkRateLimit(
  map: RateLimitMap,
  ip: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (map.get(ip) ?? []).filter((ts) => ts > cutoff);

  if (timestamps.length >= maxRequests) {
    map.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  map.set(ip, timestamps);
  return true;
}