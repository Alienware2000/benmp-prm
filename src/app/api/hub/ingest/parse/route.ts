import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { INGEST_LIMITS, parseCsv } from "@/lib/hub/ingest";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * Step 1 of the wizard (HP-3): turn an uploaded .xlsx/.csv into plain string
 * grids, one per sheet, so the client can offer sheet + column picking. No
 * database writes happen here; nothing about the file is trusted beyond being
 * parseable, and everything else is validated at preview/submit time.
 */
export async function POST(req: NextRequest) {
  const session = await verifyHubSessionToken(
    req.cookies.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file was uploaded." },
      { status: 400 },
    );
  }
  if (file.size > INGEST_LIMITS.maxFileBytes) {
    return NextResponse.json(
      { ok: false, error: "That file is too large. Keep uploads under 8 MB." },
      { status: 400 },
    );
  }

  const name = file.name || "upload";
  const lower = name.toLowerCase();
  try {
    let sheets: { name: string; rows: string[][] }[];
    if (lower.endsWith(".csv")) {
      const rows = clampGrid(parseCsv(await file.text()));
      sheets = [{ name: "CSV", rows }];
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
      sheets = await parseWorkbook(Buffer.from(await file.arrayBuffer()));
    } else {
      return NextResponse.json(
        { ok: false, error: "Upload an Excel file (.xlsx) or a CSV file." },
        { status: 400 },
      );
    }
    const nonEmpty = sheets.filter((s) => s.rows.length > 0);
    if (nonEmpty.length === 0) {
      return NextResponse.json(
        { ok: false, error: "That file has no rows in it." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, fileName: name, sheets: nonEmpty });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not read that file. Re-save it as .xlsx or .csv and try again." },
      { status: 400 },
    );
  }
}

function clampGrid(rows: string[][]): string[][] {
  return rows
    .slice(0, INGEST_LIMITS.maxRowsPerSheet)
    .map((r) => r.slice(0, INGEST_LIMITS.maxColumns));
}

async function parseWorkbook(
  buffer: Buffer,
): Promise<{ name: string; rows: string[][] }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: { name: string; rows: string[][] }[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= INGEST_LIMITS.maxRowsPerSheet) return;
      const values: string[] = [];
      // row.values is 1-indexed; normalize to a dense 0-based array.
      const raw = row.values as ExcelJS.CellValue[];
      for (let c = 1; c < Math.min(raw.length, INGEST_LIMITS.maxColumns + 1); c++) {
        values.push(cellText(raw[c]));
      }
      if (values.some((v) => v.trim() !== "")) rows.push(values);
    });
    sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

/**
 * Excel cells arrive as strings, numbers, dates, rich text, formula results,
 * or hyperlinks. Everything becomes the text a person would see — numbers
 * without float artifacts (an integer phone stays "244123456", never
 * "2.44123456e8").
 */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toFixed(0) : String(v);
  }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("");
    }
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
  }
  return "";
}
