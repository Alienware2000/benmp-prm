"use client";

import Link from "next/link";
import { Send, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";

export type MessageMode = "partners" | "number";

const MODES = [
  {
    key: "partners",
    path: "/poc/messages",
    label: "Partner messages",
    Icon: UsersRound,
  },
  {
    key: "number",
    path: "/poc/messages",
    mode: "number",
    label: "One person",
    Icon: Send,
  },
] as const;

export function MessagesNav({ current }: { current: MessageMode }) {
  const searchParams = useSearchParams();

  return (
    <nav
      aria-label="Message recipient mode"
      className="mb-4 grid w-full grid-cols-2 rounded-md border border-border bg-surface p-1 sm:inline-grid sm:w-auto"
    >
      {MODES.map((item) => {
        const { key, path, label, Icon } = item;
        const mode = "mode" in item ? item.mode : undefined;
        const active = current === key;
        const params = new URLSearchParams();
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (mode) params.set("mode", mode);
        const query = params.toString();
        const href = query ? `${path}?${query}` : path;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm " +
              (active
                ? "bg-brand text-white"
                : "text-muted-foreground hover:bg-background hover:text-foreground")
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
