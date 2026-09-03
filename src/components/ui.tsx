/**
 * HMS UI primitives — Studio-hardened surface density.
 * Visual language aligned with supabase/packages/ui shadcn Card/Table
 * (rounded-lg, surface borders, mono section titles, tight tables).
 */
"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader as StudioPageHeader } from "@/components/studio";
import { cn } from "@/components/ui-studio";

const BADGE_TONES = {
  teal: "bg-accent-100 text-accent-700 border-accent-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-600 border-rose-200",
  slate: "bg-surface-200 text-foreground-light border-border",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Studio Card: rounded-lg, hairline border, quiet shadow. */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-100 text-foreground shadow-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Studio-style card section header (mono uppercase label). */
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
      <div className="min-w-0 space-y-0.5">
        <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-foreground">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-foreground-lighter">{subtitle}</p>}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Compact Studio metric tile. */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  down = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  down?: boolean;
  icon: LucideIcon;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-foreground-lighter">
            {label}
          </p>
          <p className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      {delta && (
        <div
          className={cn(
            "mx-4 mb-4 mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
            down ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-700",
          )}
        >
          {down ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          <span>
            {delta}
            {deltaLabel ? (
              <span className="font-normal text-foreground-light"> {deltaLabel}</span>
            ) : null}
          </span>
        </div>
      )}
      {!delta && deltaLabel && (
        <div className="mx-4 mb-4 mt-3 rounded-md bg-surface-200 px-2.5 py-1.5 text-xs text-foreground-light">
          {deltaLabel}
        </div>
      )}
      {!delta && !deltaLabel && <div className="h-4" />}
    </Card>
  );
}

/**
 * Back-compat HMS PageHeader → Studio PageHeader chrome.
 * Every module page that still imports PageHeader from ui.tsx gets Studio title density.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <StudioPageHeader
      title={title}
      subtitle={subtitle}
      primaryActions={action}
      className="mb-6 border-b border-border pb-5"
    />
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-500 px-3.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Studio-tight table: meta headers, hairline rows, surface hover. */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] caption-bottom border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-200">
            {headers.map((h) => (
              <th
                key={h}
                className="h-10 whitespace-nowrap px-4 text-left align-middle font-mono text-[10px] font-medium uppercase tracking-wider text-foreground-lighter"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-border [&_tr:hover]:bg-surface-200 [&_tr:last-child]:border-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Standard row cell padding for use inside <Table>. */
export const cell = "px-4 py-3 align-middle whitespace-nowrap text-foreground";

export function StatCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-surface-200" />
          <div className="h-7 w-14 animate-pulse rounded bg-surface-200" />
        </div>
        <div className="h-8 w-8 animate-pulse rounded-md bg-surface-200" />
      </div>
      <div className="mx-4 mb-4 mt-3 h-7 animate-pulse rounded-md bg-surface-200" />
    </Card>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .filter((p) => /^[A-Za-z]/.test(p) && p !== "Dr.")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const sizeClass =
    size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-16 w-16 text-lg" : "h-9 w-9 text-xs";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-brand-100 font-semibold text-brand-700",
        sizeClass,
      )}
    >
      {initials}
    </span>
  );
}
