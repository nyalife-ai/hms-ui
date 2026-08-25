/**
 * Copied / adapted from supabase/apps/studio/fonts/index.ts
 * Copyright (c) Supabase contributors — Apache-2.0.
 * Studio stack: Inter (body), Manrope (headings), Source Code Pro (mono).
 * Manrope is self-hosted here (Studio Next build uses next/font/google; TanStack vendors the same woff2).
 */
import localFont from "next/font/local";

export const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  src: [
    {
      path: "./inter/InterVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./inter/InterVariable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
});

export const manrope = localFont({
  variable: "--font-manrope",
  display: "swap",
  fallback: ["system-ui", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  src: [
    {
      path: "./manrope/manrope-latin-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./manrope/manrope-latin-ext-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
});

export const sourceCodePro = localFont({
  variable: "--font-source-code-pro",
  display: "swap",
  fallback: ["Source Code Pro", "Office Code Pro", "Menlo", "monospace"],
  src: [
    {
      path: "./source-code-pro/SourceCodePro-Variable.woff2",
      weight: "200 900",
      style: "normal",
    },
    {
      path: "./source-code-pro/SourceCodePro-Variable-Italic.woff2",
      weight: "200 900",
      style: "italic",
    },
  ],
});
