// src/lib/hub/giver-export.ts
// The giver-contacts CSV download shared by the hub and office routes
// (Decision 0041). Callers decide which hub the requester may export.
import { NextResponse } from "next/server";
import { auditGiverExport, getGiverContactInput } from "./db";
import {
  buildGiverContacts,
  giverContactsCsv,
  giverContactsFilename,
} from "./giver-contacts";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function giverContactsResponse(opts: {
  by: "hub" | "office";
  hubId: string;
  hubLabel: string;
  churchId: string | null;
  month: string | null;
}): Promise<Response> {
  if (!opts.month || !MONTH.test(opts.month)) {
    return NextResponse.json(
      { ok: false, error: "Choose a month (YYYY-MM)." },
      { status: 400 },
    );
  }
  const input = await getGiverContactInput(
    opts.hubId,
    opts.month,
    opts.churchId ?? undefined,
  );
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "Church not found." },
      { status: 404 },
    );
  }
  const contacts = buildGiverContacts(input, opts.month);
  await auditGiverExport({
    by: opts.by,
    hubId: opts.hubId,
    churchId: opts.churchId,
    month: opts.month,
    contacts: contacts.length,
  });
  console.info(
    JSON.stringify({
      event: "giver_contacts_export",
      by: opts.by,
      hubId: opts.hubId,
      churchId: opts.churchId,
      month: opts.month,
      contacts: contacts.length,
    }),
  );
  const filename = giverContactsFilename(
    [opts.hubLabel, input.churchName ?? ""],
    opts.month,
  );
  return new Response(giverContactsCsv(contacts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
