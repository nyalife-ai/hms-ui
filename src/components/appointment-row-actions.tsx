"use client";

import { Eye, FileText, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Kebab menu for Quick / Detailed view — supplements row action buttons. */
export function AppointmentRowActions({
  onQuickView,
  onDetailedView,
}: {
  onQuickView: () => void;
  onDetailedView: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        aria-label="More appointment actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800"
            onClick={() => {
              setOpen(false);
              onQuickView();
            }}
          >
            <Eye className="h-3.5 w-3.5" /> Quick view
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800"
            onClick={() => {
              setOpen(false);
              onDetailedView();
            }}
          >
            <FileText className="h-3.5 w-3.5" /> Detailed view
          </button>
        </div>
      )}
    </div>
  );
}
