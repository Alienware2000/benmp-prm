import { NextRequest, NextResponse } from "next/server";
import {
  buildGiverContacts,
  giverContactsCsv,
  giverContactsFilename,
} from "@/lib/poc/giver-contacts";
import {
  auditGiverExport,
  getGiverContactInput,
} from "@/lib/poc/giver-contacts-db";

export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Staff. GET ?month=YYYY-MM — everyone who gave by statement (MoMo, bank,
 * Paystack) that month as a contact CSV for a broadcast (Decisions 0041, 0044).
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !MONTH.test(month)) {
    return NextResponse.json(
      { ok: false, error: "Choose a month (YYYY-MM)." },
      { status: 400 },
    );
  }
  const contacts = buildGiverContacts(await getGiverContactInput(month), month);
  await auditGiverExport({ month, contacts: contacts.length });
  console.info(
    JSON.stringify({
      event: "giver_contacts_export",
      by: "office",
      month,
      contacts: contacts.length,
    }),
  );
  return new Response(giverContactsCsv(contacts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${giverContactsFilename(month)}"`,
      "Cache-Control": "no-store",
    },
  });
}
