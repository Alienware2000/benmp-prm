// src/lib/pdf-lines.ts
// Text lines from a text-based PDF (bank statements), keeping each fragment's
// horizontal position so callers can tell which column a number sits in.
import { getDocumentProxy } from "unpdf";

export type PdfFragment = { x: number; right: number; text: string };
export type PdfLine = {
  page: number;
  y: number;
  fragments: PdfFragment[];
  text: string;
};

/** Fragments within this many points vertically share a line. */
const SAME_LINE_TOLERANCE = 2.5;

type TextItemLike = { str?: string; transform?: number[]; width?: number };

/**
 * Lines top to bottom, page by page. `text` joins the fragments left to right with
 * single spaces. A scanned PDF has no text layer and yields no lines.
 */
export async function readPdfLines(buffer: ArrayBuffer): Promise<PdfLine[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer.slice(0)));
  const lines: PdfLine[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageLines: Array<{ y: number; fragments: PdfFragment[] }> = [];
    for (const item of content.items as TextItemLike[]) {
      const text = item.str?.trim();
      if (!text || !item.transform) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const fragment = { x, right: x + (item.width ?? 0), text };
      const line = pageLines.find(
        (candidate) => Math.abs(candidate.y - y) <= SAME_LINE_TOLERANCE,
      );
      if (line) line.fragments.push(fragment);
      else pageLines.push({ y, fragments: [fragment] });
    }
    pageLines.sort((a, b) => b.y - a.y);
    for (const line of pageLines) {
      line.fragments.sort((a, b) => a.x - b.x);
      lines.push({
        page: pageNumber,
        y: line.y,
        fragments: line.fragments,
        text: line.fragments.map((fragment) => fragment.text).join(" "),
      });
    }
  }
  await pdf.cleanup();
  return lines;
}
