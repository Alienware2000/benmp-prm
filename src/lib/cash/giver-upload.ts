// src/lib/cash/giver-upload.ts
// Reads the giver sheet a branch attaches to the public cash form. Shared by the
// preview endpoint (so the branch sees what was read before submitting) and the
// submit endpoint (which re-reads the file rather than trusting the browser).
import { readSheetRows } from "../spreadsheet-rows";
import { parseCashGiverRows, type GiverFileResult } from "./giver-file";

export const MAX_GIVER_FILE_BYTES = 5 * 1024 * 1024;

export type GiverUpload =
  | { ok: true; filename: string; buffer: ArrayBuffer; result: GiverFileResult }
  | { ok: false; error: string };

export async function readGiverUpload(
  file: FormDataEntryValue | null,
): Promise<GiverUpload> {
  if (!file || typeof file === "string") {
    return { ok: false, error: "Attach the giver list (Excel or CSV)." };
  }
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    return {
      ok: false,
      error: "The giver list must be an Excel (.xlsx, .xls) or CSV file.",
    };
  }
  if (file.size > MAX_GIVER_FILE_BYTES) {
    return { ok: false, error: "The giver list is larger than 5 MB." };
  }
  const buffer = await file.arrayBuffer();
  try {
    return {
      ok: true,
      filename: file.name,
      buffer,
      result: parseCashGiverRows(readSheetRows(file.name, buffer)),
    };
  } catch {
    return {
      ok: false,
      error:
        "The giver list could not be read. Save it as .xlsx or .csv and try again.",
    };
  }
}
