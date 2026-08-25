"use client";

import { Eye, MoreVertical, Printer } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Kebab: Print + View — fixed portal menu so table overflow never clips it. */
export function LabResultRowActions({
  onPrint,
  onView,
  printDisabled,
}: {
  onPrint: () => void;
  onView: () => void;
  printDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuH = 88;
    const openUp = rect.bottom + menuH > window.innerHeight - 8;
    const top = openUp ? rect.top - 4 : rect.bottom + 4;
    const left = Math.min(rect.right - 160, window.innerWidth - 168);
    setCoords({ top, left: Math.max(8, left), openUp });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  const menu =
    open &&
    coords &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed",
          top: coords.openUp ? undefined : coords.top,
          bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
          left: coords.left,
          zIndex: 9999,
        }}
        className="w-40 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg"
      >
        <button
          type="button"
          role="menuitem"
          disabled={printDisabled}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-brand-50 hover:text-brand-800 disabled:opacity-40"
          onClick={() => {
            setOpen(false);
            onPrint();
          }}
        >
          <Printer className="h-3.5 w-3.5" /> Print report
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-brand-50 hover:text-brand-800"
          onClick={() => {
            setOpen(false);
            onView();
          }}
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
      </div>,
      document.body,
    );

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-label="More result actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-lighter transition hover:bg-surface-200 hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menu}
    </div>
  );
}
