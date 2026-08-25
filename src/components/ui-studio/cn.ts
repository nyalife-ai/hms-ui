/**
 * Copied / adapted from supabase/packages/ui `cn` util.
 * Copyright (c) Supabase — Apache 2.0 / MIT as upstream.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
