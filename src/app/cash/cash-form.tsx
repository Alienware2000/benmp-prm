// src/app/cash/cash-form.tsx
"use client";

import { useState, useEffect } from "react";

type Region = { code: string; name: string; momo_required: boolean };
type Hub = { id: string; label: string };
type Church = { id: string; name: string };
type MemberRow = { name: string; whatsappPhone: string; momoPhone: string };
type MemberIssue = { index: number; issues: { field: string; message: string }[] };

const emptyMember = (): MemberRow => ({ name: "", whatsappPhone: "", momoPhone: "" });
const toCount = (raw: string) => (raw.trim() === "" ? null : Number(raw));
const isBlankMember = (m: MemberRow) => !m.name.trim() && !m.whatsappPhone.trim() && !m.momoPhone.trim();

const SUMMARY_FIELDS = [
  { key: "totalRegistered", label: "Total Registered" },
  { key: "activePartners", label: "Active Partners" },
  { key: "newRegistrations", label: "New Registrations" },
  { key: "lapsed", label: "Lapsed" },
] as const;

/**
 * The Monthly Summary Form (Decisions 0039, 0043): the four monthly numbers
 * are required; new members are optional; Ghana regions may also give the
 * church's total BENMP giving for the month.
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
  const [givingTotal, setGivingTotal] = useState("");
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
    if (reportsCash) body.append("givingTotal", givingTotal.trim());

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
        /* Section 4: The church's BENMP giving for the month — Ghana regions, optional */
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            BENMP Giving <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            The total your church gave to BENMP this month, however it was given. Leave it blank if there was none.
          </p>
          <label className="block max-w-xs">
            <span className="text-xs text-muted-foreground">Total giving (GHS)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={givingTotal}
              onChange={(e) => setGivingTotal(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
        </section>
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
        disabled={submitting || !churchId}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Monthly Summary"}
      </button>
    </form>
  );
}
