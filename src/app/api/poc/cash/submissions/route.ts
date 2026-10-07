// src/app/api/poc/cash/submissions/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SubmissionListRow = {
  id: string;
  reporting_month: string;
  status: string;
  total_cash_minor: number;
  total_registered: number;
  active_partners: number;
  new_registrations: number;
  lapsed: number;
  submitted_at: string;
  hub_churches: { name: string } | null;
  hubs: { name: string } | null;
  regions: { name: string } | null;
};

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const statusFilter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cash_submissions?select=id,reporting_month,status,total_cash_minor,total_registered,active_partners,new_registrations,lapsed,submitted_at,hub_churches(name),hubs(name),regions(name)&order=submitted_at.desc&limit=500${statusFilter}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }
  const rows = (await res.json()) as SubmissionListRow[];
  return NextResponse.json({ ok: true, submissions: rows });
}