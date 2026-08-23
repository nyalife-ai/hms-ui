"use client";

import { Download, Loader2, Paperclip, Reply, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { Avatar } from "@/components/ui";
import {
  conversationDisplayName,
  downloadAttachment,
  fetchAttachmentBlobUrl,
  formatDateSeparator,
  formatMessageTime,
  sameCalendarDay,
  type ChatMessage,
  type ConversationListItem,
  type MessageAttachment,
} from "@/lib/messaging";
import { DeliveryTicks, MessageActions } from "./message-actions";

const SWIPE_REPLY_PX = 56;

function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("image/"));
}

function useAttachmentBlobUrls(attachments: MessageAttachment[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const imageIds = attachments
      .filter((a) => isImageMime(a.mimeType))
      .map((a) => a.id);

    void (async () => {
      const next: Record<string, string> = { ...cacheRef.current };
      for (const id of imageIds) {
        if (next[id]) continue;
        try {
          const url = await fetchAttachmentBlobUrl(id);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          next[id] = url;
          cacheRef.current[id] = url;
        } catch {
          // ignore per-attachment failures
        }
      }
      if (!cancelled) setUrls({ ...next });
    })();

    return () => {
      cancelled = true;
    };
  }, [attachments]);

  return urls;
}

async function openAttachment(id: string, fileName: string) {
  try {
    const meta = await downloadAttachment(id);
    if (meta.url && !meta.url.startsWith("memory://")) {
      window.open(meta.url, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    // fall through to authenticated blob download
  }
  const blobUrl = await fetchAttachmentBlobUrl(id);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName || "attachment";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

function MessageBubble({
  message: m,
  mine,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onScrollToParent,
}: {
  message: ChatMessage;
  mine: boolean;
  currentUserId?: string;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reactionType: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onScrollToParent: (parentId: string) => void;
}) {
  const deleted = m.isDeleted;
  const images = (m.attachments ?? []).filter((a) => isImageMime(a.mimeType));
  const docs = (m.attachments ?? []).filter((a) => !isImageMime(a.mimeType));
  const blobUrls = useAttachmentBlobUrls(images);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dominantAxis = useRef<"h" | "v" | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    dominantAxis.current = null;
    setSwipeX(0);
  };

  const onTouchMove = (e: TouchEvent) => {
    const start = touchStart.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (!dominantAxis.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dominantAxis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (dominantAxis.current !== "h") return;
    const replyDx = mine ? Math.min(0, dx) : Math.max(0, dx);
    setSwipeX(Math.max(-80, Math.min(80, replyDx)));
  };

  const onTouchEnd = () => {
    const threshold = SWIPE_REPLY_PX;
    if (Math.abs(swipeX) >= threshold && !deleted) {
      onReply(m);
    }
    touchStart.current = null;
    dominantAxis.current = null;
    setSwipeX(0);
  };

  return (
    <div
      data-message-id={m.id}
      className={`group relative flex ${mine ? "justify-end" : "justify-start"}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {Math.abs(swipeX) > 20 ? (
        <div
          className={`absolute top-1/2 flex -translate-y-1/2 items-center text-brand-600 ${
            mine ? "right-full mr-2" : "left-full ml-2"
          }`}
          aria-hidden
        >
          <Reply className="h-4 w-4" />
        </div>
      ) : null}

      <div
        style={{ transform: `translateX(${swipeX}px)` }}
        className={`relative max-w-[min(85%,32rem)] rounded-2xl px-3.5 py-2.5 text-sm transition-transform ${
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

        {m.parentPreview && m.parentMessageId ? (
          <button
            type="button"
            onClick={() => onScrollToParent(m.parentMessageId!)}
            className={`mb-2 w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
              mine
                ? "border-white/50 bg-white/15 text-white/90"
                : "border-brand-400 bg-white/70 text-slate-500"
            }`}
          >
            {m.parentPreview}
          </button>
        ) : m.parentPreview ? (
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

            {images.length ? (
              <div
                className={`mt-2 grid gap-1 ${
                  images.length > 1 ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {images.map((a) => {
                  const src = blobUrls[a.id];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => src && setLightbox(src)}
                      className="overflow-hidden rounded-xl bg-black/10"
                      aria-label={`View ${a.fileName}`}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={a.fileName}
                          className="max-h-56 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin opacity-60" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {docs.length ? (
              <ul className="mt-2 space-y-1">
                {docs.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void openAttachment(a.id, a.fileName)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                        mine
                          ? "bg-white/15 text-white hover:bg-white/25"
                          : "bg-white text-brand-700 hover:bg-brand-50"
                      }`}
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-[12rem] truncate">{a.fileName}</span>
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
            <DeliveryTicks status={m.deliveryStatus ?? "SENT"} light />
          ) : null}
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          aria-label="Image preview"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Attachment preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700"
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
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

  const scrollToMessage = useCallback((messageId: string) => {
    const el = scrollerRef.current?.querySelector(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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

          return (
            <div key={m.clientMessageId ?? m.id}>
              {showDate ? (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-100">
                    {formatDateSeparator(m.createdAt)}
                  </span>
                </div>
              ) : null}

              <MessageBubble
                message={m}
                mine={mine}
                currentUserId={currentUserId}
                onReply={onReply}
                onReact={onReact}
                onEdit={onEdit}
                onDelete={onDelete}
                onScrollToParent={scrollToMessage}
              />
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
