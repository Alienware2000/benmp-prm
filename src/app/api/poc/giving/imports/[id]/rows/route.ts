import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ImportRow = {
  id: string;
  payment_reference: string | null;
  match_status: string;
  normalized_row: {
    payerName?: string | null;
    amountMinor?: number;
    transactionDate?: string;
  } | null;
  created_at: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const { id } = await params;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_import_rows?select=id,payment_reference,match_status,normalized_row,created_at&import_id=eq.${encodeURIComponent(id)}&order=created_at.asc&limit=5000`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }
  const rows = (await res.json()) as ImportRow[];
  return NextResponse.json({ ok: true, rows });
}