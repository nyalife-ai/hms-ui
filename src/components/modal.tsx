"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
} as const;

export type ModalSize = keyof typeof SIZE_CLASS;

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className = "",
  hideHeader = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
  /** Custom chrome (e.g. Quick View sidebar) — still gets ESC + overlay close. */
  hideHeader?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("select, [role='listbox'], [data-datepicker]")) return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={!hideHeader && title != null ? titleId : undefined}
        className={`flex max-h-[85vh] w-[min(100%,85vw)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl ${SIZE_CLASS[size]} ${className}`}
      >
        {!hideHeader && (
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3.5">
            <h2
              id={titleId}
              className="font-heading text-base font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-foreground-lighter transition hover:bg-surface-200 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${hideHeader ? "" : "px-4 py-4"}`}
        >
          {children}
        </div>
        {footer != null && (
          <div className="sticky bottom-0 shrink-0 border-t border-border bg-surface px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
