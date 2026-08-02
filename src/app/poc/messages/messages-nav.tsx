import Link from "next/link";
import { Send, UsersRound } from "lucide-react";

export type MessageMode = "partners" | "number";

const MODES = [
  {
    key: "partners",
    href: "/poc/messages",
    label: "Partner messages",
    Icon: UsersRound,
  },
  {
    key: "number",
    href: "/poc/messages?mode=number",
    label: "One person",
    Icon: Send,
  },
] as const;

export function MessagesNav({ current }: { current: MessageMode }) {
  return (
    <nav
      aria-label="Message recipient mode"
      className="mb-4 grid w-full grid-cols-2 rounded-md border border-border bg-surface p-1 sm:inline-grid sm:w-auto"
    >
      {MODES.map(({ key, href, label, Icon }) => {
        const active = current === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm " +
              (active
                ? "bg-success text-white"
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
