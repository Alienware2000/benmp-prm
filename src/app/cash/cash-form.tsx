// src/app/cash/cash-form.tsx
"use client";

import { useState, useEffect } from "react";

type Region = { code: string; name: string };
type Hub = { id: string; label: string };
type Church = { id: string; name: string };
type ParsedGiver = { name: string; phone: string; amountMinor: number; transactionRef: string };
type GiverPreview = { givers: ParsedGiver[]; errors: string[]; totalMinor: number };
type DepositRow = { transactionId: string; channel: string; amountCedis: string; depositedOn: string };

const emptyDeposit = (): DepositRow => ({ transactionId: "", channel: "momo", amountCedis: "", depositedOn: "" });
const ghs = (minor: number) => `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toMinor = (cedis: string) => Math.round(parseFloat(cedis) * 100) || 0;

export function CashForm() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [hubId, setHubId] = useState("");
  const [churchId, setChurchId] = useState("");
  const [reportingMonth, setReportingMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [summary, setSummary] = useState({
    totalRegistered: "",
    activePartners: "",
    newRegistrations: "",
    lapsed: "",
  });
  const [giverFile, setGiverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<GiverPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [reading, setReading] = useState(false);
  const [deposits, setDeposits] = useState<DepositRow[]>([emptyDeposit()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/cash/regions")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRegions(d.regions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!regionCode) return;
    fetch(`/api/cash/hubs?regionCode=${encodeURIComponent(regionCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setHubs(d.hubs);
      })
      .catch(() => {});
  }, [regionCode]);

  useEffect(() => {
    if (!hubId) return;
    fetch(`/api/cash/churches?hubId=${encodeURIComponent(hubId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setChurches(d.churches);
      })
      .catch(() => {});
  }, [hubId]);

  const handleRegionChange = (code: string) => {
    setRegionCode(code);
    setHubs([]);
    setHubId("");
    setChurches([]);
    setChurchId("");
  };

  const handleHubChange = (id: string) => {
    setHubId(id);
    setChurches([]);
    setChurchId("");
  };

  const handleFileChange = async (file: File | null) => {
    setGiverFile(file);
    setPreview(null);
    setPreviewError("");
    if (!file) return;
    setReading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cash/preview", { method: "POST", body });
      const data = await res.json();
      if (data.ok) setPreview({ givers: data.givers, errors: data.errors, totalMinor: data.totalMinor });
      else setPreviewError(data.error ?? "The file could not be read.");
    } catch {
      setPreviewError("Network error while reading the file. Please try again.");
    } finally {
      setReading(false);
    }
  };

  const depositsTotalMinor = deposits.reduce((sum, d) => sum + toMinor(d.amountCedis), 0);
  const giversReady = !!preview && preview.givers.length > 0 && preview.errors.length === 0;

  const addDeposit = () => setDeposits((prev) => [...prev, emptyDeposit()]);
  const removeDeposit = (index: number) =>
    setDeposits((prev) => prev.filter((_, i) => i !== index));
  const updateDeposit = (index: number, field: keyof DepositRow, value: string) =>
    setDeposits((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    if (!giverFile) {
      setResult({ ok: false, message: "Attach the giver list first." });
      setSubmitting(false);
      return;
    }
    const body = new FormData();
    body.append("regionCode", regionCode);
    body.append("hubId", hubId);
    body.append("churchId", churchId);
    body.append("reportingMonth", reportingMonth);
    body.append(
      "summary",
      JSON.stringify({
        totalRegistered: parseInt(summary.totalRegistered) || 0,
        activePartners: parseInt(summary.activePartners) || 0,
        newRegistrations: parseInt(summary.newRegistrations) || 0,
        lapsed: parseInt(summary.lapsed) || 0,
      }),
    );
    body.append(
      "deposits",
      JSON.stringify(
        deposits.map((d) => ({
          transactionId: d.transactionId.trim(),
          channel: d.channel,
          amountMinor: toMinor(d.amountCedis),
          depositedOn: d.depositedOn,
        })),
      ),
    );
    body.append("file", giverFile);

    try {
      const res = await fetch("/api/cash/submit", { method: "POST", body });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: `Submission received. ID: ${data.submissionId}` });
      } else {
        const msg =
          data.error === "already_submitted"
            ? "A submission for this church and month already exists."
            : data.error ?? "Submission failed.";
        setResult({ ok: false, message: msg });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Identity */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Church Selection</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={regionCode}
            onChange={(e) => handleRegionChange(e.target.value)}
            required
            className="rounded border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="">Select region…</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
          <select
            value={hubId}
            onChange={(e) => handleHubChange(e.target.value)}
            required
            disabled={!regionCode}
            className="rounded border border-border bg-input px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select hub…</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>{h.label}</option>
            ))}
          </select>
          <select
            value={churchId}
            onChange={(e) => setChurchId(e.target.value)}
            required
            disabled={!hubId}
            className="rounded border border-border bg-input px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select church…</option>
            {churches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <input
          type="month"
          value={reportingMonth}
          onChange={(e) => setReportingMonth(e.target.value)}
          required
          className="rounded border border-border bg-input px-3 py-2 text-sm"
        />
      </section>

      {/* Section 2: Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Monthly Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs text-muted-foreground">Total Registered</span>
            <input
              type="number"
              min={0}
              value={summary.totalRegistered}
              onChange={(e) => setSummary((s) => ({ ...s, totalRegistered: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Active Partners</span>
            <input
              type="number"
              min={0}
              value={summary.activePartners}
              onChange={(e) => setSummary((s) => ({ ...s, activePartners: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">New Registrations</span>
            <input
              type="number"
              min={0}
              value={summary.newRegistrations}
              onChange={(e) => setSummary((s) => ({ ...s, newRegistrations: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Lapsed</span>
            <input
              type="number"
              min={0}
              value={summary.lapsed}
              onChange={(e) => setSummary((s) => ({ ...s, lapsed: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
        </div>
      </section>

      {/* Section 3: Giver list (uploaded) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Cash Givers</h2>
          <a href="/api/cash/template" className="text-sm text-primary underline">
            Download template
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload an Excel or CSV file with one row per giver and the columns Name, Phone,
          Amount (GHS), and Receipt No (optional).
        </p>
        <input
          type="file"
          accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        {reading && <p className="text-sm text-muted-foreground">Reading file…</p>}
        {previewError && (
          <p className="rounded bg-red-100 p-3 text-sm text-red-800">{previewError}</p>
        )}
        {preview && preview.errors.length > 0 && (
          <div className="rounded bg-red-100 p-3 text-sm text-red-800">
            <p className="font-medium">Fix these rows in your file, then upload it again:</p>
            <ul className="mt-1 list-disc pl-5">
              {preview.errors.slice(0, 20).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {preview.errors.length > 20 && <p className="mt-1">…and {preview.errors.length - 20} more.</p>}
          </div>
        )}
        {preview && preview.givers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm tabular-nums text-foreground">
              {preview.givers.length} giver{preview.givers.length === 1 ? "" : "s"} · Total {ghs(preview.totalMinor)}
            </p>
            <div className="max-h-64 overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Phone</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                    <th className="px-2 py-1">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.givers.map((g, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1">{g.name}</td>
                      <td className="px-2 py-1">{g.phone}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{ghs(g.amountMinor)}</td>
                      <td className="px-2 py-1">{g.transactionRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Transactions that carried the month's cash */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Cash Transactions</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            Total: {ghs(depositsTotalMinor)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter the transaction ID of every MoMo transfer or bank deposit you used to send
          this month&apos;s cash to BENMP.
        </p>
        {deposits.map((deposit, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              placeholder="Transaction ID"
              value={deposit.transactionId}
              onChange={(e) => updateDeposit(i, "transactionId", e.target.value)}
              required
              className="col-span-12 rounded border border-border bg-input px-2 py-1 text-sm sm:col-span-4"
            />
            <select
              value={deposit.channel}
              onChange={(e) => updateDeposit(i, "channel", e.target.value)}
              className="col-span-4 rounded border border-border bg-input px-2 py-1 text-sm sm:col-span-2"
            >
              <option value="momo">MoMo</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
            <input
              placeholder="Amount (GHS)"
              type="number"
              min={0}
              step="0.01"
              value={deposit.amountCedis}
              onChange={(e) => updateDeposit(i, "amountCedis", e.target.value)}
              required
              className="col-span-4 rounded border border-border bg-input px-2 py-1 text-sm sm:col-span-2"
            />
            <input
              type="date"
              value={deposit.depositedOn}
              onChange={(e) => updateDeposit(i, "depositedOn", e.target.value)}
              required
              className="col-span-3 rounded border border-border bg-input px-2 py-1 text-sm sm:col-span-3"
            />
            <button
              type="button"
              onClick={() => removeDeposit(i)}
              disabled={deposits.length === 1}
              className="col-span-1 rounded border border-border px-2 py-1 text-sm disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addDeposit}
          className="rounded border border-border px-3 py-1 text-sm"
        >
          + Add transaction
        </button>
        {preview && preview.totalMinor > 0 && depositsTotalMinor > 0 && depositsTotalMinor !== preview.totalMinor && (
          <p className="rounded bg-amber-100 p-3 text-sm text-amber-900">
            The transactions add up to {ghs(depositsTotalMinor)} but the giver list adds up to{" "}
            {ghs(preview.totalMinor)}. Check both before submitting — you can still submit if
            the difference is correct.
          </p>
        )}
      </section>

      {result && (
        <div
          className={
            result.ok
              ? "rounded bg-green-100 p-3 text-sm text-green-800"
              : "rounded bg-red-100 p-3 text-sm text-red-800"
          }
        >
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || reading || !churchId || !giversReady}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Cash Report"}
      </button>
    </form>
  );
}