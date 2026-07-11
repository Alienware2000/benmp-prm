"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "How much did we collect this period?",
  "Who paid but isn't on the register?",
  "How many registered members haven't paid yet?",
];

export function PocAsk() {
  const [q, setQ] = useState(SUGGESTIONS[0]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState(false);
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    setLoading(true);
    setAnswer(null);
    try {
      const r = await fetch("/api/poc/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const j = await r.json();
      setAnswer(j.ok ? j.data.answer : (j.error?.message ?? "Something went wrong."));
      setUsedModel(Boolean(j?.data?.usedModel));
    } catch {
      setAnswer("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about this period…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQ(s);
              ask(s);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm leading-6 text-foreground">{answer}</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {usedModel ? "Answered by Gemini (grounded in the figures)" : "Deterministic answer (no model)"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
