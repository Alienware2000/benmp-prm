"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CalendarClock,
  MessageCircle,
  Search,
  UserRound,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

const partners = [
  {
    name: "Ama Serwaa",
    country: "Ghana",
    city: "Accra",
    contact: "WhatsApp",
    level: "Monthly",
    status: "Active",
    lifetime: "$4,820",
    lastGift: "Jul 2, 2026",
    notes:
      "Faithful monthly partner. Prefers short WhatsApp updates and testimony reports.",
    prayer: "Praying for her children's education and family health.",
  },
  {
    name: "Daniel Okafor",
    country: "Nigeria",
    city: "Lagos",
    contact: "Email",
    level: "Major",
    status: "Active",
    lifetime: "$28,500",
    lastGift: "Jun 28, 2026",
    notes:
      "Major partner. Responds well to detailed crusade reports and financial clarity.",
    prayer: "Asked for wisdom around a business expansion.",
  },
  {
    name: "Marie N'Guessan",
    country: "Cote d'Ivoire",
    city: "Abidjan",
    contact: "SMS",
    level: "Quarterly",
    status: "Missed",
    lifetime: "$1,260",
    lastGift: "Apr 20, 2026",
    notes:
      "Quarterly partner who may need a gentle check-in. Mobile number is strongest contact.",
    prayer: "Requested prayer for her mother.",
  },
  {
    name: "Samuel Tetteh",
    country: "United States",
    city: "Dallas",
    contact: "Phone",
    level: "Prayer",
    status: "New",
    lifetime: "$600",
    lastGift: "Jun 12, 2026",
    notes: "New partner. Needs welcome call and orientation to monthly giving.",
    prayer: "Asked for direction about joining the prayer partner team.",
  },
  {
    name: "Angela Boateng",
    country: "United Kingdom",
    city: "London",
    contact: "Email",
    level: "Monthly",
    status: "Active",
    lifetime: "$3,140",
    lastGift: "Jul 1, 2026",
    notes:
      "Monthly partner. Current prayer request is awaiting response from prayer team.",
    prayer: "Family healing and encouragement.",
  },
];

const filters = ["All", "Monthly", "Major", "Missed", "New"];

export function PartnerIntelligence() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedName, setSelectedName] = useState(partners[0].name);
  const selected =
    partners.find((partner) => partner.name === selectedName) ?? partners[0];

  const visible = useMemo(() => {
    const normalized = query.toLowerCase();
    return partners.filter((partner) => {
      const matchesFilter =
        filter === "All" ||
        partner.level === filter ||
        partner.status === filter;
      const matchesQuery =
        !normalized ||
        [
          partner.name,
          partner.country,
          partner.city,
          partner.contact,
          partner.level,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Search and segment
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Partner Intelligence
            </h2>
          </div>
          <div className="relative min-w-0 md:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
              placeholder="Search name, country, channel"
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition",
                filter === item
                  ? "bg-sidebar text-white ring-sidebar"
                  : "bg-white text-muted-foreground ring-border hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {visible.map((partner) => (
            <button
              key={partner.name}
              onClick={() => setSelectedName(partner.name)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition",
                selected.name === partner.name
                  ? "border-primary bg-amber-50"
                  : "border-border bg-white hover:bg-muted/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {partner.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {partner.city}, {partner.country} - {partner.contact}
                    </p>
                  </div>
                </div>
                <StatusBadge label={partner.status} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Selected partner
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {selected.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.city}, {selected.country}
            </p>
          </div>
          <StatusBadge label={selected.status} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="Partnership" value={selected.level} />
          <Info label="Lifetime giving" value={selected.lifetime} />
          <Info label="Last gift" value={selected.lastGift} />
          <Info label="Preferred contact" value={selected.contact} />
        </div>

        <div className="mt-5 rounded-lg bg-muted p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              AI call brief
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {selected.notes} Mention the last gift on {selected.lastGift}, ask
            about the prayer request, and use {selected.contact} for the first
            touch.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Prayer and care note
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {selected.prayer}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
            <MessageCircle className="h-4 w-4" />
            Draft follow-up
          </button>
          <button className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold">
            Create task
          </button>
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
