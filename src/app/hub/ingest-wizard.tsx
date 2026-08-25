"use client";

/**
 * The hub ingestion wizard (HP-3, Decision 0018 items 4-5).
 *
 * Upload -> pick sheet -> point at the name / WhatsApp / church columns ->
 * editable preview where every failing cell is flagged with the reason ->
 * save. Validation here is the same pure module the server re-runs at submit
 * (src/lib/hub/ingest.ts), so a clean preview is a clean submission; the only
 * extra server knowledge is which phones already exist, fetched at preview
 * time and re-checked on save.
 */
import {
  ArrowDown,
  Check,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhone } from "@/lib/phone";
import { normalizeChurchKey } from "@/lib/hub/seed";
import {
  extractCandidates,
  validateCandidates,
  type ColumnMap,
  type ExistingPhoneInfo,
  type HubChurchOption,
  type RowIssue,
} from "@/lib/hub/ingest";

type ParsedSheet = { name: string; rows: string[][] };

type EditRow = {
  rowIndex: number;
  raw: string[];
  name: string;
  phone: string;
  church: string;
  removed: boolean;
};

type Step = "upload" | "map" | "preview" | "done";

const inputBase =
  "h-9 w-full rounded border bg-background px-2.5 text-[13px] text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Columns" },
  { key: "preview", label: "Check & fix" },
  { key: "done", label: "Saved" },
];

