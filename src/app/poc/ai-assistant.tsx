"use client";

import { Bot, RotateCcw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  usedModel?: boolean;
  groundedIn?: string[];
  periodLabel?: string;
};

const STORAGE_KEY = "benmp-ai-conversation-v1";
const SUGGESTIONS = [
  "How much did we receive in this period?",
  "Who are the top five givers?",
  "How many partners need follow-up?",
  "How do I thank everyone who gave?",
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function savedMessages(): AssistantMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    return Array.isArray(parsed)
      ? (parsed.slice(-20) as AssistantMessage[])
      : [];
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function historyFrom(messages: AssistantMessage[]) {
  const history: Array<{ question: string; answer: string }> = [];
  for (let index = 0; index < messages.length - 1; index += 1) {
    const user = messages[index];
    const assistant = messages[index + 1];
    if (user.role === "user" && assistant.role === "assistant") {
      history.push({ question: user.text, answer: assistant.text });
      index += 1;
    }
  }
  return history.slice(-6);
}

export function AiAssistant() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>(savedMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const periodLabel = useMemo(() => {
    if (from && to) return `${shortDate(from)} to ${shortDate(to)}`;
    if (from) return `From ${shortDate(from)}`;
    if (to) return `Through ${shortDate(to)}`;
    return "All available giving";
  }, [from, to]);

  useEffect(() => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-20)),
    );
  }, [messages]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;

    const userMessage: AssistantMessage = {
      id: newId(),
      role: "user",
      text: trimmed,
    };
    const previousMessages = messages;
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/poc/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          from,
          to,
          history: historyFrom(previousMessages),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: {
          answer?: string;
          usedModel?: boolean;
          groundedIn?: string[];
          periodLabel?: string;
        };
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.ok || !payload.data?.answer) {
        throw new Error(
          payload?.error?.message ??
            "BENMP AI could not answer that question right now.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          text: payload.data?.answer ?? "No answer was returned.",
          usedModel: Boolean(payload.data?.usedModel),
          groundedIn: payload.data?.groundedIn ?? [],
          periodLabel: payload.data?.periodLabel,
        },
      ]);
    } catch (caught) {
      setMessages((current) =>
        current.filter((message) => message.id !== userMessage.id),
      );
      setQuestion(trimmed);
      setError(
        caught instanceof Error
          ? caught.message
          : "BENMP AI could not answer that question right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function clearConversation() {
    setMessages([]);
    setError(null);
    setQuestion("");
    window.sessionStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open BENMP AI"
        title="Ask BENMP AI"
        className="group fixed bottom-[5.25rem] right-4 z-[60] flex items-center gap-2 md:bottom-6 md:right-6"
      >
        <span className="rounded-full border border-brand/20 bg-surface px-3 py-2 text-[11px] font-bold text-brand shadow-lg transition group-hover:-translate-x-0.5 sm:text-xs">
          Ask BENMP AI
        </span>
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-[0_12px_30px_rgba(0,95,112,0.32)] ring-4 ring-white transition group-hover:scale-105 group-focus-visible:outline-none group-focus-visible:ring-accent">
          <Sparkles className="h-6 w-6" aria-hidden />
          <span className="absolute -bottom-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-black leading-none text-accent-foreground ring-2 ring-white">
            AI
          </span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="benmp-ai-title"
            className="flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-[min(760px,calc(100vh-3rem))] sm:max-w-2xl sm:rounded-lg sm:border sm:border-border"
          >
            <header className="flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand text-white">
                <Bot className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id="benmp-ai-title" className="text-sm font-bold">
                    BENMP AI
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Read only
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  Partner records and workspace guidance · {periodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={clearConversation}
                title="Start a new conversation"
                aria-label="Start a new conversation"
                className="grid h-9 w-9 flex-none place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close BENMP AI"
                aria-label="Close BENMP AI"
                className="grid h-9 w-9 flex-none place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-background/60 px-4 py-5 sm:px-6">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center py-8">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                    <Sparkles className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-xl font-bold">
                    What would you like to know?
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Ask about a partner, giving, follow-up groups, or how to use
                    the workspace. Answers are grounded in the records currently
                    loaded into BENMP.
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void ask(suggestion)}
                        className="min-h-14 rounded-md border border-border bg-surface px-3 py-2.5 text-left text-xs font-semibold leading-5 transition hover:border-brand/30 hover:bg-brand/5"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-xl space-y-4">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={
                        message.role === "user"
                          ? "ml-auto max-w-[88%] rounded-lg rounded-br-sm bg-brand px-4 py-3 text-sm leading-6 text-white"
                          : "mr-auto max-w-[94%] rounded-lg rounded-bl-sm border border-border bg-surface px-4 py-3 text-sm leading-6 text-foreground shadow-sm"
                      }
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      {message.role === "assistant" &&
                        message.groundedIn &&
                        message.groundedIn.length > 0 && (
                          <p className="mt-3 border-t border-border pt-2 text-[10px] leading-4 text-muted-foreground">
                            {message.periodLabel && `${message.periodLabel} · `}
                            Grounded in {message.groundedIn.join(", ")}.
                          </p>
                        )}
                    </article>
                  ))}
                  {loading && (
                    <div
                      role="status"
                      className="mr-auto flex max-w-[94%] items-center gap-2 rounded-lg rounded-bl-sm border border-border bg-surface px-4 py-3 text-sm text-muted-foreground shadow-sm"
                    >
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                      Checking BENMP records…
                    </div>
                  )}
                  {error && (
                    <div
                      role="alert"
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-900"
                    >
                      <b className="block">BENMP AI could not answer</b>
                      {error} Your question is still available below.
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <footer className="border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
              <form
                onSubmit={submit}
                className="mx-auto flex max-w-xl items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10"
              >
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (question.trim() && !loading) void ask(question);
                    }
                  }}
                  maxLength={1_000}
                  rows={2}
                  placeholder="Ask about partners, giving, or the workspace…"
                  aria-label="Ask BENMP AI"
                  className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={loading || question.trim().length === 0}
                  title="Send question"
                  aria-label="Send question"
                  className="grid h-11 w-11 flex-none place-items-center rounded-md bg-brand text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </form>
              <p className="mx-auto mt-2 flex max-w-xl items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Answers use BENMP records. Review important decisions with
                staff.
              </p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
