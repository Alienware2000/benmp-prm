/**
 * Batching for the legacy Ghana broadcast (Decision 0019 item 7).
 *
 * The audience is ~11.3k sendable people and one synchronous send is capped at
 * MAX_IMMEDIATE_RECIPIENTS (2,000), so staff send it as a series of fixed batches
 * instead of one blast. This module decides what is in each batch.
 *
 * Pure on purpose — the rules that keep a batch from double-sending are the part worth
 * testing without a network round trip.
 *
 * Two invariants make repeated sends safe:
 *  1. **Stable boundaries.** Contacts are ordered by id before chunking, so "batch 3"
 *     is the same 2,000 people on every request. The UI can name a batch and mean it.
 *  2. **Already-sent contacts keep their batch.** Chunking runs over the whole eligible
 *     list, and `last_sent_at` marks a contact as done *within* its batch rather than
 *     removing it and resliding everyone else. If sent rows were filtered out first,
 *     every completed batch would shift the boundaries and staff could send batch 2
 *     twice under two different names.
 */

import type { DirectoryPartner } from "./directory";

/** One recipient, plus whether this list has already messaged them. */
export type LegacyContact = DirectoryPartner & { lastSentAt: string | null };

export const LEGACY_BATCH_SIZE = 2_000;

export type LegacyBatch = {
  /** 1-based, as staff see it. */
  number: number;
  /** Everyone in the batch, sent or not. */
  size: number;
  /** Still to send: messageable, not yet sent. */
  remaining: number;
  /** Already messaged in an earlier run. */
  alreadySent: number;
};

export type LegacyBatchPlan = {
  batches: LegacyBatch[];
  totalContacts: number;
  /** Contacts with a phone normalizePhone accepts. */
  sendable: number;
  /** Dropped before batching — the archive carries Excel debris in the phone column. */
  unusablePhone: number;
  batchSize: number;
};

/**
 * Order the contacts that can actually be messaged. Everything else in this module
 * works off this list, so ordering lives in one place.
 */
function eligible(contacts: LegacyContact[]): LegacyContact[] {
  return contacts
    .filter((c) => c.messageable)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Split into fixed-size chunks. Boundaries never depend on send progress. */
function chunk(contacts: LegacyContact[], size: number): LegacyContact[][] {
  const chunks: LegacyContact[][] = [];
  for (let i = 0; i < contacts.length; i += size) {
    chunks.push(contacts.slice(i, i + size));
  }
  return chunks;
}

/** The batch table the composer shows before staff pick one. */
export function planLegacyBatches(
  contacts: LegacyContact[],
  batchSize: number = LEGACY_BATCH_SIZE,
): LegacyBatchPlan {
  const usable = eligible(contacts);
  const batches = chunk(usable, batchSize).map((rows, i) => {
    const alreadySent = rows.filter((r) => r.lastSentAt !== null).length;
    return {
      number: i + 1,
      size: rows.length,
      remaining: rows.length - alreadySent,
      alreadySent,
    };
  });
  return {
    batches,
    totalContacts: contacts.length,
    sendable: usable.length,
    unusablePhone: contacts.length - usable.length,
    batchSize,
  };
}

/**
 * The people a given batch would message right now: batch members who have not been
 * sent to yet. Anyone already messaged is dropped here rather than at chunk time, so
 * re-selecting a finished batch previews as empty instead of silently becoming someone
 * else's batch.
 *
 * Returns [] for a batch number outside the plan.
 */
export function legacyBatchRecipients(
  contacts: LegacyContact[],
  batchNumber: number,
  batchSize: number = LEGACY_BATCH_SIZE,
): LegacyContact[] {
  const chunks = chunk(eligible(contacts), batchSize);
  const rows = chunks[batchNumber - 1];
  if (!rows) return [];
  return rows.filter((r) => r.lastSentAt === null);
}

/** Whether a number names a real batch in this plan. */
export function isValidBatchNumber(
  value: unknown,
  plan: Pick<LegacyBatchPlan, "batches">,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= plan.batches.length
  );
}
