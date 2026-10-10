// src/app/api/poc/giving/imports/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ImportBatch = {
  id: string;
  provider: string;
  filename: string;
  status: string;
  row_count: number;
  matched_count: number;
  ambiguous_count: number;
  file_hash: string | null;
  storage_path: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const provider = req.nextUrl.searchParams.get("provider") ?? "";
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const filters: string[] = [];
  if (provider) filters.push(`provider=eq.${encodeURIComponent(provider)}`);
  if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
  const filterStr = filters.length > 0 ? `&${filters.join("&")}` : "";

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_imports?select=id,provider,filename,status,row_count,matched_count,ambiguous_count,file_hash,storage_path,created_at&order=created_at.desc&limit=500${filterStr}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }
  const batches = (await res.json()) as ImportBatch[];
  return NextResponse.json({ ok: true, batches });
}