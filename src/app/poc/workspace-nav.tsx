"use client";

import {
  HandCoins,
  LayoutDashboard,
  MessageCircleMore,
  PhoneCall,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/poc", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/poc/giving", label: "Giving", Icon: HandCoins },
  { href: "/poc/messages", label: "Messages", Icon: MessageCircleMore },
  { href: "/poc/calls", label: "Calls", Icon: PhoneCall },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/poc" ? pathname === href : pathname.startsWith(href);
}

export function WorkspaceNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const hrefFor = (href: string) => {
    if (!from && !to) return href;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `${href}?${params.toString()}`;
  };

  if (mobile) {
    return (
      <nav
        aria-label="Workspace sections"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(17,24,39,0.08)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={hrefFor(href)}
                prefetch
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors " +
                  (active
                    ? "text-brand"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <span
                  className={
                    "grid h-7 w-10 place-items-center rounded-full transition-colors " +
                    (active ? "bg-accent/25" : "bg-transparent")
                  }
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Workspace sections"
      className="hidden items-stretch self-stretch md:flex"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={hrefFor(href)}
            prefetch
            aria-current={active ? "page" : undefined}
            className={
              "relative flex min-h-16 items-center gap-2 px-4 text-sm font-semibold transition-colors " +
              (active
                ? "text-brand"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {active && (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
