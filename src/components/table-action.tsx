"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

type ActionTone = "neutral" | "edit" | "add" | "danger";

const TONE: Record<ActionTone, string> = {
  neutral: "text-foreground-light hover:bg-surface-200 hover:text-foreground",
  edit: "text-sky-600 hover:bg-sky-50 hover:text-sky-700",
  add: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
  danger: "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
};

/** Compact icon action for tables — Studio density (rounded-md, quiet hover). */
export function TableAction({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  tone?: ActionTone;
  disabled?: boolean;
  loading?: boolean;
}) {
  const busy = Boolean(loading || disabled);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40 ${TONE[tone]}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
