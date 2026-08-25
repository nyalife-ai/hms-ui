/**
 * Copied / adapted from supabase/apps/studio/components/layouts/PageLayout/PageHeader.tsx
 * Copyright (c) Supabase contributors — Apache-2.0.
 * Adapted for NyaLife HMS (App Router); Breadcrumb deps simplified.
 */
"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui-studio";
import { ScaffoldDescription, ScaffoldTitle } from "./Scaffold";

interface PageHeaderProps {
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  icon?: ReactNode;
  breadcrumbs?: Array<{
    label?: string;
    href?: string;
    element?: ReactNode;
  }>;
  primaryActions?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
  isCompact?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  breadcrumbs = [],
  primaryActions,
  secondaryActions,
  className,
  isCompact = false,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {(breadcrumbs.length > 0 ||
        (isCompact && (title || primaryActions || secondaryActions))) && (
        <div className={cn("flex items-center gap-4", isCompact ? "justify-between" : "mb-4")}>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {breadcrumbs.length > 0 ? (
              <nav
                aria-label="Breadcrumb"
                className={cn("min-w-0 flex-1 text-foreground-muted", isCompact && "text-base")}
              >
                <ol className={cn("flex min-w-0 flex-wrap items-center gap-1.5", isCompact ? "text-base" : "text-xs")}>
                  {breadcrumbs.map((item, index) => (
                    <Fragment key={item.label || `breadcrumb-${index}`}>
                      <li className="inline-flex items-center gap-1.5">
                        {item.element ? (
                          item.element
                        ) : item.href ? (
                          <Link
                            href={item.href}
                            className="inline-flex items-center gap-2 text-foreground-light transition hover:text-foreground"
                          >
                            {breadcrumbs.length === 1 && !isCompact && (
                              <ChevronLeft size={16} strokeWidth={1.5} />
                            )}
                            {item.label}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-foreground">
                            {breadcrumbs.length === 1 && (
                              <ChevronLeft size={16} strokeWidth={1.5} />
                            )}
                            {item.label}
                          </span>
                        )}
                      </li>
                      {index < breadcrumbs.length - 1 && (
                        <li aria-hidden className="text-foreground-muted">
                          /
                        </li>
                      )}
                    </Fragment>
                  ))}
                  {isCompact && title && (
                    <>
                      <li aria-hidden className="text-foreground-muted">
                        /
                      </li>
                      <li className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</li>
                    </>
                  )}
                </ol>
              </nav>
            ) : isCompact ? (
              <div className="min-w-0 flex-1">{title}</div>
            ) : null}
          </div>
          {isCompact && (
            <div className="flex shrink-0 items-center gap-2">
              {secondaryActions && (
                <div className="flex items-center gap-2">{secondaryActions}</div>
              )}
              {primaryActions && <div className="flex items-center gap-2">{primaryActions}</div>}
            </div>
          )}
        </div>
      )}

      {!isCompact && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {icon && <div className="text-foreground-light">{icon}</div>}
              <div className="space-y-1">
                {title &&
                  (typeof title === "string" ? <ScaffoldTitle>{title}</ScaffoldTitle> : title)}
                {subtitle &&
                  (typeof subtitle === "string" ? (
                    <ScaffoldDescription>{subtitle}</ScaffoldDescription>
                  ) : (
                    subtitle
                  ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {secondaryActions && <div className="flex items-center gap-2">{secondaryActions}</div>}
            {primaryActions && <div className="flex items-center gap-2">{primaryActions}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
