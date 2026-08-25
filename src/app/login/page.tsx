import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm">
              B
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-accent" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-foreground">
                BENMP Partners
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Healing Jesus Campaign
              </span>
            </span>
          </div>
        </div>
      </header>

      <section className="grid flex-1 place-items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="w-full max-w-[440px]">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
              Staff access
            </span>
            <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-[28px]">
              Sign in to BENMP Partners
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Office staff use the shared password. Hub leaders sign in with
              their hub number.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_12px_36px_rgba(23,33,38,0.08)]">
            <div className="h-1 bg-accent" />
            <div className="p-5 sm:p-6">
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>
            <div className="flex items-start gap-2.5 border-t border-border bg-background px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-6">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 flex-none text-success"
                aria-hidden
              />
              <p>Confidential partner records. Staff access only.</p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground/80">
            BENMP · Healing Jesus Campaign
          </p>
        </div>
      </section>
    </main>
  );
}
