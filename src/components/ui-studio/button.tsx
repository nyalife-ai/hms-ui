/**
 * Copied / adapted from supabase/packages/ui Button (simplified variants for HMS).
 * Copyright (c) Supabase — Apache 2.0 / MIT as upstream.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const variants = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 shadow-sm border border-transparent",
  default:
    "bg-surface-100 text-foreground border border-border hover:bg-surface-200",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-surface-100",
  link: "bg-transparent text-foreground-light hover:text-foreground border-transparent underline-offset-4 hover:underline px-0",
  danger: "bg-rose-500 text-white hover:bg-rose-600 border border-transparent",
} as const;

const sizes = {
  tiny: "h-7 px-2.5 text-xs rounded-md",
  small: "h-8 px-3 text-sm rounded-md",
  medium: "h-9 px-3.5 text-sm rounded-lg",
  large: "h-10 px-4 text-sm rounded-lg",
} as const;

export function Button({
  children,
  className,
  variant = "primary",
  size = "medium",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
