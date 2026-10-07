import { PartnersByChurchClient } from "./by-church-client";

export const dynamic = "force-dynamic";

export default function PartnersByChurchPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground">Partners by Church</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partner counts per church, broken down by status, rolling up to hub, country, and region.
        </p>
        <div className="mt-6">
          <PartnersByChurchClient />
        </div>
      </div>
    </div>
  );
}