/** Where-am-I strip across the top of the wizard. */
function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className={
              "grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold " +
              (i < idx
                ? "bg-success/15 text-success"
                : i === idx
                  ? "bg-brand text-white"
                  : "bg-muted text-muted-foreground")
            }
          >
            {i < idx ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span
            className={
              "text-xs font-semibold " +
              (i === idx ? "text-foreground" : "text-muted-foreground")
            }
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span className="mx-1 h-px w-4 bg-border sm:w-7" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

export function IngestWizard({ churches }: { churches: HubChurchOption[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [cols, setCols] = useState<{ name: number | ""; phone: number | ""; church: number | "" }>(
    { name: "", phone: "", church: "" },
  );

  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [existingPhones, setExistingPhones] = useState<
    Record<string, ExistingPhoneInfo>
  >({});
  const [serverIssues, setServerIssues] = useState<
    Record<number, RowIssue[]>
  >({});
  const [result, setResult] = useState<{ accepted: number; removed: number } | null>(null);

  const sheet = sheets[sheetIndex];

  // ----- validation (live, same rules as the server) -----------------------
  const validated = useMemo(() => {
    if (step !== "preview") return [];
    const active = rows.filter((r) => !r.removed);
    return validateCandidates(active, {
      churches,
      existingPhones: new Map(Object.entries(existingPhones)),
    });
  }, [rows, churches, existingPhones, step]);

  const issuesByRow = useMemo(() => {
    const m = new Map<number, RowIssue[]>();
    for (const v of validated) {
      const extra = serverIssues[v.rowIndex] ?? [];
      const all = [...v.issues, ...extra];
      if (all.length > 0) m.set(v.rowIndex, all);
    }
    return m;
  }, [validated, serverIssues]);

  const activeCount = rows.filter((r) => !r.removed).length;
  const flaggedCount = issuesByRow.size;

  // ----- step 1: upload -----------------------------------------------------
  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/hub/ingest/parse", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fileName?: string;
        sheets?: ParsedSheet[];
      };
      if (!res.ok || !data.ok || !data.sheets) {
        setError(data.error ?? "Could not read that file.");
        return;
      }
      setFileName(data.fileName ?? file.name);
      setSheets(data.sheets);
      setSheetIndex(0);
      setCols(guessColumns(data.sheets[0]));
      setStep("map");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // ----- step 2: mapping ----------------------------------------------------
  const columnCount = useMemo(
    () => (sheet ? Math.max(...sheet.rows.slice(0, 20).map((r) => r.length), 0) : 0),
    [sheet],
  );

  function columnLabel(c: number): string {
    const letter = String.fromCharCode(65 + (c % 26));
    const header = hasHeader ? (sheet?.rows[0]?.[c] ?? "").trim() : "";
    return header ? `Column ${letter} — “${header}”` : `Column ${letter}`;
  }

  async function toPreview() {
    if (!sheet || cols.name === "" || cols.phone === "" || cols.church === "") return;
    const map: ColumnMap = { name: cols.name, phone: cols.phone, church: cols.church };
    const candidates = extractCandidates(sheet.rows, map, hasHeader);
    if (candidates.length === 0) {
      setError("No rows found in those columns. Check the sheet and column choices.");
      return;
    }
    const edit: EditRow[] = candidates.map((c) => ({ ...c, removed: false }));
    setRows(edit);
    setServerIssues({});
    setBusy(true);
    setError(null);
    try {
      const phones = edit
        .map((r) => normalizePhone(r.phone))
        .filter((p): p is string => p !== null);
      const res = await fetch("/api/hub/ingest/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phones }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        existing?: Record<string, ExistingPhoneInfo>;
      };
      setExistingPhones(data.existing ?? {});
    } catch {
      // The submit re-checks server-side; the preview just loses early warnings.
      setExistingPhones({});
    } finally {
      setBusy(false);
      setStep("preview");
    }
  }

  // ----- step 3: preview edits ---------------------------------------------
  function editRow(rowIndex: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r) => (r.rowIndex === rowIndex ? { ...r, ...patch } : r)));
    setServerIssues((s) => {
      if (!(rowIndex in s)) return s;
      const next = { ...s };
      delete next[rowIndex];
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/ingest/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName,
          sheetName: sheet?.name ?? "",
          columnMap: cols,
          rows,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        accepted?: number;
        removed?: number;
        rows?: { rowIndex: number; issues: RowIssue[] }[];
      };
      if (res.ok && data.ok) {
        setResult({ accepted: data.accepted ?? 0, removed: data.removed ?? 0 });
        setStep("done");
        router.refresh(); // update the partner count on the page
      } else {
        if (data.rows) {
          setServerIssues(
            Object.fromEntries(data.rows.map((r) => [r.rowIndex, r.issues])),
          );
        }
        setError(data.error ?? "Could not save. Fix the flagged rows and try again.");
      }
    } catch {
      setError("Could not reach the server. Nothing was saved — try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setSheets([]);
    setRows([]);
    setExistingPhones({});
    setServerIssues({});
    setResult(null);
    setError(null);
  }

  // ----- render -------------------------------------------------------------
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="h-1 rounded-t-lg bg-accent" />
      <div className="p-5 sm:p-6">
        <StepIndicator current={step} />
        {step === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
            className={
              "rounded-lg border-2 border-dashed px-4 py-10 text-center transition " +
              (dragging
                ? "border-brand bg-brand/5"
                : "border-border bg-background/40")
            }
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-brand/10 text-brand">
              <FileUp className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-3 text-base font-semibold text-foreground">
              Upload your hub&apos;s partner list
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              An Excel file (.xlsx) or CSV with names, WhatsApp numbers, and the
              church each partner belongs to. You will check and correct
              everything before anything is saved — nothing goes in behind your
              back.
            </p>
            <div className="mt-5">
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xlsm,.csv"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-45"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                )}
                {busy ? "Reading file..." : "Choose file"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                or drag the file anywhere into this box
              </p>
            </div>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Where is everything in “{fileName}”?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the sheet, then point at the three columns. Column titles
                in the file don&apos;t matter — your choice here does.
              </p>
            </div>

            {sheets.length > 1 && (
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-foreground">
                  Sheet (tab) to bring in
                </span>
                <select
                  value={sheetIndex}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setSheetIndex(i);
                    setCols(guessColumns(sheets[i]));
                  }}
                  className={inputBase + " border-border"}
                >
                  {sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name} ({s.rows.length} rows)
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              The first row is column titles, not a person
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["name", "Names column"],
                  ["phone", "WhatsApp numbers column"],
                  ["church", "Church column"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-foreground">
                    {label}
                  </span>
                  <select
                    value={cols[key]}
                    onChange={(e) =>
                      setCols((c) => ({
                        ...c,
                        [key]: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    className={inputBase + " border-border"}
                  >
                    <option value="">Choose...</option>
                    {Array.from({ length: columnCount }, (_, c) => (
                      <option key={c} value={c}>
                        {columnLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr>
                    {Array.from({ length: columnCount }, (_, c) => {
                      const tag =
                        c === cols.name
                          ? "Name"
                          : c === cols.phone
                            ? "Phone"
                            : c === cols.church
                              ? "Church"
                              : null;
                      return (
                        <th key={c} className="border-b border-border px-3 py-1.5">
                          {tag ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              <Check className="h-3 w-3" aria-hidden />
                              {tag}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                              —
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 6).map((r, i) => (
                    <tr key={i} className={i === 0 && hasHeader ? "bg-muted/60 font-semibold" : "odd:bg-background"}>
                      {Array.from({ length: columnCount }, (_, c) => {
                        const picked =
                          c === cols.name || c === cols.phone || c === cols.church;
                        return (
                          <td
                            key={c}
                            className={
                              "whitespace-nowrap border-b border-border px-3 py-1.5 " +
                              (picked ? "bg-brand/5 text-foreground" : "text-muted-foreground")
                            }
                          >
                            {(r[c] ?? "").slice(0, 40)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={reset} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                Start over
              </button>
              <button
                type="button"
                disabled={busy || cols.name === "" || cols.phone === "" || cols.church === ""}
                onClick={toPreview}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
                Check the rows
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Check before saving
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {activeCount} row{activeCount === 1 ? "" : "s"} from “{sheet?.name}”
                  {flaggedCount > 0 ? (
                    <span className="font-semibold text-danger">
                      {" "}· {flaggedCount} need{flaggedCount === 1 ? "s" : ""} attention
                    </span>
                  ) : (
                    <span className="font-semibold text-success"> · all clean</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {flaggedCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .querySelector('[data-flagged="true"]')
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-3 text-xs font-semibold text-danger transition hover:bg-danger/10"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    Go to first problem
                  </button>
                )}
                <button type="button" onClick={reset} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                  Start over
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded border border-border">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted text-xs font-semibold text-muted-foreground">
                    <th className="px-2 py-2">Row</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">WhatsApp number</th>
                    <th className="px-2 py-2">Church</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <PreviewRow
                      key={r.rowIndex}
                      row={r}
                      churches={churches}
                      issues={issuesByRow.get(r.rowIndex) ?? []}
                      onEdit={editRow}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2.5 text-[13px] leading-5 text-danger">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                {error}
              </p>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={busy || flaggedCount > 0 || activeCount === 0}
                onClick={submit}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CircleCheck className="h-4 w-4" aria-hidden />
                )}
                Save {activeCount} partner{activeCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-success/10 text-success">
              <CircleCheck className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-3 text-base font-semibold text-foreground">
              {result.accepted} partner{result.accepted === 1 ? "" : "s"} saved
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              From “{fileName}”
              {result.removed > 0
                ? ` — ${result.removed} row${result.removed === 1 ? " was" : "s were"} left out and kept on record.`
                : "."}{" "}
              They now count toward your hub&apos;s totals below.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              <FileUp className="h-4 w-4" aria-hidden />
              Upload another file
            </button>
          </div>
        )}

        {step === "upload" && error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2.5 text-left text-[13px] leading-5 text-danger">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            {error}
          </p>
        )}
        {step === "map" && error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2.5 text-[13px] leading-5 text-danger">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PreviewRow({
  row,
  churches,
  issues,
  onEdit,
}: {
  row: EditRow;
  churches: HubChurchOption[];
  issues: RowIssue[];
  onEdit: (rowIndex: number, patch: Partial<EditRow>) => void;
}) {
  const issueFor = (field: RowIssue["field"]) =>
    issues.filter((i) => i.field === field).map((i) => i.message).join(" ");

  if (row.removed) {
    return (
      <tr className="bg-muted/40 text-muted-foreground">
        <td className="px-2 py-1.5 tabular-nums">{row.rowIndex}</td>
        <td className="px-2 py-1.5 line-through">{row.name || "—"}</td>
        <td className="px-2 py-1.5 line-through">{row.phone || "—"}</td>
        <td className="px-2 py-1.5 line-through">{row.church || "—"}</td>
        <td className="px-2 py-1.5 text-right">
          <button
            type="button"
            onClick={() => onEdit(row.rowIndex, { removed: false })}
            title="Put this row back"
            className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restore
          </button>
        </td>
      </tr>
    );
  }

  const matchedChurch = churches.find(
    (c) => c.nameKey === normalizeChurchKey(row.church),
  );

  const flagged = issues.length > 0;
  return (
    <tr className="odd:bg-background align-top" data-flagged={flagged || undefined}>
      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {flagged ? (
            <TriangleAlert className="h-3.5 w-3.5 text-danger" aria-hidden />
          ) : (
            <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          )}
          {row.rowIndex}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <FlaggedCell message={issueFor("name")}>
          <input
            value={row.name}
            onChange={(e) => onEdit(row.rowIndex, { name: e.target.value })}
            className={inputBase + (issueFor("name") ? " border-danger/60" : " border-border")}
          />
        </FlaggedCell>
      </td>
      <td className="px-2 py-1.5">
        <FlaggedCell message={issueFor("phone")}>
          <input
            value={row.phone}
            inputMode="tel"
            onChange={(e) => onEdit(row.rowIndex, { phone: e.target.value })}
            className={inputBase + (issueFor("phone") ? " border-danger/60" : " border-border")}
          />
        </FlaggedCell>
      </td>
      <td className="px-2 py-1.5">
        <FlaggedCell message={issueFor("church")}>
          <select
            value={matchedChurch?.name ?? ""}
            onChange={(e) => onEdit(row.rowIndex, { church: e.target.value })}
            className={inputBase + (issueFor("church") ? " border-danger/60" : " border-border")}
          >
            <option value="" disabled>
              {row.church ? `“${row.church.slice(0, 28)}” — pick from list` : "Pick church..."}
            </option>
            {churches.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </FlaggedCell>
      </td>
      <td className="px-2 py-1.5 text-right">
        <button
          type="button"
          onClick={() => onEdit(row.rowIndex, { removed: true })}
          title="Leave this row out"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}

/** Red-triangle flag with the reason on hover (and under the field on touch). */
function FlaggedCell({
  message,
  children,
}: {
  message: string;
  children: React.ReactNode;
}) {
  if (!message) return <>{children}</>;
  return (
    <div title={message}>
      <div className="relative">
        {children}
        <TriangleAlert
          className="pointer-events-none absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-surface text-danger"
          aria-hidden
        />
      </div>
      <p className="mt-1 text-[11px] leading-4 text-danger">{message}</p>
    </div>
  );
}

/** Guess the column mapping from header words; the admin can always override. */
function guessColumns(sheet: ParsedSheet | undefined): {
  name: number | "";
  phone: number | "";
  church: number | "";
} {
  const header = sheet?.rows[0] ?? [];
  let name: number | "" = "";
  let phone: number | "" = "";
  let church: number | "" = "";
  header.forEach((cell, i) => {
    const h = cell.toLowerCase();
    if (name === "" && /name/.test(h) && !/church|branch/.test(h)) name = i;
    if (phone === "" && /(phone|tel|whatsapp|number|contact|momo)/.test(h)) phone = i;
    if (church === "" && /(church|branch|assembly)/.test(h)) church = i;
  });
  return { name, phone, church };
}
