import { ByChurchClient } from "./by-church-client";

export const dynamic = "force-dynamic";

export default function ByChurchPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground">Money by Church</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Total giving per church, broken down by payment method, rolling up to
          hub, country, and region.
        </p>
        <div className="mt-6">
          <ByChurchClient />
        </div>
      </div>
    </div>
  );
}