// src/lib/poc/statement-vault.ts
// Supabase Storage calls for the private statement vault. Server-only: uses the
// service-role key, which bypasses storage RLS (the bucket has no public policies).
import { STATEMENT_VAULT_BUCKET } from "./statement-file";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is not configured.");
  return { url: url.replace(/\/$/, ""), key };
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/**
 * Store the original statement file. Upserts, so retrying a failed import with the
 * same file overwrites the identical object instead of erroring.
 */
export async function saveStatementFile(
  objectPath: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { url, key } = env();
  const response = await fetch(
    `${url}/storage/v1/object/${STATEMENT_VAULT_BUCKET}/${encodePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Statement vault upload failed: ${response.status} ${await response.text()}`);
  }
}

/** Short-lived signed URL that downloads the original file under its uploaded name. */
export async function signedStatementUrl(
  objectPath: string,
  downloadName: string,
  expiresInSeconds = 60,
): Promise<string> {
  const { url, key } = env();
  const response = await fetch(
    `${url}/storage/v1/object/sign/${STATEMENT_VAULT_BUCKET}/${encodePath(objectPath)}`,
    {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Statement vault sign failed: ${response.status} ${await response.text()}`);
  }
  const { signedURL } = (await response.json()) as { signedURL: string };
  return `${url}/storage/v1${signedURL}&download=${encodeURIComponent(downloadName)}`;
}
