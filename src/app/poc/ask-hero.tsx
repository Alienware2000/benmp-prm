"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { FeedbackNotice } from "@/components/feedback-notice";

const SUGGESTIONS = [
  "Who hasn't given yet?",
  "Biggest recorded gifts",
  "Who gave without registering?",
  "Total collected",
];

export function AskHero({
  from = "",
  to = "",
  compact = false,
}: {
  from?: string;
  to?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    setLoading(true);
    setError(null);
    setAsked(question);
    setAnswer(null);
    try {
      const r = await fetch("/api/poc/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, from, to }),
      });
      const j = await r.json();
      if (j.ok) {
        setAnswer(j.data.answer);
        setUsedModel(Boolean(j.data.usedModel));
      } else {
        setError(j.error?.message ?? "Something went wrong — try again.");
      }
    } catch {
      setError("Could not reach the server — try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim() && !loading) ask(q.trim());
  }

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2.5 rounded-lg border border-border bg-background py-1.5 pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-brand/20"
      >
        <Sparkles className="h-4 w-4 flex-none text-success" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about giving…"
          aria-label="Ask about loaded giving records"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="submit"
          disabled={loading || q.trim().length === 0}
          className="h-10 flex-none rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-45"
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.slice(0, compact ? 2 : SUGGESTIONS.length).map((s) => (
          <button
            key={s}
            onClick={() => {
              setQ(s);
              ask(s);
            }}
            disabled={loading}
            className="rounded-full border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {(asked || error) && (
        <div className="mt-3.5 rounded-lg border border-border bg-background p-4">
          {asked && (
            <p className="mb-2 text-xs text-muted-foreground">
              You asked ·{" "}
              <span className="font-semibold text-foreground">{asked}</span>
            </p>
          )}
          {loading && (
            <p className="text-sm text-muted-foreground">Thinking…</p>
          )}
          {error && (
            <FeedbackNotice
              tone="error"
              title="The assistant could not answer"
              supportingText="Your question is still here. You can edit it or try again."
              onDismiss={() => setError(null)}
            >
              {error}
            </FeedbackNotice>
          )}
          {answer && (
            <>
              <p className="max-w-[64ch] text-[14.5px] leading-6 text-foreground">
                {answer}
              </p>
              <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                {usedModel
                  ? "Answered by the assistant, grounded to the loaded giving records — nothing is estimated."
                  : "Deterministic answer computed from the loaded giving records."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
