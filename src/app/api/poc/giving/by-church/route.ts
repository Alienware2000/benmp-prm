// src/app/api/poc/giving/by-church/route.ts
import { NextRequest, NextResponse } from "next/server";
import { aggregateMoneyByChurch } from "@/lib/poc/money-by-church";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers() {
  return { apikey: KEY!, Authorization: `Bearer ${KEY!}` };
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) break;
    const rows = await res.json() as T[];
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const month = req.nextUrl.searchParams.get("month") ?? undefined;

  try {
    const [payments, partners, churches, hubs, regions] = await Promise.all([
      fetchAll<{ amount_minor: number; payment_method: string | null; raw_row: Record<string, unknown> | null; paid_at: string }>(
        "payments?select=amount_minor,payment_method,raw_row,paid_at&status=eq.Successful&order=paid_at.desc"
      ),
      fetchAll<{ id: string; hub_id: string | null; church_id: string | null; country: string | null }>(
        "partners?select=id,hub_id,church_id,country"
      ),
      fetchAll<{ id: string; name: string; hub_id: string }>(
        "hub_churches?select=id,name,hub_id"
      ),
      fetchAll<{ id: string; name: string; hub_number: number | null; region_id: string }>(
        "hubs?select=id,name,hub_number,region_id"
      ),
      fetchAll<{ id: string; code: string; name: string }>(
        "regions?select=id,code,name"
      ),
    ]);

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[by-church] failed", err);
    return NextResponse.json({ ok: false, error: "Aggregation failed." }, { status: 500 });
  }
}