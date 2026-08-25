"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { HubPartnerRow } from "@/lib/hub/db";

/** Searchable, hub-scoped partner list. Search covers name, phone, church. */
export function PartnersTable({ partners }: { partners: HubPartnerRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) =>
      [p.full_name, p.whatsapp_number, p.church ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [partners, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, number, or church"
          className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15 placeholder:text-muted-foreground/60"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one matches “{query.trim()}”.
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded border border-border">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted text-xs font-semibold text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">WhatsApp number</th>
                <th className="px-3 py-2">Church</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="odd:bg-background">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {p.full_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                    {p.whatsapp_number}
                  </td>
                  <td className="px-3 py-2 text-foreground">{p.church ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {p.created_at.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
