"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, Send, WandSparkles } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

const segments = [
  {
    name: "Ghana monthly partners",
    count: 3240,
    channel: "WhatsApp",
    purpose: "Monthly appreciation",
  },
  {
    name: "Missed 60 days",
    count: 428,
    channel: "SMS",
    purpose: "Gentle follow-up",
  },
  {
    name: "Major partners",
    count: 94,
    channel: "Email",
    purpose: "Campaign report",
  },
];

const drafts: Record<string, string> = {
  "Ghana monthly partners":
    "Beloved partner, thank you for standing with the Healing Jesus Campaign in Banjul. Your faithful monthly partnership is helping the gospel reach many lives. We are praying for you and will share the crusade report soon.",
  "Missed 60 days":
    "Beloved partner, we are grateful for your past support of the Healing Jesus Campaign. We wanted to check in gently and let you know we are praying for you. If you would like help renewing your partnership, our team is available.",
  "Major partners":
    "Dear partner, thank you for your generous support. Attached is a concise report on the Banjul campaign, including giving impact, testimonies, and upcoming opportunities to support the next crusade.",
};

export function CommunicationStudio() {
  const [selectedSegment, setSelectedSegment] = useState(segments[0].name);
  const [status, setStatus] = useState<"Draft" | "Review" | "Queued">("Draft");
  const selected =
    segments.find((segment) => segment.name === selectedSegment) ?? segments[0];
  const message = useMemo(() => drafts[selected.name], [selected.name]);

  return (
    <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Segment builder
        </p>
        <h2 className="mt-1 text-base font-semibold text-foreground">
          Select Audience
        </h2>
        <div className="mt-4 space-y-2">
          {segments.map((segment) => (
            <button
              key={segment.name}
              onClick={() => {
                setSelectedSegment(segment.name);
                setStatus("Draft");
              }}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition",
                selected.name === segment.name
                  ? "border-primary bg-amber-50"
                  : "border-border bg-white hover:bg-muted/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {segment.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {segment.purpose}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {segment.count.toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Preferred channel: {segment.channel}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              AI draft with approval
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {selected.purpose}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.count.toLocaleString()} recipients through{" "}
              {selected.channel}
            </p>
          </div>
          <StatusBadge label={status} />
        </div>

        <div className="mt-4 rounded-lg bg-muted p-4">
          <div className="mb-3 flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Suggested message
            </p>
          </div>
          <textarea
            value={message}
            readOnly
            className="min-h-[170px] w-full resize-none rounded-lg border border-border bg-white p-3 text-sm leading-6 text-foreground outline-none"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <PolicyCard
            title="Consent check"
            detail="Opt-outs removed before send."
          />
          <PolicyCard
            title="Template check"
            detail="WhatsApp category reviewed."
          />
          <PolicyCard
            title="Staff approval"
            detail="No outbound send is automatic."
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setStatus("Review")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold"
          >
            <MessageCircle className="h-4 w-4" />
            Send to review
          </button>
          <button
            onClick={() => setStatus("Queued")}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve queue
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold">
            <Send className="h-4 w-4" />
            Adapter preview
          </button>
        </div>
      </div>
    </section>
  );
}

function PolicyCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
