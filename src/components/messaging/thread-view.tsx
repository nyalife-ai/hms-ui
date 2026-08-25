"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Paperclip,
  Play,
  Reply,
  X,
} from "lucide-react";
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
import {
  DeliveryTicks,
  getMessageActions,
  MessageActions,
} from "./message-actions";
import { VoiceNotePlayer } from "./voice-note-player";

const SWIPE_REPLY_PX = 56;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 10;

function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("image/"));
}
function isVideoMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("video/"));
}
function isAudioMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("audio/"));
}

function isImageAttachment(
  a: MessageAttachment,
  messageType?: string,
): boolean {
  if (isImageMime(a.mimeType)) return true;
  return !a.mimeType && messageType === "IMAGE";
}
function isVideoAttachment(
  a: MessageAttachment,
  messageType?: string,
): boolean {
  if (isVideoMime(a.mimeType)) return true;
  return !a.mimeType && messageType === "VIDEO";
}
function isAudioAttachment(
  a: MessageAttachment,
  messageType?: string,
): boolean {
  if (isAudioMime(a.mimeType)) return true;
  return !a.mimeType && messageType === "AUDIO";
}
function isMediaAttachment(
  a: MessageAttachment,
  messageType?: string,
): boolean {
  return (
    isImageAttachment(a, messageType) ||
    isVideoAttachment(a, messageType) ||
    isAudioAttachment(a, messageType)
  );
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

function useAttachmentBlobUrls(
  attachments: MessageAttachment[],
  messageType?: string,
) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [retryTick, setRetryTick] = useState<Record<string, number>>({});
  const cacheRef = useRef<Record<string, string>>({});
  const createdBlobIdsRef = useRef<Set<string>>(new Set());
  const attachmentIdsKey = useMemo(
    () =>
      attachments
        .map((a) => a.id)
        .slice()
        .sort()
        .join(","),
    [attachments],
  );

  const retry = useCallback((id: string) => {
    const existing = cacheRef.current[id];
    if (existing && createdBlobIdsRef.current.has(id)) {
      URL.revokeObjectURL(existing);
      createdBlobIdsRef.current.delete(id);
    }
    delete cacheRef.current[id];
    setUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFailed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRetryTick((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const media = attachments.filter((a) => isMediaAttachment(a, messageType));

    void (async () => {
      const next: Record<string, string> = { ...cacheRef.current };
      const failNext: Record<string, boolean> = {};
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
          createdBlobIdsRef.current.add(a.id);
          failNext[a.id] = false;
        } catch {
          failNext[a.id] = true;
        }
      }
      if (!cancelled) {
        setUrls({ ...next });
        setFailed((prev) => {
          const merged = { ...prev };
          for (const [id, v] of Object.entries(failNext)) {
            if (v) merged[id] = true;
            else delete merged[id];
          }
          return merged;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentIdsKey, messageType, retryTick]);

  useEffect(() => {
    return () => {
      for (const id of createdBlobIdsRef.current) {
        const url = cacheRef.current[id];
        if (url) URL.revokeObjectURL(url);
      }
      createdBlobIdsRef.current.clear();
    };
  }, []);

  return { urls, failed, retry };
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
      (n) =>
        part === n ||
        part === `@${n}` ||
        part.toLowerCase() === `@${n.toLowerCase()}`,
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

function MediaLightbox({
  items,
  index,
  urls,
  videoIds,
  onClose,
  onIndexChange,
}: {
  items: MessageAttachment[];
  index: number;
  urls: Record<string, string>;
  videoIds: Set<string>;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const current = items[index];
  const src = current ? urls[current.id] : null;
  const showVideo = Boolean(
    current &&
      (videoIds.has(current.id) ||
        isVideoMime(current.mimeType) ||
        /\.(mp4|webm|mov|m4v)$/i.test(current.fileName ?? "")),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight")
        onIndexChange(Math.min(items.length - 1, index + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndexChange]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal
      aria-label="Media preview"
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
        else onIndexChange(Math.min(items.length - 1, index + 1));
      }}
    >
      {src && showVideo ? (
        <video
          src={src}
          controls
          playsInline
          autoPlay
          className="max-h-[90vh] max-w-[90vw] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={current?.fileName ?? "Attachment preview"}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="flex h-40 w-64 flex-col items-center justify-center gap-2 rounded-lg bg-white/10 text-sm text-white/80"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading media…
        </div>
      )}

      {items.length > 1 ? (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {index + 1} / {items.length}
        </p>
      ) : null}

      {index > 0 ? (
        <button
          type="button"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {index < items.length - 1 ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}

      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-foreground"
        onClick={onClose}
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function MediaFailState({
  mine,
  onRetry,
  tall,
}: {
  mine: boolean;
  onRetry: () => void;
  tall?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg bg-black/10 px-3 ${
        tall ? "h-28" : "h-10"
      }`}
    >
      <span className={`text-xs ${mine ? "text-white/80" : "text-slate-500"}`}>
        Failed to load
      </span>
      <button
        type="button"
        onClick={onRetry}
        className={`rounded-lg px-2 py-1 text-xs font-medium ${
          mine
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-white text-brand-700 ring-1 ring-slate-200 hover:bg-brand-50"
        }`}
      >
        Retry
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
  onForward,
  onJumpToMessage,
}: {
  message: ChatMessage;
  mine: boolean;
  currentUserId?: string;
  highlighted?: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reactionType: string) => void;
  onEdit: (message: ChatMessage, body: string) => void | Promise<void>;
  onDelete: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onJumpToMessage: (parentId: string) => void;
}) {
  const deleted = m.isDeleted;
  const attachments = m.attachments ?? [];
  const mt = m.messageType;
  const images = attachments.filter((a) => isImageAttachment(a, mt));
  const videos = attachments.filter((a) => isVideoAttachment(a, mt));
  const audios = attachments.filter((a) => isAudioAttachment(a, mt));
  const docs = attachments.filter(
    (a) =>
      !isImageAttachment(a, mt) &&
      !isVideoAttachment(a, mt) &&
      !isAudioAttachment(a, mt),
  );
  const { urls: blobUrls, failed, retry } = useAttachmentBlobUrls(
    attachments,
    mt,
  );
  const lightboxItems = useMemo(() => [...images, ...videos], [images, videos]);
  const videoIdSet = useMemo(() => new Set(videos.map((v) => v.id)), [videos]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [useSheet, setUseSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(m.body ?? "");
  const [editBusy, setEditBusy] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dominantAxis = useRef<"h" | "v" | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressOpened = useRef(false);
  const swipeStarted = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  const hasCopyBody = Boolean(m.body?.trim()) || attachments.length > 0;
  const actions = getMessageActions({
    isOwn: mine,
    deleted,
    hasBody: hasCopyBody,
    canForward: Boolean(onForward),
  });

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  };

  const openMenuAt = (x: number, y: number, sheet: boolean) => {
    longPressOpened.current = true;
    setMenuPos({ x, y });
    setUseSheet(sheet);
    setMenuOpen(true);
  };

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPos(null);
    longPressOpened.current = false;
  }, []);

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
    swipeStarted.current = false;
    longPressOpened.current = false;
    setSwipeX(0);

    if (!deleted) {
      clearLongPress();
      longPressOrigin.current = { x: t.clientX, y: t.clientY };
      longPressTimer.current = window.setTimeout(() => {
        if (swipeStarted.current) return;
        openMenuAt(t.clientX, t.clientY, true);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(12);
          } catch {
            // ignore
          }
        }
      }, LONG_PRESS_MS);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    const start = touchStart.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    const origin = longPressOrigin.current;
    if (origin) {
      const move = Math.hypot(t.clientX - origin.x, t.clientY - origin.y);
      if (move > LONG_PRESS_MOVE_PX) clearLongPress();
    }

    if (!dominantAxis.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dominantAxis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (dominantAxis.current === "h") {
      swipeStarted.current = true;
      clearLongPress();
      const replyDx = mine ? Math.min(0, dx) : Math.max(0, dx);
      setSwipeX(Math.max(-80, Math.min(80, replyDx)));
    }
  };

  const onTouchEnd = () => {
    clearLongPress();
    const threshold = SWIPE_REPLY_PX;
    if (
      !longPressOpened.current &&
      Math.abs(swipeX) >= threshold &&
      !deleted
    ) {
      onReply(m);
    }
    touchStart.current = null;
    dominantAxis.current = null;
    swipeStarted.current = false;
    setSwipeX(0);
  };

  const copyLabel = m.body?.trim()
    ? m.body
    : attachments[0]
      ? attachments[0].fileName
      : "";

  const replyPreview = m.parentPreview?.trim() || "Attachment";

  const saveEdit = async () => {
    const next = editDraft.trim();
    if (!next || next === (m.body ?? "")) {
      setEditing(false);
      return;
    }
    setEditBusy(true);
    try {
      await onEdit(m, next);
      setEditing(false);
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <div
      data-message-id={m.id}
      className={`group relative flex ${mine ? "justify-end" : "justify-start"}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        clearLongPress();
        onTouchEnd();
      }}
      onContextMenu={(e) => {
        if (deleted) return;
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY, false);
      }}
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
            ? "bg-surface-200 italic text-foreground-lighter"
            : mine
              ? "bg-brand-500 text-white"
              : "bg-[#eef4f4] text-foreground"
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
            open={menuOpen}
            pos={menuPos}
            onClose={closeMenu}
            isOwn={mine}
            useBottomSheet={useSheet}
            actions={actions}
            handlers={{
              onReply: () => onReply(m),
              onReact: (r) => onReact(m, r),
              onCopy: () => {
                if (copyLabel) void navigator.clipboard.writeText(copyLabel);
              },
              onEdit: mine
                ? () => {
                    setEditDraft(m.body ?? "");
                    setEditing(true);
                  }
                : undefined,
              onDelete: mine ? () => onDelete(m) : undefined,
              onForward: onForward ? () => onForward(m) : undefined,
            }}
          />
        ) : null}

        {!mine && !deleted ? (
          <p className="mb-1 text-[11px] font-semibold text-foreground-light">
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
                : "border-brand-400 bg-white/70 text-foreground-light"
            }`}
          >
            {replyPreview}
          </button>
        ) : null}

        {deleted ? (
          <p>This message was deleted</p>
        ) : editing ? (
          <div className="space-y-2">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={3}
              className={`w-full rounded-lg border px-2 py-1.5 text-sm ${
                mine
                  ? "border-white/30 bg-white/15 text-white placeholder:text-white/50"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
              aria-label="Edit message"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  mine ? "bg-white/15 text-white" : "bg-white text-slate-600"
                }`}
                disabled={editBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={editBusy || !editDraft.trim()}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                  mine
                    ? "bg-white text-brand-700 disabled:opacity-40"
                    : "bg-brand-500 text-white disabled:opacity-40"
                }`}
              >
                {editBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
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
                  const isFailed = failed[a.id];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        if (src) {
                          const li = lightboxItems.findIndex((x) => x.id === a.id);
                          setLightboxIndex(li >= 0 ? li : idx);
                        }
                      }}
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
                      ) : isFailed ? (
                        <MediaFailState
                          mine={mine}
                          onRetry={() => retry(a.id)}
                          tall
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
                  const isFailed = failed[a.id];
                  return src ? (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        const li = lightboxItems.findIndex((x) => x.id === a.id);
                        if (li >= 0) setLightboxIndex(li);
                      }}
                      className="relative block w-full overflow-hidden rounded-lg bg-black/20"
                      aria-label={`Play ${a.fileName}`}
                    >
                      <video
                        src={src}
                        playsInline
                        preload="metadata"
                        muted
                        className="max-h-64 w-full pointer-events-none"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <span className="rounded-full bg-white/90 p-2 text-slate-800">
                          <Play className="h-5 w-5 fill-current" />
                        </span>
                      </span>
                    </button>
                  ) : isFailed ? (
                    <MediaFailState
                      key={a.id}
                      mine={mine}
                      onRetry={() => retry(a.id)}
                      tall
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
                {audios.map((a) => (
                  <VoiceNotePlayer
                    key={a.id}
                    src={blobUrls[a.id]}
                    cacheKey={a.id}
                    sent={mine}
                    fileName={a.fileName}
                    loading={!blobUrls[a.id] && !failed[a.id]}
                    failed={Boolean(failed[a.id])}
                    onRetry={() => retry(a.id)}
                  />
                ))}
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
                        : "bg-white text-foreground-light ring-1 ring-slate-100"
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
              ? "text-foreground-lighter"
              : mine
                ? "text-white/70"
                : "text-foreground-lighter"
          }`}
        >
          {m.editedAt && !deleted ? <span>edited</span> : null}
          <span>{formatMessageTime(m.createdAt)}</span>
          {mine && !deleted ? (
            <DeliveryTicks status={m.deliveryStatus ?? "SENT"} light />
          ) : null}
        </div>
      </div>

      {lightboxIndex != null && lightboxItems[lightboxIndex] ? (
        <MediaLightbox
          items={lightboxItems}
          index={lightboxIndex}
          urls={blobUrls}
          videoIds={videoIdSet}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  );
}

const MANAGEABLE_TYPES = new Set(["GROUP", "DEPARTMENT", "TEAM"]);

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
  onForward,
  onMuteToggle,
  onJumpToMessage,
  onOpenParticipants,
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
  onEdit: (message: ChatMessage, body: string) => void | Promise<void>;
  onDelete: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onMuteToggle?: () => void;
  onJumpToMessage?: (messageId: string) => void;
  onOpenParticipants?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const title = conversationDisplayName(conversation, currentUserId);
  const showParticipants = MANAGEABLE_TYPES.has(String(conversation.type));

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
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
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
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {showParticipants && onOpenParticipants ? (
            <button
              type="button"
              onClick={onOpenParticipants}
              className="truncate text-xs text-foreground-lighter hover:text-brand-700"
            >
              {conversation.participants.length} participants
            </button>
          ) : (
            <p className="truncate text-xs text-foreground-lighter">
              {conversation.type === "DIRECT"
                ? "Direct message"
                : `${conversation.participants.length} participants`}
            </p>
          )}

        </div>
        {onMuteToggle ? (
          <button
            type="button"
            onClick={onMuteToggle}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground-light hover:border-brand-300 hover:text-brand-700"
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
            className="hidden rounded-lg p-1.5 text-foreground-lighter hover:bg-surface-200 lg:inline-flex"
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
                className={`h-12 w-2/3 animate-pulse rounded-2xl bg-surface-200 ${
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
          <p className="py-10 text-center text-sm text-foreground-lighter">
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
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-foreground-light shadow-sm ring-1 ring-slate-100">
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
                onForward={onForward}
                onJumpToMessage={scrollToMessage}
              />
            </div>
          );
        })}

        {typingLabel ? (
          <p className="px-1 pt-2 text-xs text-foreground-lighter">{typingLabel}</p>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
