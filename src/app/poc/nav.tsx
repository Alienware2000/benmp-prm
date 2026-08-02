export function PocShell({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string;
  subtitle: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6 md:pb-12">
      <section className="flex flex-col gap-4 pb-5 pt-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        </div>
        {toolbar && <div className="flex-none">{toolbar}</div>}
      </section>
      {children}
      <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-border py-4 text-[11px] text-muted-foreground/80">
        <span>Confidential partner records</span>
        <span>BENMP · Healing Jesus Campaign</span>
      </footer>
    </main>
  );
}
