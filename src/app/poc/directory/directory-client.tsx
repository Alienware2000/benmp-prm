"use client";

import { useEffect, useMemo, useState } from "react";

export type DirectoryRow = {
  id: string;
  name: string;
  phone: string | null;
  branch: string;
  country: string;
  givenMinor: number;
  messageable: boolean;
};

type PreviewItem = { kind: string; name: string; to: string | null; body: string };

type Summary = {
  total: number;
  sendable: number;
  skippedNoPhone: number;
  optedOut: number;
  sample: PreviewItem[];
};

type Report = {
  total: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  skippedByReason?: Record<string, number>;
};

/** Mirrors the console's language: a skip is a safety feature, not a failure. */
const SKIP_LABELS: Record<string, string> = {
  "not in allowlist": "held by safety allowlist",
  "opted out": "opted out",
  "no phone": "no phone number",
};

function reportLine(r: Report): string {
  const parts = [`${r.sent + r.queued} sent`];
  for (const [reason, n] of Object.entries(r.skippedByReason ?? {})) {
    parts.push(`${n} ${SKIP_LABELS[reason] ?? reason}`);
  }
  const counted = Object.values(r.skippedByReason ?? {}).reduce((s, n) => s + n, 0);
  if (r.skipped - counted > 0) parts.push(`${r.skipped - counted} skipped`);
  if (r.failed > 0) parts.push(`${r.failed} failed`);
  return `${parts.join(" · ")} (of ${r.total})`;
}

