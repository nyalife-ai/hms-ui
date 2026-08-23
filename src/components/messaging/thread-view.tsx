"use client";

import { Download, Loader2, Paperclip, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui";
import {
  conversationDisplayName,
  downloadAttachment,
  formatDateSeparator,
  formatMessageTime,
  sameCalendarDay,
  type ChatMessage,
  type ConversationListItem,
} from "@/lib/messaging";
import { DeliveryTicks, MessageActions } from "./message-actions";

async function openAttachment(id: string) {
  const meta = await downloadAttachment(id);
  if (meta.url) window.open(meta.url, "_blank", "noopener,noreferrer");
}

export function ThreadView({
  conversation,
  currentUserId,
  messages,
  loading,
  loadingOlder,
  hasOlder,
  error,
  typingLabel,
  muted,
  onBack,
  onLoadOlder,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onMuteToggle,
}: {
  conversation: ConversationListItem;
  currentUserId?: string;
  messages: ChatMessage[];
  loading?: boolean;
  loadingOlder?: boolean;
  hasOlder?: boolean;
  error?: string | null;
  typingLabel?: string | null;
  muted?: boolean;
  onBack?: () => void;
  onLoadOlder?: () => void | Promise<void>;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reactionType: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onMuteToggle?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const title = conversationDisplayName(conversation, currentUserId);

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, typingLabel]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 64 && hasOlder && !loadingOlder) {
      const prevHeight = el.scrollHeight;
      void Promise.resolve(onLoadOlder?.()).then(() => {
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;
          scrollerRef.current.scrollTop =
            scrollerRef.current.scrollHeight - prevHeight;
        });
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 lg:hidden"
            aria-label="Back to conversations"
          >
            Back
          </button>
        ) : null}
        <Avatar name={title} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="truncate text-xs text-slate-400">
            {conversation.type === "GROUP"
              ? `${conversation.participants.length} participants`
              : "Direct message"}
          </p>
        </div>
        {onMuteToggle ? (
          <button
            type="button"
            onClick={onMuteToggle}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
            aria-label={muted ? "Unmute conversation" : "Mute conversation"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        ) : null}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 lg:inline-flex"
            aria-label="Close conversation"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fbfb_0%,#ffffff_48%)] px-4 py-4"
      >
        {loadingOlder ? (
          <div className="flex justify-center py-2">
            <Loader2
              className="h-4 w-4 animate-spin text-brand-500"
              aria-label="Loading earlier messages"
            />
          </div>
        ) : null}

        {loading && messages.length === 0 ? (
          <div className="space-y-3 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`h-12 w-2/3 animate-pulse rounded-2xl bg-slate-100 ${
                  i % 2 ? "ml-auto" : ""
                }`}
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && messages.length === 0 && !error ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No messages yet — say hello to start the conversation.
          </p>
        ) : null}

        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const showDate =
            !prev || !sameCalendarDay(prev.createdAt, m.createdAt);
          const mine = m.senderId === currentUserId;
          const deleted = m.isDeleted;

          return (
            <div key={m.id}>
              {showDate ? (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-100">
                    {formatDateSeparator(m.createdAt)}
                  </span>
                </div>
              ) : null}

              <div
                className={`group relative flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[min(85%,32rem)] rounded-2xl px-3.5 py-2.5 text-sm ${
                    deleted
                      ? "bg-slate-50 italic text-slate-400"
                      : mine
                        ? "bg-brand-500 text-white"
                        : "bg-[#eef4f4] text-slate-700"
                  } ${m.pending ? "opacity-70" : ""}`}
                >
                  {!deleted ? (
                    <MessageActions
                      isOwn={mine}
                      handlers={{
                        onReply: () => onReply(m),
                        onReact: (r) => onReact(m, r),
                        onCopy: () => {
                          if (m.body) void navigator.clipboard.writeText(m.body);
                        },
                        onEdit: mine ? () => onEdit(m) : undefined,
                        onDelete: mine ? () => onDelete(m) : undefined,
                      }}
                    />
                  ) : null}

                  {!mine && !deleted ? (
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">
                      {m.senderName}
                    </p>
                  ) : null}

                  {m.parentPreview ? (
                    <div
                      className={`mb-2 rounded-lg border-l-2 px-2 py-1 text-xs ${
                        mine
                          ? "border-white/50 bg-white/15 text-white/90"
                          : "border-brand-400 bg-white/70 text-slate-500"
                      }`}
                    >
                      {m.parentPreview}
                    </div>
                  ) : null}

                  {deleted ? (
                    <p>This message was deleted</p>
                  ) : (
                    <>
                      {m.body ? (
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      ) : null}
                      {m.attachments?.length ? (
                        <ul className="mt-2 space-y-1">
                          {m.attachments.map((a) => (
                            <li key={a.id}>
                              <button
                                type="button"
                                onClick={() => void openAttachment(a.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                                  mine
                                    ? "bg-white/15 text-white hover:bg-white/25"
                                    : "bg-white text-brand-700 hover:bg-brand-50"
                                }`}
                              >
                                <Paperclip className="h-3 w-3" />
                                <span className="max-w-[12rem] truncate">
                                  {a.fileName}
                                </span>
                                <Download className="h-3 w-3 opacity-70" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}

                  {!deleted && m.reactions?.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.reactions.map((r) => {
                        const mineReact = currentUserId
                          ? r.userIds.includes(currentUserId)
                          : false;
                        return (
                          <button
                            key={r.reactionType}
                            type="button"
                            title={`${r.count} reaction${r.count === 1 ? "" : "s"}`}
                            aria-label={`${r.reactionType} ${r.count}`}
                            onClick={() => onReact(m, r.reactionType)}
                            className={`rounded-full px-1.5 py-0.5 text-xs ${
                              mine
                                ? mineReact
                                  ? "bg-white/25 text-white"
                                  : "bg-white/10 text-white/90"
                                : mineReact
                                  ? "bg-brand-100 text-brand-800 ring-1 ring-brand-200"
                                  : "bg-white text-slate-600 ring-1 ring-slate-100"
                            }`}
                          >
                            {r.reactionType} {r.count}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                      deleted
                        ? "text-slate-400"
                        : mine
                          ? "text-white/70"
                          : "text-slate-400"
                    }`}
                  >
                    {m.editedAt && !deleted ? <span>edited</span> : null}
                    <span>{formatMessageTime(m.createdAt)}</span>
                    {mine && !deleted ? (
                      <DeliveryTicks
                        status={m.deliveryStatus ?? "SENT"}
                        light
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typingLabel ? (
          <p className="px-1 pt-2 text-xs text-slate-400">{typingLabel}</p>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
