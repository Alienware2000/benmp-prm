"use client";

import type { ComponentType } from "react";
import {
  Bell,
  BarChart3,
  Bot,
  CircleDollarSign,
  ClipboardList,
  Globe2,
  HeartHandshake,
  MessageCircle,
  Search,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavIconKey, NavItem } from "@/lib/data";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

const navIcons: Record<NavIconKey, Icon> = {
  overview: TrendingUp,
  partners: UsersRound,
  giving: CircleDollarSign,
  reports: BarChart3,
  communication: MessageCircle,
  followUp: ClipboardList,
  campaigns: Globe2,
  prayer: HeartHandshake,
  ai: Bot,
  admin: ShieldCheck,
};

export function DashboardShell({
  navItems,
  children,
}: {
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[244px_1fr]">
        <Sidebar navItems={navItems} />

        <section className="min-w-0">
          <Topbar />
          <MobileNav navItems={navItems} />
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen flex-col bg-sidebar text-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
          <span className="text-sm font-bold">B</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">BENMP PRM</p>
          <p className="truncate text-xs text-white/45">
            Healing Jesus Campaign
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-4">
        <div>
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
            Workspace
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              const IconComponent = navIcons[item.icon];

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                    active
                      ? "bg-white/10 font-medium text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85",
                  )}
                >
                  <IconComponent className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-xs font-semibold text-white">
            Regional coordinator
          </p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Role-aware access, audit logs, and country scoping are planned in
            the data adapter layer.
          </p>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();
  const activeIndex = navItems.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
  );
  const orderedNavItems =
    activeIndex > 0
      ? [
          navItems[activeIndex],
          ...navItems.slice(0, activeIndex),
          ...navItems.slice(activeIndex + 1),
        ]
      : navItems;

  return (
    <nav className="sticky top-16 z-10 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {orderedNavItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          const IconComponent = navIcons[item.icon];

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 transition",
                active
                  ? "bg-sidebar text-white ring-sidebar"
                  : "bg-white text-muted-foreground ring-border hover:text-foreground",
              )}
            >
              <IconComponent className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-sm font-bold text-white lg:hidden"
        >
          B
        </Link>
        <form action="/partners" className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            className="h-10 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
            placeholder="Search partners"
          />
        </form>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </button>
      </div>
    </header>
  );
}
