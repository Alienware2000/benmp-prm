import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const reportingMonth = `${month}-01`;

  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // Fetch all hub_churches with their hub names
  const [churchesRes, submissionsRes, hubsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/hub_churches?select=id,name,hub_id&limit=5000`, { headers, cache: "no-store" }),
    fetch(`${SUPABASE_URL}/rest/v1/cash_submissions?select=id,church_id,status,total_cash_minor,deposits_total_minor,givers_file_path,total_registered,active_partners,new_registrations,lapsed,submitted_at,cash_submission_deposits(transaction_id,channel,amount_minor,deposited_on,row_index)&reporting_month=eq.${encodeURIComponent(reportingMonth)}&limit=5000`, { headers, cache: "no-store" }),
    fetch(`${SUPABASE_URL}/rest/v1/hubs?select=id,name,hub_number&limit=500`, { headers, cache: "no-store" }),
  ]);

  if (!churchesRes.ok || !submissionsRes.ok || !hubsRes.ok) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }

  const churches = await churchesRes.json() as { id: string; name: string; hub_id: string }[];
  const submissions = await submissionsRes.json() as { id: string; church_id: string; status: string; total_cash_minor: number; deposits_total_minor: number; givers_file_path: string | null; cash_submission_deposits: { transaction_id: string; channel: string; amount_minor: number; deposited_on: string; row_index: number }[]; total_registered: number; active_partners: number; new_registrations: number; lapsed: number; submitted_at: string }[];
  const hubs = await hubsRes.json() as { id: string; name: string; hub_number: number | null }[];

  const hubById = new Map(hubs.map(h => [h.id, h]));
  const subByChurchId = new Map(submissions.map(s => [s.church_id, s]));

  const filed = churches
    .filter(c => subByChurchId.has(c.id))
    .map(c => {
      const s = subByChurchId.get(c.id)!;
      const hub = hubById.get(c.hub_id);
      return {
        submissionId: s.id,
        churchId: c.id,
        churchName: c.name,
        hubLabel: hub ? (hub.hub_number ? `Hub ${hub.hub_number} - ${hub.name}` : hub.name) : c.hub_id,
        status: s.status,
        totalCashMinor: s.total_cash_minor,
        depositsTotalMinor: s.deposits_total_minor,
        hasGiverFile: !!s.givers_file_path,
        deposits: [...(s.cash_submission_deposits ?? [])]
          .sort((a, b) => a.row_index - b.row_index)
          .map((d) => ({ transactionId: d.transaction_id, channel: d.channel, amountMinor: d.amount_minor, depositedOn: d.deposited_on })),
        totalRegistered: s.total_registered,
        activePartners: s.active_partners,
        newRegistrations: s.new_registrations,
        lapsed: s.lapsed,
        submittedAt: s.submitted_at,
      };
    });

  const notFiled = churches
    .filter(c => !subByChurchId.has(c.id))
    .map(c => {
      const hub = hubById.get(c.hub_id);
      return {
        churchId: c.id,
        churchName: c.name,
        hubLabel: hub ? (hub.hub_number ? `Hub ${hub.hub_number} - ${hub.name}` : hub.name) : c.hub_id,
      };
    });

  return NextResponse.json({
    ok: true,
    month,
    filed,
    notFiled,
    summary: {
      totalChurches: churches.length,
      filedCount: filed.length,
      notFiledCount: notFiled.length,
    },
  });
}