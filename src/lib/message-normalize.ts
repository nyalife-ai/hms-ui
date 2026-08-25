/**
 * Shared chat message normalization — REST, WebSocket, and optimistic sends
 * must produce the same ChatMessage shape.
 */

import type {
  ChatMessage,
  MessageAttachment,
  MessageMention,
  MessageReaction,
  MessageType,
} from "./messaging";

export type { ChatMessage, MessageAttachment };

/** Thin notification wake-ups must not be treated as chat content. */
export function isRichMessagePayload(
  payload: Record<string, unknown>,
): boolean {
  return (
    "body" in payload ||
    "attachments" in payload ||
    "messageType" in payload ||
    "createdAt" in payload ||
    "deliveryStatus" in payload
  );
}

function asAttachment(raw: unknown): MessageAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.id !== "string") return null;
  return {
    id: a.id,
    fileName: typeof a.fileName === "string" ? a.fileName : "file",
    mimeType: typeof a.mimeType === "string" ? a.mimeType : null,
    fileSize: typeof a.fileSize === "number" ? a.fileSize : null,
    previewUrl: typeof a.previewUrl === "string" ? a.previewUrl : undefined,
  };
}

function asMention(raw: unknown): MessageMention | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.userId !== "string") return null;
  return {
    userId: m.userId,
    displayName: typeof m.displayName === "string" ? m.displayName : "Staff",
  };
}

/** Normalize any server/client payload into a ChatMessage, or null if not rich. */
export function normalizeChatMessage(
  payload: Record<string, unknown>,
): ChatMessage | null {
  const id =
    (typeof payload.id === "string" && payload.id) ||
    (typeof payload.messageId === "string" && payload.messageId) ||
    null;
  const conversationId =
    typeof payload.conversationId === "string" ? payload.conversationId : null;
  if (!id || !conversationId) return null;
  if (!isRichMessagePayload(payload)) return null;

  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
        .map(asAttachment)
        .filter((x): x is MessageAttachment => Boolean(x))
    : [];

  const mentions = Array.isArray(payload.mentions)
    ? payload.mentions
        .map(asMention)
        .filter((x): x is MessageMention => Boolean(x))
    : [];

  return {
    id,
    conversationId,
    senderId: typeof payload.senderId === "string" ? payload.senderId : "",
    senderName:
      typeof payload.senderName === "string" ? payload.senderName : "Staff",
    messageType: (typeof payload.messageType === "string"
      ? payload.messageType
      : "TEXT") as MessageType | string,
    body: typeof payload.body === "string" ? payload.body : null,
    isDeleted: Boolean(payload.isDeleted),
    editedAt: typeof payload.editedAt === "string" ? payload.editedAt : null,
    createdAt:
      typeof payload.createdAt === "string"
        ? payload.createdAt
        : new Date().toISOString(),
    parentMessageId:
      typeof payload.parentMessageId === "string"
        ? payload.parentMessageId
        : null,
    parentPreview:
      typeof payload.parentPreview === "string" ? payload.parentPreview : null,
    mentions,
    attachments,
    reactions: Array.isArray(payload.reactions)
      ? (payload.reactions as MessageReaction[])
      : [],
    deliveryStatus:
      typeof payload.deliveryStatus === "string"
        ? payload.deliveryStatus
        : "SENT",
    clientMessageId:
      typeof payload.clientMessageId === "string"
        ? payload.clientMessageId
        : null,
    pending: Boolean(payload.pending),
  };
}

function mergeAttachments(
  prev: MessageAttachment[],
  next: MessageAttachment[],
): MessageAttachment[] {
  if (!next.length && prev.length) return prev;
  if (!prev.length) return next;

  const prevByName = new Map(
    prev.filter((p) => p.previewUrl).map((p) => [p.fileName, p]),
  );
  const prevLocal = prev.find((p) => p.previewUrl && p.id.startsWith("local-"));

  return next.map((a, i) => {
    const fromName = prevByName.get(a.fileName);
    const fromIndex = prev[i];
    const donor =
      (fromName?.previewUrl ? fromName : null) ||
      (fromIndex?.previewUrl ? fromIndex : null) ||
      (i === 0 && prevLocal?.previewUrl ? prevLocal : null);
    if (donor?.previewUrl && !a.previewUrl) {
      return { ...a, previewUrl: donor.previewUrl };
    }
    return a;
  });
}

/** Prefer richer fields when reconciling optimistic ↔ server ↔ WS. */
export function mergeChatMessage(
  prev: ChatMessage,
  next: ChatMessage,
): ChatMessage {
  const attachments = mergeAttachments(
    prev.attachments ?? [],
    next.attachments ?? [],
  );

  let messageType = next.messageType || prev.messageType || "TEXT";
  if (
    (messageType === "TEXT" || !messageType) &&
    prev.messageType &&
    prev.messageType !== "TEXT" &&
    attachments.length > 0
  ) {
    messageType = prev.messageType;
  }

  return {
    ...prev,
    ...next,
    attachments,
    messageType,
    body: next.body !== undefined ? next.body : prev.body,
    mentions: next.mentions?.length ? next.mentions : prev.mentions,
    reactions: next.reactions ?? prev.reactions,
    clientMessageId: next.clientMessageId ?? prev.clientMessageId,
    pending: next.pending ?? false,
    parentPreview: next.parentPreview ?? prev.parentPreview,
  };
}

export function mergeMessagesById(
  a: ChatMessage[],
  b: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  const byClient = new Map<string, string>();

  const put = (m: ChatMessage) => {
    if (m.clientMessageId) {
      const existingId = byClient.get(m.clientMessageId);
      if (existingId && existingId !== m.id) {
        map.delete(existingId);
      }
      byClient.set(m.clientMessageId, m.id);
    }
    const prev = map.get(m.id);
    map.set(m.id, prev ? mergeChatMessage(prev, m) : m);
  };

  for (const m of a) put(m);
  for (const m of b) put(m);

  return [...map.values()].sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
  );
}
