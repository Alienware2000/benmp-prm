import type { ComponentType } from "react";
import { Download, FileUp, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      {children ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DefaultHeaderActions() {
  return (
    <>
      <ActionButton icon={FileUp}>Import</ActionButton>
      <ActionButton icon={Download}>Export</ActionButton>
      <ActionButton icon={Plus} primary>
        New Partner
      </ActionButton>
    </>
  );
}

export function ActionButton({
  children,
  icon: IconComponent,
  primary = false,
  href,
}: {
  children: React.ReactNode;
  icon: Icon;
  primary?: boolean;
  href?: string;
}) {
  const className = cn(
    "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition",
    primary
      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
      : "border-border bg-white text-foreground hover:bg-muted",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        <IconComponent className="h-4 w-4" />
        {children}
      </Link>
    );
  }

  return (
    <button className={className}>
      <IconComponent className="h-4 w-4" />
      {children}
    </button>
  );
}
