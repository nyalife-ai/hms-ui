"use client";

import { ChevronLeft, ChevronRight, Download, Loader2, Paperclip, Reply, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
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
function isVideoMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("video/"));
}
function isAudioMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("audio/"));
}
function isMediaMime(mime: string | null | undefined): boolean {
  return isImageMime(mime) || isVideoMime(mime) || isAudioMime(mime);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useAttachmentBlobUrls(attachments: MessageAttachment[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cacheRef = useRef<Record<string, string>>({});
  const attachmentIdsKey = useMemo(
    () =>
      attachments
        .map((a) => a.id)
        .slice()
        .sort()
        .join(","),
    [attachments],
  );

  useEffect(() => {
    let cancelled = false;
    const media = attachments.filter((a) => isMediaMime(a.mimeType));

    void (async () => {
      const next: Record<string, string> = { ...cacheRef.current };
      for (const a of media) {
        if (next[a.id]) continue;
        if (a.previewUrl) {
          next[a.id] = a.previewUrl;
          cacheRef.current[a.id] = a.previewUrl;
          continue;
        }
        if (a.id.startsWith("local-")) continue;
        try {
          const url = await fetchAttachmentBlobUrl(a.id);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          next[a.id] = url;
          cacheRef.current[a.id] = url;
        } catch {
          // ignore per-attachment failures
        }
      }
      if (!cancelled) setUrls({ ...next });
    })();

    return () => {
      cancelled = true;
    };
    // attachmentIdsKey captures id set; attachments used for mime/previewUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentIdsKey]);

  return urls;
}

async function openAttachment(id: string, fileName: string) {
  try {
    const meta = await downloadAttachment(id);
    if (
      meta.url &&
      (meta.url.startsWith("http://") || meta.url.startsWith("https://"))
    ) {
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

function highlightMentions(
  body: string,
  mentions: Array<{ displayName: string }> | undefined,
  mine: boolean,
) {
  if (!body || !mentions?.length) return body;
  const names = mentions
    .map((m) => m.displayName.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return body;

  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(@?(?:${escaped.join("|")}))`, "gi");
  const parts = body.split(re);
  return parts.map((part, i) => {
    const isMention = names.some(
      (n) => part === n || part === `@${n}` || part.toLowerCase() === `@${n.toLowerCase()}`,
    );
    if (!isMention) return <span key={i}>{part}</span>;
    return (
      <span
        key={i}
        className={
          mine
            ? "rounded bg-white/20 px-0.5 font-medium"
            : "rounded bg-brand-100 px-0.5 font-medium text-brand-800"
        }
      >
        {part.startsWith("@") ? part : `@${part}`}
      </span>
    );
  });
}

function ImageLightbox({
  images,
  index,
  urls,
  onClose,
  onIndexChange,
}: {
  images: MessageAttachment[];
  index: number;
  urls: Record<string, string>;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const current = images[index];
  const src = current ? urls[current.id] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight")
        onIndexChange(Math.min(images.length - 1, index + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndexChange]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal
      aria-label="Image preview"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 48) return;
        if (dx > 0) onIndexChange(Math.max(0, index - 1));
        else onIndexChange(Math.min(images.length - 1, index + 1));
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={current?.fileName ?? "Attachment preview"}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        {index + 1} / {images.length}
      </p>

      {index > 0 ? (
        <button
          type="button"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Previous image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {index < images.length - 1 ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Next image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}

      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700"
        onClick={onClose}
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function MessageBubble({
  message: m,
  mine,
  currentUserId,
  highlighted,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onJumpToMessage,
}: {
  message: ChatMessage;
  mine: boolean;
  currentUserId?: string;
  highlighted?: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reactionType: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onJumpToMessage: (parentId: string) => void;
}) {
  const deleted = m.isDeleted;
  const attachments = m.attachments ?? [];
  const images = attachments.filter((a) => isImageMime(a.mimeType));
  const videos = attachments.filter((a) => isVideoMime(a.mimeType));
  const audios = attachments.filter((a) => isAudioMime(a.mimeType));
  const docs = attachments.filter(
    (a) =>
      !isImageMime(a.mimeType) &&
      !isVideoMime(a.mimeType) &&
      !isAudioMime(a.mimeType),
  );
  const blobUrls = useAttachmentBlobUrls(attachments);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dominantAxis = useRef<"h" | "v" | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const imageGridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2 || images.length === 3
        ? "grid-cols-2"
        : "grid-cols-2";

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

  const replyPreview = m.parentPreview?.trim() || "Attachment";

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
        style={
          reducedMotion ? undefined : { transform: `translateX(${swipeX}px)` }
        }
        className={`relative max-w-[min(85%,32rem)] rounded-2xl px-3.5 py-2.5 text-sm transition-[box-shadow,background-color,transform] duration-500 ${
          deleted
            ? "bg-slate-50 italic text-slate-400"
            : mine
              ? "bg-brand-500 text-white"
              : "bg-[#eef4f4] text-slate-700"
        } ${m.pending ? "opacity-70" : ""} ${
          highlighted
            ? mine
              ? "ring-2 ring-white/80 ring-offset-2 ring-offset-brand-500"
              : "bg-brand-50 ring-2 ring-brand-300"
            : ""
        }`}
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

        {m.parentMessageId ? (
          <button
            type="button"
            onClick={() => onJumpToMessage(m.parentMessageId!)}
            className={`mb-2 w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
              mine
                ? "border-white/50 bg-white/15 text-white/90"
                : "border-brand-400 bg-white/70 text-slate-500"
            }`}
          >
            {replyPreview}
          </button>
        ) : null}

        {deleted ? (
          <p>This message was deleted</p>
        ) : (
          <>
            {m.body ? (
              <p className="whitespace-pre-wrap break-words">
                {highlightMentions(m.body, m.mentions, mine)}
              </p>
            ) : null}

            {images.length ? (
              <div className={`mt-2 grid gap-1 ${imageGridClass}`}>
                {images.map((a, idx) => {
                  const src = blobUrls[a.id];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => src && setLightboxIndex(idx)}
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

            {videos.length ? (
              <div className="mt-2 space-y-2">
                {videos.map((a) => {
                  const src = blobUrls[a.id];
                  return src ? (
                    <video
                      key={a.id}
                      controls
                      playsInline
                      preload="metadata"
                      src={src}
                      className="max-h-64 w-full rounded-lg"
                    />
                  ) : (
                    <div
                      key={a.id}
                      className="flex h-28 items-center justify-center rounded-lg bg-black/10"
                    >
                      <Loader2 className="h-4 w-4 animate-spin opacity-60" />
                    </div>
                  );
                })}
              </div>
            ) : null}

            {audios.length ? (
              <div className="mt-2 space-y-2">
                {audios.map((a) => {
                  const src = blobUrls[a.id];
                  return src ? (
                    <audio
                      key={a.id}
                      controls
                      preload="metadata"
                      src={src}
                      className="w-full max-w-xs"
                    />
                  ) : (
                    <div
                      key={a.id}
                      className="flex h-10 items-center gap-2 rounded-lg bg-black/10 px-3"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
                      <span className="text-xs opacity-70">{a.fileName}</span>
                    </div>
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

      {lightboxIndex != null && images[lightboxIndex] ? (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          urls={blobUrls}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
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
  highlightedMessageId,
  onBack,
  onLoadOlder,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onMuteToggle,
  onJumpToMessage,
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
  highlightedMessageId?: string | null;
  onBack?: () => void;
  onLoadOlder?: () => void | Promise<void>;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reactionType: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onMuteToggle?: () => void;
  onJumpToMessage?: (messageId: string) => void;
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

  useEffect(() => {
    if (!highlightedMessageId) return;
    const el = scrollerRef.current?.querySelector(
      `[data-message-id="${CSS.escape(highlightedMessageId)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedMessageId, messages]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (onJumpToMessage) {
        onJumpToMessage(messageId);
        return;
      }
      const el = scrollerRef.current?.querySelector(
        `[data-message-id="${CSS.escape(messageId)}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [onJumpToMessage],
  );

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
                highlighted={highlightedMessageId === m.id}
                onReply={onReply}
                onReact={onReact}
                onEdit={onEdit}
                onDelete={onDelete}
                onJumpToMessage={scrollToMessage}
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
