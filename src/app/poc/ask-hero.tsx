"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Who hasn't given yet?",
  "Biggest gifts this month",
  "Who gave without registering?",
  "Total collected",
];

export function AskHero() {
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
        body: JSON.stringify({ question }),
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
        className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface py-1.5 pl-4 pr-1.5 shadow-[0_1px_3px_rgba(18,45,34,0.05),0_8px_24px_-18px_rgba(18,45,34,0.18)] focus-within:ring-2 focus-within:ring-success/30"
      >
        <Sparkles className="h-4 w-4 flex-none text-success" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about your partners…"
          aria-label="Ask about this month"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="submit"
          disabled={loading || q.trim().length === 0}
          className="h-10 flex-none rounded-xl bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQ(s);
              ask(s);
            }}
            disabled={loading}
            className="rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition hover:bg-success/15 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {(asked || error) && (
        <div className="mt-3.5 rounded-2xl border border-border bg-surface px-4.5 py-4">
          {asked && (
            <p className="mb-2 text-xs text-muted-foreground">
              You asked · <span className="font-semibold text-foreground">{asked}</span>
            </p>
          )}
          {loading && <p className="text-sm text-muted-foreground">Thinking…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {answer && (
            <>
              <p className="max-w-[64ch] text-[14.5px] leading-6 text-foreground">{answer}</p>
              <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                {usedModel
                  ? "Answered by the assistant, grounded to this month's reconciled figures — nothing is estimated."
                  : "Deterministic answer computed from this month's reconciled figures."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
