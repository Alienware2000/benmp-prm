// src/app/api/cash/[id]/promote/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  buildCashPaymentRows,
  getSubmissionForPromote,
  insertCashPayments,
  markSubmissionPromoted,
} from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const data = await getSubmissionForPromote(id);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Submission not found." }, { status: 404 });
  }
  if (data.submission.status === "promoted") {
    return NextResponse.json({ ok: false, error: "Already promoted." }, { status: 409 });
  }

  const paymentRows = buildCashPaymentRows(data.submission, data.givers);
  try {
    await insertCashPayments(paymentRows);
    await markSubmissionPromoted(id);
  } catch (err) {
    console.error("[cash/promote] failed", err);
    return NextResponse.json(
      { ok: false, error: "Promotion failed. Payment rows may be incomplete." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    promoted: paymentRows.length,
    submissionId: id,
  });
}