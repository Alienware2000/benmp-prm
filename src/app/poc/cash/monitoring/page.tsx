import { CashMonitoringClient } from "./monitoring-client";

export const dynamic = "force-dynamic";

export default function CashMonitoringPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">Cash Form Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track which churches have filed their monthly cash collection form.
        </p>
        <div className="mt-6">
          <CashMonitoringClient />
        </div>
      </div>
    </div>
  );
}