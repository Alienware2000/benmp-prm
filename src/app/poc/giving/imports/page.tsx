import { ImportsClient } from "./imports-client";

export const dynamic = "force-dynamic";

export default function ImportsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">Upload History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit trail of all uploaded payment statements.
        </p>
        <div className="mt-6">
          <ImportsClient />
        </div>
      </div>
    </div>
  );
}