import { SummaryClient } from "./summary-client";

export const dynamic = "force-dynamic";

export default function ExecutiveSummaryPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Executive Summary</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Total giving, USD conversion, and active partner count. Exportable for leadership reports.
        </p>
        <div className="mt-6">
          <SummaryClient />
        </div>
      </div>
    </div>
  );
}