/**
 * Copied / adapted from supabase/packages/ui NavMenu.
 * Copyright (c) Supabase — Apache 2.0 / MIT as upstream.
 */
import { forwardRef, type HTMLAttributes, type PropsWithChildren } from "react";
import { cn } from "./cn";

export const NavMenu = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => {
    return (
      <nav ref={forwardedRef} dir="ltr" {...props} className={cn("border-b border-border", className)}>
        <ul role="menu" className="flex gap-5">
          {children}
        </ul>
      </nav>
    );
  },
);
NavMenu.displayName = "NavMenu";

export const NavMenuItem = forwardRef<
  HTMLLIElement,
  PropsWithChildren<{ className?: string; active: boolean }>
>(({ children, className, active, ...props }, ref) => (
  <li
    ref={ref}
    aria-selected={active ? "true" : "false"}
    data-state={active ? "active" : "inactive"}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground text-foreground-lighter hover:text-foreground data-[state=active]:border-foreground border-b-2 border-transparent *:py-1.5",
      className,
    )}
    {...props}
  >
    {children}
  </li>
));
NavMenuItem.displayName = "NavMenuItem";
