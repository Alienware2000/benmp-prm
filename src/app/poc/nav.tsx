import Link from "next/link";

/**
 * Workspace nav. Every destination lives under /poc because src/proxy.ts collapses
 * everything outside /poc and /api/poc to the console — staying inside that prefix means
 * these pages inherit the password gate rather than punching a hole in it.
 */
const TABS = [
  { href: "/poc", label: "Console" },
  { href: "/poc/directory", label: "Partner directory" },
  { href: "/poc/giving", label: "Giving" },
  { href: "/poc/messages", label: "Messages" },
] as const;

export type PocTab = (typeof TABS)[number]["href"];

export function PocNav({ current }: { current: PocTab }) {
  return (
    <nav
      className="overflow-x-auto border-b border-border bg-surface px-3 sm:px-5"
      aria-label="Workspace sections"
    >
      <div className="mx-auto flex w-full min-w-max max-w-4xl gap-1">
        {TABS.map((t) => {
          const active = t.href === current;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={
                "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition " +
                (active
                  ? "border-success text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Shared page chrome for the two secondary pages (the console has its own richer header). */
export function PocShell({
  current,
  title,
  subtitle,
  children,
}: {
  current: PocTab;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-14 text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-5">
          <Link
            href="/poc"
            className="flex items-center gap-2.5 text-sm font-semibold"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-success text-[13px] font-bold text-white">
              B
            </span>
            Global Crusade Partners
          </Link>
        </div>
      </header>
      <PocNav current={current} />

      <main className="mx-auto max-w-4xl px-5">
        <section className="pt-7">
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </section>
        {children}
        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground/80">
          <span>Staff workspace · confidential partner records</span>
          <span>BENMP · Healing Jesus Campaign</span>
        </footer>
      </main>
    </div>
  );
}
