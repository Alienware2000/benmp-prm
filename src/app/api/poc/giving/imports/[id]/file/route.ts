import { NextRequest, NextResponse } from "next/server";
import { signedStatementUrl } from "@/lib/poc/statement-vault";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ImportFile = { filename: string; storage_path: string | null };

/**
 * Download the original statement behind an import batch. Redirects to a 60-second
 * signed URL on the private statement-vault bucket — the bytes never pass through
 * this app. Staff-only via the POC session gate on /api/poc/*.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const { id } = await params;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_imports?select=filename,storage_path&id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }
  const [batch] = (await res.json()) as ImportFile[];
  if (!batch) {
    return NextResponse.json({ ok: false, error: "Import not found." }, { status: 404 });
  }
  if (!batch.storage_path) {
    return NextResponse.json(
      { ok: false, error: "This import predates the statement vault; no original file was kept." },
      { status: 404 },
    );
  }

  try {
    const url = await signedStatementUrl(batch.storage_path, batch.filename);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Download failed." },
      { status: 500 },
    );
  }
}
