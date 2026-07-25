"use client";

import {
  AlertCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

type FeedbackTone = "error" | "warning" | "info";

type FeedbackAction = {
  label: string;
  onClick: () => void;
};

const toneStyles: Record<
  FeedbackTone,
  {
    border: string;
    background: string;
    text: string;
    secondary: string;
    icon: string;
    button: string;
    Icon: LucideIcon;
  }
> = {
  error: {
    border: "border-red-300",
    background: "bg-red-50",
    text: "text-red-950",
    secondary: "text-red-900/80",
    icon: "text-red-700",
    button: "border-red-300 text-red-950 hover:bg-red-100",
    Icon: AlertCircle,
  },
  warning: {
    border: "border-amber-300",
    background: "bg-amber-50",
    text: "text-amber-950",
    secondary: "text-amber-900/80",
    icon: "text-amber-700",
    button: "border-amber-400 text-amber-950 hover:bg-amber-100",
    Icon: AlertTriangle,
  },
  info: {
    border: "border-sky-300",
    background: "bg-sky-50",
    text: "text-sky-950",
    secondary: "text-sky-900/80",
    icon: "text-sky-700",
    button: "border-sky-300 text-sky-950 hover:bg-sky-100",
    Icon: Info,
  },
};

export function FeedbackNotice({
  tone,
  title,
  children,
  supportingText,
  action,
  onDismiss,
  className = "",
}: {
  tone: FeedbackTone;
  title: string;
  children: ReactNode;
  supportingText?: ReactNode;
  action?: FeedbackAction;
  onDismiss?: () => void;
  className?: string;
}) {
  const styles = toneStyles[tone];
  const Icon = styles.Icon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-2.5 rounded-md border px-3 py-3 ${styles.border} ${styles.background} ${styles.text} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-none ${styles.icon}`} aria-hidden />
      <div className="min-w-0 flex-1 text-xs leading-5">
        <p className="font-semibold">{title}</p>
        <div className={`mt-0.5 ${styles.secondary}`}>{children}</div>
        {supportingText && (
          <div className="mt-1 font-medium">{supportingText}</div>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={`mt-2 inline-flex min-h-8 items-center rounded-md border bg-white px-2.5 py-1 text-xs font-semibold transition ${styles.button}`}
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss"
          className={`grid h-7 w-7 flex-none place-items-center rounded-md transition ${styles.secondary} hover:bg-black/5`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
