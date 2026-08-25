"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className = "",
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center ${className}`}
    >
      <Icon className="mb-3 h-9 w-9 text-foreground-muted" aria-hidden strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-foreground-lighter">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
