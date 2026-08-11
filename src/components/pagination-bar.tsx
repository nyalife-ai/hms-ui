"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@/lib/pagination";

export function PaginationBar({
  meta,
  onPageChange,
  disabled,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (meta.total === 0) {
    return (
      <p className="px-4 py-3 text-xs text-slate-400">No records found.</p>
    );
  }
  const from = (meta.page - 1) * meta.perPage + 1;
  const to = Math.min(meta.page * meta.perPage, meta.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {meta.total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
          title="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <span className="text-xs text-slate-500">
          Page {meta.page} / {meta.totalPages}
        </span>
        <button
          type="button"
          disabled={disabled || meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
          title="Next page"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
