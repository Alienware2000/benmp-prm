import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isPaymentSource } from "@/lib/poc/payment-upload";
import {
  importPreparedStatement,
  prepareStatement,
} from "@/lib/poc/statement-import";

export const dynamic = "force-dynamic";

/**
 * Staff. Multipart `source` + `file`: parse a MoMo, bank or Paystack statement
 * and record every credit line in the ledger (Decision 0046). There is no
 * review step: a line is the payer's name and number, linked to a partner when
 * the phone or a unique name matches one.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const source = String(form.get("source") ?? "");
    const file = form.get("file");
    if (!isPaymentSource(source)) {
      return NextResponse.json({ ok: false, error: "Choose a statement type." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Upload a statement file." }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const filename = file.name || `${source}-upload`;
    const prepared = await prepareStatement(source, filename, fileBuffer);
    const { parsed } = prepared;
    const outcome = await importPreparedStatement(prepared, fileBuffer, file.type);
    if (!outcome.ok) {
      const existing = outcome.duplicate;
      return NextResponse.json(
        {
          ok: false,
          error: "duplicate_file",
          existingBatch: {
            id: existing.id,
            filename: existing.filename,
            created_at: existing.created_at,
            row_count: existing.row_count,
          },
        },
        { status: 409 },
      );
    }
    revalidateTag("poc-giving", "max");
    return NextResponse.json({
      ok: true,
      warnings: parsed.warnings ?? [],
      counts: {
        recorded: outcome.recorded,
        linked: outcome.linked,
        totalMinor: parsed.rows.reduce((sum, row) => sum + row.amountMinor, 0),
        rejected: parsed.rejects.length,
        skipped: parsed.skipped.length,
      },
      importId: outcome.importId,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
