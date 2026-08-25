/**
 * Copied / adapted from supabase/packages/ui shadcn Badge (simplified).
 * Copyright (c) Supabase — Apache 2.0 / MIT as upstream.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

const variants = {
  default: "bg-surface-200 text-foreground border border-border",
  brand: "bg-brand-100 text-brand-700 border border-brand-200",
  secondary: "bg-accent-100 text-accent-700 border border-accent-200",
  outline: "bg-transparent text-foreground-light border border-border",
} as const;

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
