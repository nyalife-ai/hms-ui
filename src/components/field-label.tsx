"use client";

import type { ReactNode } from "react";

/** Form field label — required uses *, optional uses OPT (not "(Optional)"). */
export function FieldLabel({
  children,
  htmlFor,
  required,
  optional,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-slate-600"
    >
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
      {optional && !required && (
        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          OPT
        </span>
      )}
    </label>
  );
}
