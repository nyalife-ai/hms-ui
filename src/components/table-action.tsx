"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

type ActionTone = "neutral" | "edit" | "add" | "danger";

const TONE: Record<ActionTone, string> = {
  neutral: "text-slate-500 hover:text-slate-800",
  edit: "text-sky-600 hover:text-sky-700",
  add: "text-emerald-600 hover:text-emerald-700",
  danger: "text-rose-600 hover:text-rose-700",
};

/** Compact icon action for tables — no colored background; tooltip via title. */
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-40 ${TONE[tone]}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </button>
  );
}
