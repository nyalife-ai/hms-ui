/**
 * Copied / adapted from supabase/packages/ui-patterns/src/ThemeToggle.tsx
 * Copyright (c) Supabase contributors — Apache-2.0.
 * Uses next-themes (same as Studio); dropdown chrome matched to HMS topbar.
 */
"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui-studio";
import { singleThemes } from "@/lib/single-themes";

const THEME_ICONS = {
  system: Monitor,
  dark: Moon,
  light: Sun,
} as const;

interface ThemeToggleProps {
  forceDark?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}

export function ThemeToggle({
  forceDark = false,
  triggerClassName,
  contentClassName,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const currentTheme = forceDark ? "dark" : theme;

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-foreground-light",
          triggerClassName,
        )}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-4 w-4 opacity-40" />
      </button>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id="theme-toggle"
        disabled={forceDark}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-foreground-light transition hover:bg-surface-200 hover:text-foreground disabled:opacity-50",
          triggerClassName,
        )}
        aria-label="Toggle theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {resolvedTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </button>

      {open && !forceDark && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg",
            contentClassName,
          )}
        >
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
            Appearance
          </p>
          {singleThemes
            .filter((x) => x.value === "dark" || x.value === "light" || x.value === "system")
            .map((item) => {
              const Icon = THEME_ICONS[item.value as keyof typeof THEME_ICONS] ?? Monitor;
              const active = currentTheme === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition",
                    active
                      ? "bg-surface-200 font-medium text-foreground"
                      : "text-foreground-light hover:bg-surface-200 hover:text-foreground",
                  )}
                  onClick={() => {
                    setTheme(item.value);
                    setOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-brand-500" /> : null}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
