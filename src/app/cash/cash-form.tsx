// src/app/cash/cash-form.tsx
"use client";

import { useState, useEffect, useRef } from "react";

type Region = { code: string; name: string; momo_required: boolean };
type Hub = { id: string; label: string };
type Church = { id: string; name: string };
type MemberRow = { name: string; whatsappPhone: string; momoPhone: string };
type MemberIssue = { index: number; issues: { field: string; message: string }[] };
type ChurchMember = { id: string; name: string };
type Mark = "active" | "new" | "lapsed" | "remove";

const MARKS: { value: Mark; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "new", label: "New" },
  { value: "lapsed", label: "Lapsed" },
  { value: "remove", label: "Remove" },
];

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
 * The Monthly Summary Form (Decisions 0039, 0043, 0047): the four monthly
 * numbers and the amount given (US dollars) are required; every member on the
 * church's list is marked Active, New, Lapsed or Remove, and new members can be
 * added in the same section.
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
  const [givenUsd, setGivenUsd] = useState("");
  const [churchMembers, setChurchMembers] = useState<ChurchMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [unmarked, setUnmarked] = useState<Set<string>>(new Set());
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

  // The members section follows the church chosen above: choosing a church loads
  // its own list and clears any marks made for the previous one. A late answer
  // for a church no longer selected is ignored.
  const membersFor = useRef("");
  const handleChurchChange = (id: string) => {
    setChurchId(id);
    setMarks({});
    setUnmarked(new Set());
    setChurchMembers([]);
    membersFor.current = id;
    if (!id) {
      setLoadingMembers(false);
      return;
    }
    setLoadingMembers(true);
    fetch(`/api/cash/members?churchId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (membersFor.current === id && d.ok) setChurchMembers(d.members);
      })
      .catch(() => {})
      .finally(() => {
        if (membersFor.current === id) setLoadingMembers(false);
      });
  };

  const markedCount = churchMembers.filter((m) => marks[m.id]).length;
  const setMark = (id: string, mark: Mark) => {
    setMarks((prev) => ({ ...prev, [id]: mark }));
    setUnmarked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const markAllUnmarked = (mark: Mark) =>
    setMarks((prev) => {
      const next = { ...prev };
      for (const m of churchMembers) next[m.id] ??= mark;
      return next;
    });

  const handleRegionChange = (code: string) => {
    setRegionCode(code);
    setHubs([]);
    setHubId("");
    setChurches([]);
    handleChurchChange("");
  };

  const handleHubChange = (id: string) => {
    setHubId(id);
    setChurches([]);
    handleChurchChange("");
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
    body.append("givenUsd", givenUsd.trim());
    body.append(
      "marks",
      JSON.stringify(
        churchMembers
          .filter((m) => marks[m.id])
          .map((m) => ({ partnerId: m.id, status: marks[m.id] })),
      ),
    );

    try {
      const res = await fetch("/api/cash/submit", { method: "POST", body });
      const data = await res.json();
      if (data.ok) {
        const added =
          data.membersAdded > 0
            ? ` ${data.membersAdded} new member${data.membersAdded === 1 ? "" : "s"} added to your church.`
            : "";
        const removed =
          data.membersRemoved > 0
            ? ` ${data.membersRemoved} member${data.membersRemoved === 1 ? "" : "s"} taken off your list (your hub admin can restore them).`
            : "";
        const listed =
          data.membersAlreadyListed > 0
            ? ` ${data.membersAlreadyListed} ${data.membersAlreadyListed === 1 ? "was" : "were"} already on your list.`
            : "";
        setResult({ ok: true, message: `Monthly summary received.${added}${removed}${listed} Reference: ${data.submissionId}` });
      } else {
        if (Array.isArray(data.unmarked)) setUnmarked(new Set(data.unmarked as string[]));
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
            onChange={(e) => handleChurchChange(e.target.value)}
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
        <label className="block max-w-xs">
          <span className="text-xs text-muted-foreground">Amount given this month (US dollar equivalent)</span>
          <div className="mt-1 flex items-center rounded border border-border bg-input">
            <span className="pl-2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              required
              value={givenUsd}
              onChange={(e) => setGivenUsd(e.target.value)}
              className="w-full bg-transparent px-2 py-1 text-sm outline-none"
            />
          </div>
          <span className="mt-1 block text-xs text-muted-foreground">
            Everything your church gave to BENMP this month, converted to US dollars. Enter 0 if nothing was given.
          </span>
        </label>
      </section>

      {/* Section 3: Every member marked, and new members added */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Members <span className="text-sm font-normal text-red-700">(mark every member)</span>
          </h2>
          {churchMembers.length > 0 && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {markedCount} of {churchMembers.length} marked
            </span>
          )}
        </div>
        {!churchId ? (
          <p className="text-sm text-muted-foreground">Choose your church above to see its members.</p>
        ) : loadingMembers ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : churchMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members are on this church&apos;s list yet. Add them below.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Mark each person for this month. Remove takes them off your church&apos;s list; your hub admin can
              restore anyone removed by mistake.
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => markAllUnmarked("active")}
                className="rounded border border-border px-3 py-1"
              >
                Mark the rest Active
              </button>
            </div>
            <ul className="divide-y divide-border rounded border border-border">
              {churchMembers.map((m) => (
                <li
                  key={m.id}
                  className={
                    "flex flex-wrap items-center justify-between gap-2 px-3 py-2 " +
                    (unmarked.has(m.id) ? "bg-red-50" : "")
                  }
                >
                  <span className="min-w-0 text-sm">{m.name}</span>
                  <span role="radiogroup" aria-label={`Mark ${m.name}`} className="flex gap-1">
                    {MARKS.map(({ value, label }) => {
                      const on = marks[m.id] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setMark(m.id, value)}
                          className={
                            "rounded border px-2 py-0.5 text-xs " +
                            (on
                              ? value === "remove"
                                ? "border-red-700 bg-red-700 text-white"
                                : "border-primary bg-primary text-primary-foreground"
                              : "border-border text-foreground")
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="pt-2 text-base font-semibold text-foreground">
          Add New Members <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </h3>
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
        disabled={submitting || !churchId || loadingMembers || markedCount < churchMembers.length}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Monthly Summary"}
      </button>
      {churchId && !loadingMembers && markedCount < churchMembers.length && (
        <p className="text-xs text-muted-foreground">
          Mark the remaining {churchMembers.length - markedCount} member
          {churchMembers.length - markedCount === 1 ? "" : "s"} to submit.
        </p>
      )}
    </form>
  );
}
