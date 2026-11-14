// src/app/cash/cash-form.tsx
"use client";

import { useState, useEffect } from "react";

type Region = { code: string; name: string; momo_required: boolean };
type Hub = { id: string; label: string };
type Church = { id: string; name: string };
type ParsedGiver = { name: string; phone: string; amountMinor: number; transactionRef: string };
type GiverPreview = { givers: ParsedGiver[]; errors: string[]; totalMinor: number };
type DepositRow = { transactionId: string; channel: string; amountCedis: string; depositedOn: string };
type MemberRow = { name: string; whatsappPhone: string; momoPhone: string };
type MemberIssue = { index: number; issues: { field: string; message: string }[] };

const emptyDeposit = (): DepositRow => ({ transactionId: "", channel: "momo", amountCedis: "", depositedOn: "" });
const emptyMember = (): MemberRow => ({ name: "", whatsappPhone: "", momoPhone: "" });
const ghs = (minor: number) => `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toMinor = (cedis: string) => Math.round(parseFloat(cedis) * 100) || 0;
const toCount = (raw: string) => (raw.trim() === "" ? null : Number(raw));
const isBlankDeposit = (d: DepositRow) => !d.transactionId.trim() && !d.amountCedis.trim() && !d.depositedOn;
const isBlankMember = (m: MemberRow) => !m.name.trim() && !m.whatsappPhone.trim() && !m.momoPhone.trim();

const SUMMARY_FIELDS = [
  { key: "totalRegistered", label: "Total Registered" },
  { key: "activePartners", label: "Active Partners" },
  { key: "newRegistrations", label: "New Registrations" },
  { key: "lapsed", label: "Lapsed" },
] as const;

/**
 * The Monthly Summary Form (Decision 0039): the four monthly numbers are
 * required; new members are optional; cash givers and cash transactions are
 * optional and shown only for Ghana regions.
 */
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
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberIssues, setMemberIssues] = useState<MemberIssue[]>([]);
  const [giverFile, setGiverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<GiverPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [reading, setReading] = useState(false);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const reportsCash = regions.find((r) => r.code === regionCode)?.momo_required ?? false;

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

  const filledDeposits = deposits.filter((d) => !isBlankDeposit(d));
  const depositsTotalMinor = filledDeposits.reduce((sum, d) => sum + toMinor(d.amountCedis), 0);
  // The giver list is optional, but a chosen file must have been read cleanly.
  const giversBlocking = reportsCash && !!giverFile && !(preview && preview.givers.length > 0 && preview.errors.length === 0);

  const addDeposit = () => setDeposits((prev) => [...prev, emptyDeposit()]);
  const removeDeposit = (index: number) =>
    setDeposits((prev) => prev.filter((_, i) => i !== index));
  const updateDeposit = (index: number, field: keyof DepositRow, value: string) =>
    setDeposits((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );

  const addMember = () => setMembers((prev) => [...prev, emptyMember()]);
  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
    setMemberIssues([]);
  };
  const updateMember = (index: number, field: keyof MemberRow, value: string) =>
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setMemberIssues([]);

    const filledMembers = members.filter((m) => !isBlankMember(m));
    const body = new FormData();
    body.append("regionCode", regionCode);
    body.append("hubId", hubId);
    body.append("churchId", churchId);
    body.append("reportingMonth", reportingMonth);
    body.append(
      "summary",
      JSON.stringify({
        totalRegistered: toCount(summary.totalRegistered),
        activePartners: toCount(summary.activePartners),
        newRegistrations: toCount(summary.newRegistrations),
        lapsed: toCount(summary.lapsed),
      }),
    );
    body.append(
      "members",
      JSON.stringify(
        filledMembers.map((m) => ({
          name: m.name.trim(),
          whatsappPhone: m.whatsappPhone.trim(),
          momoPhone: reportsCash ? m.momoPhone.trim() : "",
        })),
      ),
    );
    if (reportsCash) {
      body.append(
        "deposits",
        JSON.stringify(
          filledDeposits.map((d) => ({
            transactionId: d.transactionId.trim(),
            channel: d.channel,
            amountMinor: toMinor(d.amountCedis),
            depositedOn: d.depositedOn,
          })),
        ),
      );
      if (giverFile) body.append("file", giverFile);
    }

    try {
      const res = await fetch("/api/cash/submit", { method: "POST", body });
      const data = await res.json();
      if (data.ok) {
        const added =
          data.membersAdded > 0
            ? ` ${data.membersAdded} new member${data.membersAdded === 1 ? "" : "s"} added to your church.`
            : "";
        const listed =
          data.membersAlreadyListed > 0
            ? ` ${data.membersAlreadyListed} ${data.membersAlreadyListed === 1 ? "was" : "were"} already on your list.`
            : "";
        setResult({ ok: true, message: `Monthly summary received.${added}${listed} Reference: ${data.submissionId}` });
      } else {
        if (Array.isArray(data.memberIssues)) {
          // Server indexes count the filled rows only; map them back to the rows on screen.
          const filledIndexes = members.flatMap((m, i) => (isBlankMember(m) ? [] : [i]));
          setMemberIssues(
            (data.memberIssues as MemberIssue[]).map((m) => ({ ...m, index: filledIndexes[m.index] ?? m.index })),
          );
        }
        const msg =
          data.error === "already_submitted"
            ? "A monthly summary for this church and month has already been submitted."
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
            <option value="">Select one…</option>
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

      {/* Section 2: Monthly summary — the required part of the form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Monthly Summary <span className="text-sm font-normal text-red-700">(required)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY_FIELDS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="text-xs text-muted-foreground">{label}</span>
              <input
                type="number"
                min={0}
                step={1}
                required
                value={summary[key]}
                onChange={(e) => setSummary((s) => ({ ...s, [key]: e.target.value }))}
                className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Section 3: New members for the church's list */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Add New Members <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          People who joined your church this month. They are added to your church&apos;s
          partner list. Give each person&apos;s full name (at least two names) and WhatsApp
          number{reportsCash ? ", plus their MoMo number" : ""}.
        </p>
        {members.map((member, i) => {
          const issues = memberIssues.find((m) => m.index === i)?.issues ?? [];
          return (
            <div key={i} className="space-y-1">
              <div className="grid grid-cols-12 gap-2">
                <input
                  placeholder="Full name"
                  value={member.name}
                  onChange={(e) => updateMember(i, "name", e.target.value)}
                  className={`col-span-12 rounded border border-border bg-input px-2 py-1 text-sm ${reportsCash ? "sm:col-span-5" : "sm:col-span-7"}`}
                />
                <input
                  placeholder="WhatsApp number"
                  inputMode="tel"
                  value={member.whatsappPhone}
                  onChange={(e) => updateMember(i, "whatsappPhone", e.target.value)}
                  className={`rounded border border-border bg-input px-2 py-1 text-sm ${reportsCash ? "col-span-5 sm:col-span-3" : "col-span-11 sm:col-span-4"}`}
                />
                {reportsCash && (
                  <input
                    placeholder="MoMo number"
                    inputMode="tel"
                    value={member.momoPhone}
                    onChange={(e) => updateMember(i, "momoPhone", e.target.value)}
                    className="col-span-6 rounded border border-border bg-input px-2 py-1 text-sm sm:col-span-3"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  aria-label="Remove this member"
                  className="col-span-1 rounded border border-border px-2 py-1 text-sm"
                >
                  ✕
                </button>
              </div>
              {issues.length > 0 && (
                <ul className="rounded bg-red-100 px-3 py-2 text-xs text-red-800">
                  {issues.map((issue) => (
                    <li key={issue.field + issue.message}>{issue.message}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={addMember}
          className="rounded border border-border px-3 py-1 text-sm"
        >
          + Add member
        </button>
      </section>

      {reportsCash && (
        <>
          {/* Section 4: Giver list (uploaded) — Ghana regions, optional */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Cash Givers <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </h2>
              <a href="/api/cash/template" className="text-sm text-primary underline">
                Download template
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              If your church collected cash this month, upload an Excel or CSV file with one
              row per giver and the columns Name, Phone, Amount (GHS), and Receipt No (optional).
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

          {/* Section 5: Transactions that carried the month's cash — Ghana regions, optional */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Cash Transactions <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </h2>
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
                  aria-label="Remove this transaction"
                  className="col-span-1 rounded border border-border px-2 py-1 text-sm"
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
        </>
      )}

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
        disabled={submitting || reading || !churchId || giversBlocking}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Monthly Summary"}
      </button>
    </form>
  );
}
