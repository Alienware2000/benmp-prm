import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar text-base font-bold text-white">
            B
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Global Crusade Partners Platform
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the password to continue.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Staff access only. This workspace contains confidential partner records.
        </p>
      </div>
    </main>
  );
}
