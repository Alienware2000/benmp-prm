import Link from "next/link";
import { Suspense } from "react";
import { AiAssistant } from "./ai-assistant";
import { WorkspaceNav } from "./workspace-nav";

export default function PocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 px-4 sm:px-6">
          <Link href="/poc" className="flex min-w-0 items-center gap-2.5 py-2">
            <span className="relative grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm">
              B
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-accent" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-foreground">
                BENMP Partners
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                Healing Jesus Campaign
              </span>
            </span>
          </Link>

          <div className="ml-auto flex self-stretch">
            <Suspense fallback={null}>
              <WorkspaceNav />
            </Suspense>
          </div>
          <span className="hidden rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground lg:inline-flex">
            Staff workspace
          </span>
        </div>
      </header>

      {children}

      <Suspense fallback={null}>
        <WorkspaceNav mobile />
      </Suspense>
      <Suspense fallback={null}>
        <AiAssistant />
      </Suspense>
    </div>
  );
}
