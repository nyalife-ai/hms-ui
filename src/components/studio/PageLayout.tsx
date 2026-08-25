/**
 * Copied / adapted from supabase/apps/studio/components/layouts/PageLayout/PageLayout.tsx
 * Copyright (c) Supabase contributors — Apache-2.0.
 * Adapted for NyaLife HMS App Router (usePathname instead of next/router).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, Button, cn, NavMenu, NavMenuItem } from "@/components/ui-studio";
import { ScaffoldContainer } from "./Scaffold";
import { PageHeader } from "./PageHeader";

export interface NavigationItem {
  id?: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
  badge?: string;
  active?: boolean;
}

interface PageLayoutProps {
  children?: ReactNode;
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
  navigationItems?: NavigationItem[];
  className?: string;
  size?: "default" | "full" | "large" | "small";
  isCompact?: boolean;
}

/**
 * Single-column dashboard page chrome (Studio PageLayout pattern).
 */
export function PageLayout({
  children,
  title,
  subtitle,
  icon,
  breadcrumbs = [],
  primaryActions,
  secondaryActions,
  navigationItems = [],
  className,
  size = "default",
  isCompact = false,
}: PageLayoutProps) {
  const pathname = usePathname();

  return (
    <div className={cn("flex min-h-full w-full flex-col items-stretch", className)}>
      <ScaffoldContainer
        size={size}
        className={cn(
          "mx-auto w-full",
          size === "full" &&
            (isCompact ? "max-w-none border-b px-6 pt-4" : "max-w-none border-b px-10 pt-6"),
          size !== "full" && (isCompact ? "pt-4" : "pt-6"),
          navigationItems.length === 0 && size === "full" && (isCompact ? "pb-4" : "pb-8"),
        )}
      >
        {(title || subtitle || primaryActions || secondaryActions || breadcrumbs.length > 0) && (
          <PageHeader
            title={title}
            subtitle={subtitle}
            icon={icon}
            breadcrumbs={breadcrumbs}
            primaryActions={primaryActions}
            secondaryActions={secondaryActions}
            isCompact={isCompact}
          />
        )}

        {navigationItems.length > 0 && (
          <NavMenu className={cn(isCompact ? "mt-2" : "mt-4", size === "full" && "border-none")}>
            {navigationItems.map((item) => {
              const isActive =
                item.active !== undefined
                  ? item.active
                  : item.href
                    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                    : false;
              return (
                <NavMenuItem key={item.label} active={isActive}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-2",
                        isActive && "text-foreground",
                      )}
                      onClick={item.onClick}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      {item.label}
                      {item.badge && <Badge variant="default">{item.badge}</Badge>}
                    </Link>
                  ) : (
                    <Button
                      variant="link"
                      onClick={item.onClick}
                      className={cn(isActive && "font-medium text-foreground")}
                    >
                      {item.icon && <span className="mr-2">{item.icon}</span>}
                      {item.label}
                      {item.badge && <Badge variant="default">{item.badge}</Badge>}
                    </Button>
                  )}
                </NavMenuItem>
              );
            })}
          </NavMenu>
        )}
      </ScaffoldContainer>

      {children}
    </div>
  );
}