function ghs(minor: number): string {
  return (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Full number, shown deliberately: staff need to read it back, dial it, or check it against
 * another record before messaging someone. The page is already behind the staff password.
 */
function formatPhone(phone: string | null): string {
  return phone ?? "no phone";
}

const DEFAULT_MESSAGE = "Hi {name}, God bless you from all of us at BENMP.";

type MediaAsset = {
  id: string;
  filename: string;
  kind: string;
  url: string;
  sizeBytes: number;
};

function bytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function DirectoryClient({ partners }: { partners: DirectoryRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [mediaId, setMediaId] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Vault contents load on first use of the panel, not on every page render.
  useEffect(() => {
    fetch("/api/poc/media")
      .then((r) => r.json())
      .then((j) => setAssets(j?.data?.assets ?? []))
      .catch(() => setAssets([]));
  }, []);

  /**
   * Three steps, because the file must NOT pass through the app server: request bodies
   * are capped there (10 MB locally with middleware, ~4.5 MB on Vercel), so a video
   * would never arrive. The browser PUTs straight to storage with a signed URL.
   *   1. sign    — server validates type/size and returns a one-shot upload URL
   *   2. PUT     — browser uploads directly to Supabase Storage
   *   3. confirm — server verifies the object and catalogues it
   */
  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const signed = await fetch("/api/poc/media/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
      }).then((r) => r.json());
      if (!signed.ok) {
        setError(signed.error?.message ?? "Upload failed.");
        return;
      }

      const put = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        setError("Upload failed while transferring the file.");
        return;
      }

      const done = await fetch("/api/poc/media/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: signed.data.path, filename: file.name }),
      }).then((r) => r.json());
      if (!done.ok) {
        setError(done.error?.message ?? "Upload failed.");
        return;
      }

      const list = await fetch("/api/poc/media").then((r) => r.json());
      setAssets(list?.data?.assets ?? []);
      setMediaId(done.data.id);
      setSummary(null);
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const selectable = useMemo(() => partners.filter((p) => p.messageable), [partners]);
  const attached = useMemo(() => assets.find((a) => a.id === mediaId) ?? null, [assets, mediaId]);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Any change to the recipient list invalidates the preview it was based on.
    setSummary(null);
    setReport(null);
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.id)));
    setSummary(null);
    setReport(null);
  }

  async function call(confirm: boolean) {
    setBusy(confirm ? "send" : "preview");
    setError(null);
    try {
      const res = await fetch("/api/poc/directory/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partnerIds: [...selected],
          message,
          confirm,
          ...(mediaId ? { mediaAssetId: mediaId } : {}),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { summary?: Summary; report?: Report };
        error?: { message: string };
      };
      if (!json.ok) {
        setError(json.error?.message ?? "Something went wrong.");
        return;
      }
      if (confirm) {
        setReport(json.data?.report ?? null);
        setSummary(null);
        setSelected(new Set());
      } else {
        setSummary(json.data?.summary ?? null);
        setReport(null);
      }
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                  aria-label="Select all messageable partners on this page"
                  className="h-4 w-4 accent-[var(--success)]"
                />
              </th>
              <th className="px-2 py-2.5 font-semibold">Partner</th>
              <th className="px-2 py-2.5 font-semibold">Branch</th>
              <th className="px-2 py-2.5 font-semibold">WhatsApp</th>
              <th className="px-4 py-2.5 text-right font-semibold">Given</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No partners to show.
                </td>
              </tr>
            )}
            {partners.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    disabled={!p.messageable}
                    aria-label={`Select ${p.name}`}
                    className="h-4 w-4 accent-[var(--success)] disabled:opacity-30"
                  />
                </td>
                <td className="px-2 py-2.5">
                  <span className={p.name === "Unknown" ? "text-muted-foreground italic" : "font-medium"}>
                    {p.name}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-muted-foreground">{p.branch}</td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-muted-foreground">
                  {p.messageable ? (
                    formatPhone(p.phone)
                  ) : (
                    <span className="text-muted-foreground/60">no phone · can&apos;t message</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {p.givenMinor > 0 ? `GHS ${ghs(p.givenMinor)}` : <span className="text-muted-foreground/50">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Send a message</h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {selected.size} selected
          </span>
        </div>

        <label htmlFor="message" className="mt-3 mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Message · <span className="normal-case tracking-normal">{"{name}"} becomes their first name</span>
        </label>
        <textarea
          id="message"
          rows={3}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSummary(null);
          }}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2.5">
          <label htmlFor="media" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Attach
          </label>
          <select
            id="media"
            value={mediaId}
            onChange={(e) => {
              setMediaId(e.target.value);
              setSummary(null);
            }}
            className="min-w-[180px] flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-success"
          >
            <option value="">No attachment</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind === "video" ? "🎬" : a.kind === "image" ? "🖼" : "📄"} {a.filename} ({bytes(a.sizeBytes)})
              </option>
            ))}
          </select>
          <label className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-background">
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/mpeg,audio/ogg,application/pdf"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {mediaId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Every recipient gets this attachment with their message. WhatsApp allows one per message.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => call(false)}
            disabled={selected.size === 0 || busy !== null}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-background disabled:opacity-40"
          >
            {busy === "preview" ? "Preparing…" : "Preview"}
          </button>
          {summary && summary.sendable > 0 && (
            <button
              onClick={() => call(true)}
              disabled={busy !== null}
              className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy === "send" ? "Sending…" : `Send to ${summary.sendable}`}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {summary && (
          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            {/* The preview must show the attachment too — otherwise "what will be sent"
                is only half the answer. */}
            {attached && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                {attached.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attached.url}
                    alt={attached.filename}
                    className="h-11 w-11 flex-none rounded-md object-cover"
                  />
                ) : (
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-md bg-background text-lg">
                    {attached.kind === "video" ? "🎬" : attached.kind === "audio" ? "🎵" : "📄"}
                  </span>
                )}
                <span className="min-w-0 break-words text-[13px]">
                  <b>{attached.filename}</b>
                  <span className="text-muted-foreground"> · {bytes(attached.sizeBytes)} · attached to every message</span>
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <b className="text-foreground tabular-nums">{summary.sendable}</b> will be sent
              {summary.skippedNoPhone > 0 && ` · ${summary.skippedNoPhone} have no phone`}
              {summary.optedOut > 0 && ` · ${summary.optedOut} opted out`}
              . Nothing has been sent yet.
            </p>
            <ul className="mt-2 space-y-1.5">
              {summary.sample.map((m, i) => (
                <li key={i} className="rounded-lg bg-surface px-3 py-2 text-[13px]">
                  <span className="text-muted-foreground tabular-nums">{m.to ?? "no phone"}</span>
                  <span className="mx-2 text-muted-foreground/40">·</span>
                  {m.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {reportLine(report)}
          </p>
        )}
      </div>
    </>
  );
}
