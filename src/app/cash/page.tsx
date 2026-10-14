// src/app/cash/page.tsx
import { CashForm } from "./cash-form";

export const dynamic = "force-dynamic";

export default function CashPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">
          Monthly Cash Collection Form
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Report your church&apos;s cash collections for the month: select your
          church, upload the giver list, and enter the transaction ID of each
          transfer that sent the cash to BENMP.
        </p>
        <div className="mt-6">
          <CashForm />
        </div>
      </div>
    </div>
  );
}