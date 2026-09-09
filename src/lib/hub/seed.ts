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

/**
 * Case/whitespace-insensitive identity for a church name. Also strips
 * invisible characters (zero-width spaces/joiners, BOM) — the office workbook
 * really contained a word-joiner in front of several names, which would make
 * "Akrokerri" silently fail to match "⁠Akrokerri".
 */
export function normalizeChurchKey(raw: string): string {
  return raw
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
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

/* ------------------------------------------------------------------ *
 * Named-hub regions (Decision 0020)
 * ------------------------------------------------------------------ */

export type NamedHubSeed = {
  /** Region-scoped identity, e.g. "Kpandai". */
  name: string;
  /** How the office writes it out, where that differs ("JITM" -> "Jesus is the Master"). */
  displayName: string;
  leader: string;
  churches: string[];
};

export type ParsedNamedHubSeed = {
  hubs: NamedHubSeed[];
  churchCount: number;
};

/**
 * Hub-name identity within a region. Same rules as `normalizeChurchKey` — the
 * office types "Tamale North", "TAMALE NORTH" and "Tamale  North" for one hub.
 */
export function normalizeHubKey(raw: string): string {
  return normalizeChurchKey(raw);
}

/**
 * Validate a named-hub seed document (UJ Ghana and any later name region).
 *
 * Deliberately NOT `parseHubSeed` with an optional number: that function
 * enforces a contiguous 1..N run, which is meaningful for UD Ghana (a gap means
 * a missing hub) and meaningless here. Every other rule is shared — non-empty
 * leader, non-empty church list, no duplicate church within a hub — plus one
 * more: hub names are unique within the region.
 *
 * A blank leader is allowed and reported by the loader, not rejected: Wa's
 * branches arrived from the office without an admin name, and refusing the
 * whole region over one missing display label would be the wrong trade.
 */
export function parseNamedHubSeed(doc: unknown): ParsedNamedHubSeed {
  const errors: string[] = [];
  const root = doc as { hubs?: unknown };
  if (!root || !Array.isArray(root.hubs)) {
    throw new Error("hub seed: missing `hubs` array");
  }

  const hubs: NamedHubSeed[] = [];
  const seenHubKeys = new Set<string>();
  let churchCount = 0;

  for (const [i, h] of (root.hubs as unknown[]).entries()) {
    const hub = h as Partial<NamedHubSeed>;
    const label = `hubs[${i}]`;
    if (typeof hub.name !== "string" || hub.name.trim() === "") {
      errors.push(`${label}: name must be a non-empty string`);
      continue;
    }
    const hubKey = normalizeHubKey(hub.name);
    if (seenHubKeys.has(hubKey)) {
      errors.push(`${label}: duplicate hub name "${hub.name}"`);
      continue;
    }
    seenHubKeys.add(hubKey);
    if (hub.leader !== undefined && typeof hub.leader !== "string") {
      errors.push(`hub ${hub.name}: leader must be a string`);
    }
    if (!Array.isArray(hub.churches) || hub.churches.length === 0) {
      errors.push(`hub ${hub.name}: churches must be a non-empty array`);
      continue;
    }
    const keys = new Set<string>();
    for (const c of hub.churches) {
      if (typeof c !== "string" || c.trim() === "") {
        errors.push(`hub ${hub.name}: empty church name`);
        continue;
      }
      const key = normalizeChurchKey(c);
      if (keys.has(key)) {
        errors.push(`hub ${hub.name}: duplicate church "${c}"`);
        continue;
      }
      keys.add(key);
    }
    churchCount += keys.size;
    hubs.push({
      name: hub.name.trim(),
      displayName: (hub.displayName ?? hub.name).trim(),
      leader: (hub.leader ?? "").trim(),
      churches: hub.churches as string[],
    });
  }

  if (errors.length > 0) {
    throw new Error(`hub seed invalid:\n- ${errors.join("\n- ")}`);
  }
  return { hubs, churchCount };
}
