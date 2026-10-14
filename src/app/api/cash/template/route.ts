// src/app/api/cash/template/route.ts
// Public: the blank giver sheet branches fill in and upload with the cash form.
import * as XLSX from "xlsx";
import { GIVER_TEMPLATE_HEADERS } from "@/lib/cash/giver-file";

export const dynamic = "force-static";

export function GET() {
  const sheet = XLSX.utils.aoa_to_sheet([[...GIVER_TEMPLATE_HEADERS]]);
  sheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Givers");
  const body = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cash-givers-template.xlsx"',
    },
  });
}
