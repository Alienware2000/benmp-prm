import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  buildPaymentRows,
  countryForPaymentSource,
  isPaymentSource,
  parseJsonArray,
  parseJsonObject,
  type NormalizedPaymentRow,
  type PartnerForPaymentMatch,
} from "@/lib/poc/payment-upload";
import {
  createPartner,
  importPreparedStatement,
  insertPayments,
  loadPartners,
  paymentReference,
  prepareStatement,
  serializeRow,
  updateImportRowStatus,
} from "@/lib/poc/statement-import";

export const dynamic = "force-dynamic";

type CommitDecision =
  | { action: "match"; partnerId: string }
  | { action: "create"; name: string }
  | { action: "dismiss" };

function isNormalizedPaymentRow(value: unknown): value is NormalizedPaymentRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    "sourceRowId" in value &&
    "transactionDate" in value &&
    "amountMinor" in value &&
    "currency" in value &&
    "providerReference" in value &&
    "rawRow" in value
  );
}

function partnerOptions(partners: PartnerForPaymentMatch[]) {
  return partners.map((partner) => ({
    id: partner.id,
    name: partner.fullName,
    phone: partner.momoPhoneNumber ?? partner.whatsappNumber,
    church: partner.church,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const action = String(form.get("action") ?? "preview");
    if (action === "commitDeferred") {
      const rowsJson = String(form.get("rows") ?? "[]");
      const decisions = parseJsonObject(String(form.get("decisions") ?? "")) as Record<string, CommitDecision>;
      const rows = parseJsonArray(rowsJson).filter(isNormalizedPaymentRow);
      const partners = await loadPartners();
      const partnersById = new Map(partners.map((partner) => [partner.id, partner]));
      const accepted: Array<{ row: NormalizedPaymentRow; partner: PartnerForPaymentMatch | null }> = [];
      let dismissed = 0;
      let created = 0;
      let manualMatched = 0;
      let deferred = 0;

      for (const row of rows) {
        const decision = decisions[row.sourceRowId];
        if (!decision) {
          deferred += 1;
          continue;
        }
        if (decision.action === "dismiss") {
          dismissed += 1;
          continue;
        }
        if (decision.action === "match") {
          const partner = partnersById.get(decision.partnerId);
          if (!partner) throw new Error("Selected partner was not found.");
          accepted.push({ row, partner });
          manualMatched += 1;
        } else if (decision.action === "create") {
          const partner = await createPartner(
            decision.name || row.payerName || "New Partner",
            row.payerPhoneOrAccount,
            countryForPaymentSource(row.source),
          );
          accepted.push({ row, partner });
          created += 1;
        }
      }

      await insertPayments(buildPaymentRows(accepted));
      await updateImportRowStatus(
        accepted.map(({ row }) => paymentReference(row)),
        "promoted",
      );
      await updateImportRowStatus(
        rows
          .filter((row) => decisions[row.sourceRowId]?.action === "dismiss")
          .map(paymentReference),
        "dismissed",
      );
      revalidateTag("poc-giving", "max");
      return NextResponse.json({
        ok: true,
        counts: {
          insertedOrAlreadyPresent: accepted.length,
          autoMatched: 0,
          manualMatched,
          created,
          dismissed,
          deferred,
          rejected: 0,
          skipped: 0,
        },
      });
    }

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
    const { parsed, partners, matches, fileHash } = prepared;
    const warnings = parsed.warnings ?? [];

    if (action === "import") {
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
        warnings,
        counts: {
          insertedOrAlreadyPresent: outcome.autoMatched,
          autoMatched: outcome.autoMatched,
          manualMatched: 0,
          created: 0,
          dismissed: 0,
          deferred: outcome.review.length,
          rejected: parsed.rejects.length,
          skipped: parsed.skipped.length,
        },
        rows: outcome.review.map((match) => ({
          row: serializeRow(match.row),
          status: match.status,
          reason: match.reason,
          partner: match.partner,
          candidates: match.candidates,
        })),
        partnerOptions: partnerOptions(partners),
      });
    }

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        fileHash,
        warnings,
        counts: {
          rows: parsed.rows.length,
          auto: matches.filter((m) => m.status === "auto").length,
          review: matches.filter((m) => m.status === "review").length,
          rejected: parsed.rejects.length,
          skipped: parsed.skipped.length,
        },
        rows: matches.map((match) => ({
          row: serializeRow(match.row),
          status: match.status,
          reason: match.reason,
          partner: match.partner,
          candidates: match.candidates,
        })),
        partnerOptions: partnerOptions(partners),
        rejects: parsed.rejects.map((reject) => ({ index: reject.index, reason: reject.reason })),
        skipped: parsed.skipped.length,
      });
    }

    if (action !== "commit") {
      return NextResponse.json({ ok: false, error: "Unknown upload action." }, { status: 400 });
    }

    const decisions = parseJsonObject(String(form.get("decisions") ?? "")) as Record<string, CommitDecision>;
    const partnersById = new Map(partners.map((partner) => [partner.id, partner]));
    const accepted: Array<{ row: NormalizedPaymentRow; partner: PartnerForPaymentMatch | null }> = [];
    let dismissed = 0;
    let deferred = 0;
    let created = 0;
    let manualMatched = 0;
    let autoMatched = 0;

    for (const match of matches) {
      if (match.status === "auto") {
        accepted.push({ row: match.row, partner: match.partner });
        autoMatched += 1;
        continue;
      }
      const decision = decisions[match.row.sourceRowId];
      if (!decision) {
        deferred += 1;
        continue;
      }
      if (decision.action === "dismiss") {
        dismissed += 1;
        continue;
      }
      if (decision.action === "match") {
        const partner = partnersById.get(decision.partnerId);
        if (!partner) throw new Error("Selected partner was not found.");
        accepted.push({ row: match.row, partner });
        manualMatched += 1;
      } else if (decision.action === "create") {
        const partner = await createPartner(
          decision.name || match.row.payerName || "New Partner",
          match.row.payerPhoneOrAccount,
          countryForPaymentSource(match.row.source),
        );
        accepted.push({ row: match.row, partner });
        created += 1;
      }
    }

    await insertPayments(buildPaymentRows(accepted));
    revalidateTag("poc-giving", "max");

    return NextResponse.json({
      ok: true,
      counts: {
        insertedOrAlreadyPresent: accepted.length,
        autoMatched,
        manualMatched,
        created,
        dismissed,
        deferred,
        rejected: parsed.rejects.length,
        skipped: parsed.skipped.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
