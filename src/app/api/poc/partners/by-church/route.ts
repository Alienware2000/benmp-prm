// src/app/api/poc/partners/by-church/route.ts
import { NextResponse } from "next/server";
import {
  aggregatePartnersByChurch,
  type PartnerForCount,
  type ChurchMeta,
  type HubMeta,
  type RegionMeta,
} from "@/lib/poc/partners-by-church";

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
    const rows = (await res.json()) as T[];
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

export async function GET() {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }

  try {
    const [partners, churches, hubs, regions] = await Promise.all([
      fetchAll<PartnerForCount>(
        "partners?select=id,hub_id,church_id,country,status"
      ),
      fetchAll<ChurchMeta>("hub_churches?select=id,name,hub_id"),
      fetchAll<HubMeta>("hubs?select=id,name,hub_number,region_id"),
      fetchAll<RegionMeta>("regions?select=id,code,name"),
    ]);

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[partners/by-church] failed", err);
    return NextResponse.json({ ok: false, error: "Aggregation failed." }, { status: 500 });
  }
}