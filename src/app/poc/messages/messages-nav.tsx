import Link from "next/link";
import { ListChecks, Send } from "lucide-react";

export type MessageMode = "number" | "partners";

const MODES = [
  {
    key: "number",
    href: "/poc/messages?mode=number",
    label: "Single number",
    Icon: Send,
  },
  {
    key: "partners",
    href: "/poc/messages?mode=partners",
    label: "Choose partners",
    Icon: ListChecks,
  },
] as const;

export function MessagesNav({ current }: { current: MessageMode }) {
  return (
    <nav
      aria-label="Message recipient mode"
      className="mb-4 inline-flex max-w-full rounded-md border border-border bg-surface p-1"
    >
      {MODES.map(({ key, href, label, Icon }) => {
        const active = current === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "inline-flex min-h-9 items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold transition " +
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
