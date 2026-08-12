"use client";

import { Eye, FileText, FlaskConical, MoreVertical, Pill } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Kebab for consultation / visit rows — matches the clinical action menu. */
export function ConsultationRowActions({
  onQuickView,
  onEditRecord,
  onRelatedLabs,
  onRelatedPrescriptions,
}: {
  onQuickView: () => void;
  onEditRecord: () => void;
  onRelatedLabs: () => void;
  onRelatedPrescriptions: () => void;
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
        aria-label="More consultation actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onQuickView();
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Eye className="h-3.5 w-3.5" />
            </span>
            Quick Clinical View
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onEditRecord();
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FileText className="h-3.5 w-3.5" />
            </span>
            Edit Record
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onRelatedLabs();
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <FlaskConical className="h-3.5 w-3.5" />
            </span>
            See Related Labs
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onRelatedPrescriptions();
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Pill className="h-3.5 w-3.5" />
            </span>
            See Prescriptions
          </button>
        </div>
      )}
    </div>
  );
}
