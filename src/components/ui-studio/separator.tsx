/**
 * Copied / adapted from supabase/packages/ui shadcn Separator (simplified).
 * Copyright (c) Supabase — Apache 2.0 / MIT as upstream.
 */
import { cn } from "./cn";

export function Separator({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
