// src/lib/poc/import-dedup.ts
import { createHash } from "crypto";

/** Compute SHA-256 hex of file content. */
export function computeFileHash(buffer: ArrayBuffer): string {
  return createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
}

export type ExistingBatch = {
  id: string;
  provider: string;
  filename: string;
  status: string;
  row_count: number;
  created_at: string;
};

/** Check if a file hash already exists for this provider. Returns the prior batch if so. */
export async function findDuplicateBatch(
  provider: string,
  fileHash: string,
  rest: <T>(path: string, init?: RequestInit) => Promise<T>,
): Promise<ExistingBatch | null> {
  const rows = await rest<ExistingBatch[]>(
    `payment_imports?select=id,provider,filename,status,row_count,created_at` +
      `&provider=eq.${encodeURIComponent(provider)}` +
      `&file_hash=eq.${encodeURIComponent(fileHash)}&limit=1`,
  );
  return rows[0] ?? null;
}