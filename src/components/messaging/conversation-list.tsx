"use client";

import { BellOff, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/ui";
import {
  conversationDisplayName,
  formatConversationTime,
  type ConversationListItem,
} from "@/lib/messaging";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-lighter focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

function Skeleton() {
  return (
    <ul className="divide-y divide-slate-50" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-surface-200" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-surface-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  search,
  onSearchChange,
  onSelect,
  loading,
  error,
  onlineUserIds,
}: {
  conversations: ConversationListItem[];
  selectedId: string | null;
  currentUserId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (conv: ConversationListItem) => void;
  loading?: boolean;
  error?: string | null;
  onlineUserIds?: Set<string>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <label htmlFor="msg-conv-search" className="sr-only">
          Search conversations
        </label>
        <input
          id="msg-conv-search"
          className={inputClass}
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <p className="px-4 py-3 text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}

        {loading && conversations.length === 0 ? (
          <Skeleton />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Start a new message to coordinate with your care team."
            className="py-14"
          />
        ) : (
          <ul className="divide-y divide-slate-50">
            {conversations.map((c) => {
              const title = conversationDisplayName(c, currentUserId);
              const other =
                c.type === "DIRECT"
                  ? c.participants.find((p) => p.userId !== currentUserId)
                  : undefined;
              const online = Boolean(other && onlineUserIds?.has(other.userId));
              const selected = selectedId === c.id;

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    aria-current={selected ? "true" : undefined}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-surface-200/80 ${
                      selected ? "bg-brand-50/80" : ""
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Avatar name={title} />
                      {online ? (
                        <span
                          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
                          title="Online"
                          aria-label="Online"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {title}
                        </p>
                        <span className="shrink-0 text-[11px] text-foreground-lighter">
                          {formatConversationTime(c.updatedAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {c.muted ? (
                          <BellOff
                            className="h-3 w-3 shrink-0 text-foreground-lighter"
                            aria-label="Muted"
                          />
                        ) : null}
                        <p className="truncate text-sm text-foreground-light">
                          {c.preview || "No messages yet"}
                        </p>
                      </div>
                    </div>
                    {c.unreadCount > 0 ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
