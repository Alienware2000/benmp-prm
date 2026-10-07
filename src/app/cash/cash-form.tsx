// src/app/cash/cash-form.tsx
"use client";

import { useState, useEffect } from "react";

type Region = { code: string; name: string };
type Hub = { id: string; label: string };
type Church = { id: string; name: string };
type GiverRow = {
  name: string;
  phone: string;
  amountCedis: string;
  transactionRef: string;
};

const emptyGiver = (): GiverRow => ({ name: "", phone: "", amountCedis: "", transactionRef: "" });

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
  const [givers, setGivers] = useState<GiverRow[]>([emptyGiver()]);
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

  const totalGiverAmount = givers.reduce((sum, g) => {
    const v = parseFloat(g.amountCedis);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const addGiver = () => setGivers((prev) => [...prev, emptyGiver()]);
  const removeGiver = (index: number) =>
    setGivers((prev) => prev.filter((_, i) => i !== index));
  const updateGiver = (index: number, field: keyof GiverRow, value: string) =>
    setGivers((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const payload = {
      regionCode,
      hubId,
      churchId,
      reportingMonth,
      summary: {
        totalRegistered: parseInt(summary.totalRegistered) || 0,
        activePartners: parseInt(summary.activePartners) || 0,
        newRegistrations: parseInt(summary.newRegistrations) || 0,
        lapsed: parseInt(summary.lapsed) || 0,
      },
      givers: givers
        .filter((g) => g.name.trim() || g.phone.trim())
        .map((g) => ({
          name: g.name.trim(),
          phone: g.phone.trim(),
          amountMinor: Math.round(parseFloat(g.amountCedis) * 100) || 0,
          transactionRef: g.transactionRef.trim(),
        })),
    };

    try {
      const res = await fetch("/api/cash/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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

      {/* Section 3: Giver list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Cash Givers</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            Total: GHS {totalGiverAmount.toFixed(2)}
          </span>
        </div>
        {givers.map((giver, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              placeholder="Name"
              value={giver.name}
              onChange={(e) => updateGiver(i, "name", e.target.value)}
              className="col-span-4 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <input
              placeholder="Phone"
              value={giver.phone}
              onChange={(e) => updateGiver(i, "phone", e.target.value)}
              className="col-span-3 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <input
              placeholder="Amount (GHS)"
              type="number"
              min={0}
              step="0.01"
              value={giver.amountCedis}
              onChange={(e) => updateGiver(i, "amountCedis", e.target.value)}
              className="col-span-2 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <input
              placeholder="Receipt ref (optional)"
              value={giver.transactionRef}
              onChange={(e) => updateGiver(i, "transactionRef", e.target.value)}
              className="col-span-2 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeGiver(i)}
              disabled={givers.length === 1}
              className="col-span-1 rounded border border-border px-2 py-1 text-sm disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addGiver}
          className="rounded border border-border px-3 py-1 text-sm"
        >
          + Add giver
        </button>
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
        disabled={submitting || !churchId}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Cash Report"}
      </button>
    </form>
  );
}