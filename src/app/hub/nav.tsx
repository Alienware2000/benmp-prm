"use client";

import { FileUp, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hub", label: "Upload", icon: FileUp },
  { href: "/hub/partners", label: "Your partners", icon: Users },
  { href: "/hub/settings", label: "Settings", icon: Settings },
] as const;

export function HubNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-4 sm:px-6">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex flex-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition " +
                (active
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
