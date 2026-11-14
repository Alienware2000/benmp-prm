// src/app/cash/page.tsx
import { CashForm } from "./cash-form";

export const dynamic = "force-dynamic";

export default function CashPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">
          Monthly Summary Form
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each church&apos;s report for the month: select your church, fill in
          the monthly summary, and add any new members. Churches in Ghana can
          also report the month&apos;s cash giving.
        </p>
        <div className="mt-6">
          <CashForm />
        </div>
      </div>
    </div>
  );
}