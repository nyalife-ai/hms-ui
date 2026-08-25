"use client";

import {
  Check,
  CheckCheck,
  Copy,
  Forward,
  Pencil,
  Reply,
  Smile,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ALLOWED_REACTIONS } from "@/lib/messaging";

export type MessageActionId =
  | "reply"
  | "react"
  | "copy"
  | "edit"
  | "delete"
  | "forward";

export type MessageActionDef = {
  id: MessageActionId;
  label: string;
};

export type MessageActionHandlers = {
  onReply: () => void;
  onReact: (reactionType: string) => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
};

/** Shared action list for bubble toolbar / menu / sheet. */
export function getMessageActions({
  isOwn,
  deleted,
  hasBody,
  canForward = true,
}: {
  isOwn: boolean;
  deleted: boolean;
  hasBody: boolean;
  canForward?: boolean;
}): MessageActionDef[] {
  if (deleted) return [];
  const actions: MessageActionDef[] = [
    { id: "reply", label: "Reply" },
    { id: "react", label: "React" },
  ];
  if (hasBody) actions.push({ id: "copy", label: "Copy" });
  if (canForward) actions.push({ id: "forward", label: "Forward" });
  if (isOwn) {
    actions.push({ id: "edit", label: "Edit" });
    actions.push({ id: "delete", label: "Delete" });
  }
  return actions;
}

/**
 * Renders hover toolbar + context/long-press menu.
 * Bubble owns gestures; this component only paints UI from `open`/`pos`.
 */
export function MessageActions({
  open,
  pos,
  onClose,
  handlers,
  actions,
  /** Long-press on mobile uses bottom sheet; sm+ keeps popover near touch. */
  useBottomSheet = false,
}: {
  open: boolean;
  pos: { x: number; y: number } | null;
  onClose: () => void;
  handlers: MessageActionHandlers;
  isOwn?: boolean;
  actions: MessageActionDef[];
  useBottomSheet?: boolean;
}) {
  const [reactOpen, setReactOpen] = useState(false);
  const [hoverReact, setHoverReact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setReactOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open && !hoverReact) return;
    const onDoc = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
        setHoverReact(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        setHoverReact(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hoverReact, onClose]);

  const closeAll = () => {
    onClose();
    setReactOpen(false);
    setHoverReact(false);
  };

  const run = (id: MessageActionId) => {
    switch (id) {
      case "reply":
        handlers.onReply();
        closeAll();
        break;
      case "react":
        setReactOpen(true);
        break;
      case "copy":
        handlers.onCopy();
        closeAll();
        break;
      case "forward":
        handlers.onForward?.();
        closeAll();
        break;
      case "edit":
        handlers.onEdit?.();
        closeAll();
        break;
      case "delete":
        handlers.onDelete?.();
        closeAll();
        break;
    }
  };

  const iconFor = (id: MessageActionId) => {
    switch (id) {
      case "reply":
        return <Reply className="h-3.5 w-3.5" />;
      case "react":
        return <Smile className="h-3.5 w-3.5" />;
      case "copy":
        return <Copy className="h-3.5 w-3.5" />;
      case "forward":
        return <Forward className="h-3.5 w-3.5" />;
      case "edit":
        return <Pencil className="h-3.5 w-3.5" />;
      case "delete":
        return <Trash2 className="h-3.5 w-3.5" />;
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50";

  const reactionPicker = (
    <div
      className="flex flex-wrap gap-1 px-2 py-2"
      role="group"
      aria-label="Reactions"
    >
      {ALLOWED_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          className="rounded-lg px-2 py-1 text-lg hover:bg-slate-50"
          aria-label={`React with ${emoji}`}
          onClick={() => {
            handlers.onReact(emoji);
            closeAll();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  const menuItems = actions.map((a) => (
    <button
      key={a.id}
      type="button"
      role="menuitem"
      className={
        a.id === "delete"
          ? `${itemClass} text-rose-600 hover:bg-rose-50`
          : itemClass
      }
      onClick={() => run(a.id)}
    >
      {iconFor(a.id)} {a.label}
    </button>
  ));

  const popoverStyle =
    pos != null
      ? {
          left: Math.min(pos.x, window.innerWidth - 190),
          top: Math.min(pos.y, window.innerHeight - 280),
        }
      : undefined;

  return (
    <div ref={rootRef}>
      <div className="pointer-events-none absolute -top-1 right-1 z-10 hidden gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 sm:flex">
        {actions.map((a) => (
          <IconBtn
            key={a.id}
            label={a.label}
            danger={a.id === "delete"}
            onClick={() => {
              if (a.id === "react") {
                setHoverReact(true);
                setReactOpen(true);
              } else {
                run(a.id);
              }
            }}
          >
            {iconFor(a.id)}
          </IconBtn>
        ))}
      </div>

      {hoverReact && reactOpen ? (
        <div
          role="menu"
          className="absolute -top-12 right-0 z-[60] hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:block"
        >
          {reactionPicker}
        </div>
      ) : null}

      {open && useBottomSheet ? (
        <div className="fixed inset-0 z-[60] sm:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu"
            onClick={closeAll}
          />
          <div
            role="menu"
            className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-xl"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
            {reactOpen ? reactionPicker : menuItems}
          </div>
        </div>
      ) : null}

      {open && pos ? (
        <div
          role="menu"
          className={`fixed z-[60] min-w-[168px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${
            useBottomSheet ? "hidden sm:block" : ""
          }`}
          style={popoverStyle}
        >
          {reactOpen ? reactionPicker : menuItems}
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
        <CheckCheck
          className={`h-3.5 w-3.5 ${light ? "text-sky-200" : "text-sky-500"}`}
        />
      </span>
    );
  }
  if (status === "DELIVERED") {
    return (
      <span
        title="Delivered"
        aria-label="Delivered"
        className={`inline-flex ${muted}`}
      >
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
