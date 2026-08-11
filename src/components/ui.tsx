import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const BADGE_TONES = {
  teal: "bg-accent-100 text-accent-700",
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-500",
  slate: "bg-slate-100 text-slate-500",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-white shadow-[0_1px_3px_rgba(23,40,46,0.05)] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 pt-5 pb-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Medlink-style stat card: label, dark icon tile, big value, delta strip. */
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
    <Card className="flex flex-col p-2.5">
      <div className="flex items-start justify-between px-2.5 pt-2.5">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-[26px] font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {delta && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${down ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-700"}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${down ? "bg-rose-100" : "bg-brand-100"}`}>
            {down ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          </span>
          {delta} {deltaLabel && <span className="font-normal opacity-80">{deltaLabel}</span>}
        </div>
      )}
      {!delta && deltaLabel && (
        <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          <span className="font-normal opacity-80">{deltaLabel}</span>
        </div>
      )}
    </Card>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/50 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
    >
      {children}
    </button>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`sticky top-0 bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700/70 ${i === 0 ? "rounded-l-xl" : ""} ${i === headers.length - 1 ? "rounded-r-xl" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:nth-child(even)]:bg-brand-50/50 [&_tr:nth-child(odd)]:bg-white [&_td]:border-b [&_td]:border-brand-50">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Standard row cell padding for use inside <Table>. */
export const cell = "px-4 py-2.5 whitespace-nowrap";

/** Shimmer placeholder matching StatCard layout. */
export function StatCardSkeleton() {
  return (
    <Card className="flex flex-col p-2.5">
      <div className="flex items-start justify-between px-2.5 pt-2.5">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="mt-3 h-8 animate-pulse rounded-xl bg-slate-50" />
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
    size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-20 w-20 text-xl" : "h-10 w-10 text-sm";
  return (
    <span className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700`}>
      {initials}
    </span>
  );
}
