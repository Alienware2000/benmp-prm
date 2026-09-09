import { NextResponse } from "next/server";
import { listRegionsForLogin } from "@/lib/hub/db";

export const dynamic = "force-dynamic";

/**
 * The login picker's data: regions, and the hubs inside each (Decision 0020).
 *
 * Unauthenticated by necessity — an admin picks their hub before they can prove
 * who they are — and safe to be: it is the office's own structure, with no
 * counts, no account state and no partner data. See `listRegionsForLogin`.
 */
export async function GET() {
  try {
    const regions = await listRegionsForLogin();
    return NextResponse.json({ ok: true, regions });
  } catch (err) {
    console.error("[regions] failed to load login picker data", err);
    return NextResponse.json(
      { ok: false, error: "Could not load the region list." },
      { status: 500 },
    );
  }
}
