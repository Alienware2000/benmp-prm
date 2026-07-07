"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const scenarios = [
  {
    id: "partner-brief",
    label: "Brief me before a call",
    prompt:
      "Prepare me to call Pastor Kwame Mensah about his failed recurring gift.",
    output: {
      title: "Partner briefing prepared",
      summary:
        "Pastor Kwame Mensah is a Ghana monthly partner. His last successful gift was June 2. The July recurring gift failed. He usually responds on WhatsApp and has supported Banjul campaign updates.",
      actions: [
        "Send a gentle WhatsApp note before calling.",
        "Create a finance follow-up task due today.",
        "Avoid language that sounds like a payment demand.",
      ],
    },
  },
  {
    id: "segment-message",
    label: "Draft a WhatsApp update",
    prompt:
      "Draft a warm WhatsApp thank-you for Ghana monthly partners supporting Banjul.",
    output: {
      title: "Message draft ready for review",
      summary:
        "Beloved partner, thank you for standing with the Healing Jesus Campaign in Banjul. Your faithful monthly partnership is helping the gospel reach many lives. We are praying for you and will share the crusade report soon.",
      actions: [
        "Audience: Ghana monthly partners, 3,240 recipients.",
        "Channel: WhatsApp, marketing/template review required.",
        "Staff approval required before queueing.",
      ],
    },
  },
  {
    id: "reconcile",
    label: "Reconcile giving import",
    prompt:
      "Review the latest Paystack export and flag ambiguous donation rows.",
    output: {
      title: "Import review complete",
      summary:
        "42 rows were reviewed. 28 matched confidently to existing partners, 10 are probable matches, and 4 need finance review because phone/email values conflict with existing records.",
      actions: [
        "Accept 28 confident matches.",
        "Review 10 probable matches one-by-one.",
        "Create 4 finance review tasks.",
      ],
    },
  },
];

export function AiCommandCenter() {
  const [selectedId, setSelectedId] = useState(scenarios[0].id);
  const [approved, setApproved] = useState(false);
  const selected = useMemo(
    () =>
      scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0],
    [selectedId],
  );

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            AI operations assistant
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Supervised Workflows
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            The assistant can brief, draft, reconcile, and suggest. Staff still
            approves messages, imports, exports, and data changes.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          Human approval required
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => {
                setSelectedId(scenario.id);
                setApproved(false);
              }}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition",
                scenario.id === selectedId
                  ? "border-primary bg-amber-50 shadow-sm"
                  : "border-border bg-white hover:bg-muted/60",
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {scenario.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {scenario.prompt}
              </p>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                Prompt
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {selected.prompt}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {selected.output.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selected.output.summary}
                </p>
              </div>
              <RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {selected.output.actions.map((action) => (
                <div key={action} className="rounded-lg bg-muted p-3">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {action}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setApproved(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve suggestion
              </button>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-foreground">
                <MessageCircle className="h-4 w-4" />
                Open as draft
              </button>
              {approved ? (
                <span className="inline-flex h-9 items-center rounded-lg bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  Approved in demo queue
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
