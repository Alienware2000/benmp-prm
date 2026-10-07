// src/app/api/poc/giving/executive-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildExecutiveSummary } from "@/lib/poc/executive-summary";

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
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(`fetchAll failed: ${path} -> ${res.status} ${res.statusText}`);
    }
    const rows = (await res.json()) as T[];
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
    const [payments, partners] = await Promise.all([
      fetchAll<{
        amount_minor: number;
        payment_method: string | null;
        raw_row: Record<string, unknown> | null;
        paid_at: string;
        payer_phone_e164: string | null;
      }>(
        "payments?select=amount_minor,payment_method,raw_row,paid_at,payer_phone_e164&status=eq.Successful&order=paid_at.desc",
      ),
      fetchAll<{
        id: string;
        country: string | null;
        momo_phone_number: string | null;
        whatsapp_number: string | null;
      }>("partners?select=id,country,momo_phone_number,whatsapp_number"),
    ]);

    const result = buildExecutiveSummary(payments, partners, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[executive-summary] failed", err);
    return NextResponse.json(
      { ok: false, error: "Aggregation failed." },
      { status: 500 },
    );
  }
}