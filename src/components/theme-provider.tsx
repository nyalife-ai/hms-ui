/**
 * Copied / adapted from supabase/packages/common/Providers.tsx
 * Copyright (c) Supabase contributors — Apache-2.0.
 */
"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={["dark", "light"]}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="nyalife-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
