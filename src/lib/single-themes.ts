/**
 * Copied / adapted from supabase/packages/ui/src/components/ThemeProvider/singleThemes.ts
 * Copyright (c) Supabase contributors — Apache-2.0.
 */
export interface SingleTheme {
  name: string;
  value: string;
}

export const singleThemes: SingleTheme[] = [
  { name: "System", value: "system" },
  { name: "Dark", value: "dark" },
  { name: "Light", value: "light" },
];
