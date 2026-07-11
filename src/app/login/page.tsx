import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-success text-[17px] font-bold text-white">
            B
          </div>
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
            Global Crusade Partners Platform
          </h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">Staff sign-in · Qodesh workspace</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5.5 shadow-[0_1px_3px_rgba(18,45,34,0.05),0_10px_30px_-22px_rgba(18,45,34,0.25)] sm:p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground/80">
          <span className="font-semibold text-muted-foreground">Staff access only.</span> This workspace
          contains confidential partner records — please don&apos;t share the link or password outside the
          team.
        </p>
      </div>
    </main>
  );
}
