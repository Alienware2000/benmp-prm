import { NextRequest, NextResponse } from "next/server";
import { signedStatementUrl } from "@/lib/poc/statement-vault";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SubmissionFile = {
  givers_file_name: string | null;
  givers_file_path: string | null;
};

/**
 * Download the giver sheet a branch uploaded with its cash form. Redirects to a 60-second
 * signed URL on the private statement-vault bucket — the bytes never pass through
 * this app. Staff-only via the POC session gate on /api/poc/*.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json(
      { ok: false, error: "Not configured." },
      { status: 500 },
    );
  }
  const { id } = await params;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cash_submissions?select=givers_file_name,givers_file_path&id=eq.${encodeURIComponent(id)}&limit=1`,
    {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "Query failed." },
      { status: 500 },
    );
  }
  const [submission] = (await res.json()) as SubmissionFile[];
  if (!submission) {
    return NextResponse.json(
      { ok: false, error: "Submission not found." },
      { status: 404 },
    );
  }
  if (!submission.givers_file_path) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This submission was typed in before uploads; there is no giver sheet.",
      },
      { status: 404 },
    );
  }

  try {
    const url = await signedStatementUrl(
      submission.givers_file_path,
      submission.givers_file_name ?? "givers",
    );
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Download failed.",
      },
      { status: 500 },
    );
  }
}
