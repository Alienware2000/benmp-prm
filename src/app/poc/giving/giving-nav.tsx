import Link from "next/link";

const VIEWS = [
  { href: "/poc/giving", id: "ledger", label: "Giving ledger" },
  {
    href: "/poc/giving/test",
    id: "test",
    label: "Test acknowledgement",
  },
] as const;

export function GivingNav({ current }: { current: "ledger" | "test" }) {
  return (
    <nav
      aria-label="Giving views"
      className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {VIEWS.map((view) => (
        <Link
          key={view.id}
          href={view.href}
          aria-current={view.id === current ? "page" : undefined}
          className={
            "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
            (view.id === current
              ? "bg-success text-white"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}
