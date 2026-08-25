/**
 * Hub platform seed parsing (HP-1, Decision 0018).
 *
 * The canonical Ghana hub/church list lives in scripts/data/ghana-hubs-churches.json
 * (31 hubs, cleaned from the office workbook). This module validates that file's shape
 * before anything touches the database, so a bad edit to the JSON fails loudly at seed
 * time instead of producing a half-seeded church list.
 *
 * `normalizeChurchKey` is the single definition of church-name identity: matching is
 * case- and whitespace-insensitive everywhere (seed uniqueness, wizard validation),
 * while the Title Case `name` is only for display.
 */

export type HubSeed = {
  hubNumber: number;
  leader: string;
  churches: string[];
};

export type ParsedHubSeed = {
  hubs: HubSeed[];
  churchCount: number;
};

/** Case/whitespace-insensitive identity for a church name. */
export function normalizeChurchKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Validate the seed document. Throws with every problem listed (not just the first)
 * so a bad hand-edit is fixable in one pass.
 */
export function parseHubSeed(doc: unknown): ParsedHubSeed {
  const errors: string[] = [];
  const root = doc as { hubs?: unknown };
  if (!root || !Array.isArray(root.hubs)) {
    throw new Error("hub seed: missing `hubs` array");
  }

  const hubs: HubSeed[] = [];
  const seenNumbers = new Set<number>();
  let churchCount = 0;

  for (const [i, h] of (root.hubs as unknown[]).entries()) {
    const hub = h as Partial<HubSeed>;
    const label = `hubs[${i}]`;
    if (
      typeof hub.hubNumber !== "number" ||
      !Number.isInteger(hub.hubNumber) ||
      hub.hubNumber <= 0
    ) {
      errors.push(`${label}: hubNumber must be a positive integer`);
      continue;
    }
    if (seenNumbers.has(hub.hubNumber)) {
      errors.push(`${label}: duplicate hubNumber ${hub.hubNumber}`);
      continue;
    }
    seenNumbers.add(hub.hubNumber);
    if (typeof hub.leader !== "string" || hub.leader.trim() === "") {
      errors.push(`hub ${hub.hubNumber}: leader must be a non-empty string`);
    }
    if (!Array.isArray(hub.churches) || hub.churches.length === 0) {
      errors.push(`hub ${hub.hubNumber}: churches must be a non-empty array`);
      continue;
    }
    const keys = new Set<string>();
    for (const c of hub.churches) {
      if (typeof c !== "string" || c.trim() === "") {
        errors.push(`hub ${hub.hubNumber}: empty church name`);
        continue;
      }
      const key = normalizeChurchKey(c);
      if (keys.has(key)) {
        errors.push(`hub ${hub.hubNumber}: duplicate church "${c}"`);
        continue;
      }
      keys.add(key);
    }
    churchCount += keys.size;
    hubs.push({
      hubNumber: hub.hubNumber,
      leader: (hub.leader as string) ?? "",
      churches: hub.churches as string[],
    });
  }

  // Hub numbers must be a contiguous 1..N run — the office identifies hubs by
  // number, so a gap means a hub is missing from the seed, not that one closed.
  const numbers = [...seenNumbers].sort((a, b) => a - b);
  for (let n = 1; n <= numbers.length; n++) {
    if (!seenNumbers.has(n)) {
      errors.push(`hub numbering has a gap: no hub ${n}`);
      break;
    }
  }

  if (errors.length > 0) {
    throw new Error(`hub seed invalid:\n- ${errors.join("\n- ")}`);
  }
  return { hubs, churchCount };
}
