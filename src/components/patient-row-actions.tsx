"use client";

import { Activity, Eye, MoreVertical, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PatientRowActions({
  onRecordVital,
  onQuickView,
  onFullProfile,
}: {
  onRecordVital: () => void;
  onQuickView: () => void;
  onFullProfile: () => void;
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
        aria-label="More patient actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-lighter transition hover:bg-surface-200 hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-brand-50 hover:text-brand-800"
            onClick={() => {
              setOpen(false);
              onRecordVital();
            }}
          >
            <Activity className="h-3.5 w-3.5" /> Record vital
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-brand-50 hover:text-brand-800"
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-brand-50 hover:text-brand-800"
            onClick={() => {
              setOpen(false);
              onFullProfile();
            }}
          >
            <UserRound className="h-3.5 w-3.5" /> Full profile
          </button>
        </div>
      )}
    </div>
  );
}
