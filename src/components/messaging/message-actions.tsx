"use client";

import { Check, CheckCheck, Copy, Pencil, Reply, Smile, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ALLOWED_REACTIONS } from "@/lib/messaging";

export type MessageActionHandlers = {
  onReply: () => void;
  onReact: (reactionType: string) => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

/** Desktop hover toolbar + mobile long-press menu. */
export function MessageActions({
  isOwn,
  handlers,
}: {
  isOwn: boolean;
  handlers: MessageActionHandlers;
}) {
  const [open, setOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setReactOpen(false);
    setPos(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const openAt = (x: number, y: number, preferReact = false) => {
    setPos({ x, y });
    setOpen(true);
    setReactOpen(preferReact);
  };

  const clearLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";

  return (
    <div
      ref={rootRef}
      className="contents"
      onContextMenu={(e) => {
        e.preventDefault();
        openAt(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (!t) return;
        clearLongPress();
        longPressRef.current = window.setTimeout(() => {
          openAt(t.clientX, t.clientY);
        }, 500);
      }}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <div className="pointer-events-none absolute -top-1 right-1 z-10 hidden gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 sm:flex">
        <IconBtn label="Reply" onClick={handlers.onReply}>
          <Reply className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          label="Add reaction"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            openAt(r.left, r.bottom + 4, true);
          }}
        >
          <Smile className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Copy message" onClick={handlers.onCopy}>
          <Copy className="h-3.5 w-3.5" />
        </IconBtn>
        {isOwn && handlers.onEdit ? (
          <IconBtn label="Edit message" onClick={handlers.onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
        ) : null}
        {isOwn && handlers.onDelete ? (
          <IconBtn label="Delete message" danger onClick={handlers.onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        ) : null}
      </div>

      {open && pos ? (
        <div
          role="menu"
          className="fixed z-[60] min-w-[168px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          style={{
            left: Math.min(pos.x, window.innerWidth - 190),
            top: Math.min(pos.y, window.innerHeight - 240),
          }}
        >
          {reactOpen ? (
            <div className="flex flex-wrap gap-1 px-2 py-2" role="group" aria-label="Reactions">
              {ALLOWED_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  className="rounded-lg px-2 py-1 text-lg hover:bg-slate-50"
                  aria-label={`React with ${emoji}`}
                  onClick={() => {
                    handlers.onReact(emoji);
                    close();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" className={itemClass} onClick={() => { handlers.onReply(); close(); }}>
                <Reply className="h-3.5 w-3.5" /> Reply
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={() => setReactOpen(true)}>
                <Smile className="h-3.5 w-3.5" /> React
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={() => { handlers.onCopy(); close(); }}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              {isOwn && handlers.onEdit ? (
                <button type="button" role="menuitem" className={itemClass} onClick={() => { handlers.onEdit?.(); close(); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              ) : null}
              {isOwn && handlers.onDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  className={`${itemClass} text-rose-600 hover:bg-rose-50`}
                  onClick={() => { handlers.onDelete?.(); close(); }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`rounded-full p-1.5 ${
        danger
          ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          : "text-slate-500 hover:bg-slate-50 hover:text-brand-600"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </button>
  );
}

export function DeliveryTicks({
  status,
  light,
}: {
  status: string | null | undefined;
  light?: boolean;
}) {
  const muted = light ? "text-white/70" : "text-slate-400";
  if (status === "READ") {
    return (
      <span title="Read" aria-label="Read" className="inline-flex">
        <CheckCheck className={`h-3.5 w-3.5 ${light ? "text-sky-200" : "text-sky-500"}`} />
      </span>
    );
  }
  if (status === "DELIVERED") {
    return (
      <span title="Delivered" aria-label="Delivered" className={`inline-flex ${muted}`}>
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span title="Sent" aria-label="Sent" className={`inline-flex ${muted}`}>
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}
