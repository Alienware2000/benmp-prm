"use client";

/** Opens the browser's print dialog, where "Save as PDF" makes the file. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
    >
      Download PDF
    </button>
  );
}
