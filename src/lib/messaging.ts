/**
 * Staff messaging API client — /messages/*
 */

import { api, API_URL, ApiError, authenticatedFetch } from "./api";
import { buildListQuery, unwrapPage, type Paginated } from "./pagination";

export const ALLOWED_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
] as const;

export type AllowedReaction = (typeof ALLOWED_REACTIONS)[number];

export type ConversationType =
  | "DIRECT"
  | "GROUP"
  | "DEPARTMENT"
  | "TEAM"
  | "SYSTEM";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "FILE"
  | "SYSTEM"
  | "VIEW_ONCE";

export type DeliveryStatus = "SENT" | "DELIVERED" | "READ";

export type ConversationParticipant = {
  userId: string;
  displayName: string;
  /** Staff / app role (e.g. DOCTOR). */
  role: string;
  /** Conversation membership role (ADMIN | MEMBER). */
  participantRole?: string;
};

export type ConversationListItem = {
  id: string;
  type: ConversationType | string;
  name: string | null;
  avatar: string | null;
  updatedAt: string;
  preview: string | null;
  unreadCount: number;
  muted: boolean;
  participants: ConversationParticipant[];
};

export type ConversationDetail = ConversationListItem & {
  createdBy?: string;
  createdAt?: string;
};

export type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  /** Optimistic local preview (object URL); revoke on reconcile. */
  previewUrl?: string;
};

export type MessageMention = {
  userId: string;
  displayName: string;
};

export type MessageReaction = {
  reactionType: string;
  count: number;
  userIds: string[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  messageType: MessageType | string;
  body: string | null;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  parentMessageId: string | null;
  parentPreview: string | null;
  mentions?: MessageMention[];
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  deliveryStatus: DeliveryStatus | string | null;
  clientMessageId?: string | null;
  pending?: boolean;
};

export type MessagesPage = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export type StaffSearchUser = {
  userId: string;
  displayName: string;
  role: string;
  department: string | null;
  online: boolean;
  email?: string;
};

export type AttachmentUploadRef = {
  key: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
};

export type AttachmentDownload = {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  url: string | null;
  key: string;
};

export type SendMessageInput = {
  body?: string;
  messageType?: MessageType | string;
  parentMessageId?: string;
  clientMessageId?: string;
  mentionedUserIds?: string[];
  attachmentRefs?: Array<{
    key: string;
    fileName: string;
    mimeType?: string;
    fileSize?: number;
  }>;
};

export type CreateConversationInput = {
  type: "DIRECT" | "GROUP";
  participantIds: string[];
  name?: string;
  initialMessage?: string;
};

/** Display name for list/header — DIRECT uses the other participant. */
export function conversationDisplayName(
  conv: Pick<ConversationListItem, "type" | "name" | "participants">,
  currentUserId: string | undefined,
): string {
  if (conv.type === "DIRECT" && currentUserId) {
    const other = conv.participants.find((p) => p.userId !== currentUserId);
    if (other?.displayName) return other.displayName;
  }
  if (conv.name?.trim()) return conv.name.trim();
  if (conv.participants.length) {
    return (
      conv.participants
        .filter((p) => p.userId !== currentUserId)
        .map((p) => p.displayName)
        .filter(Boolean)
        .join(", ") || "Conversation"
    );
  }
  return "Conversation";
}

export function searchUsers(params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<StaffSearchUser>> {
  const qs = buildListQuery(params);
  return api<unknown>(`/messages/users/search${qs ? `?${qs}` : ""}`).then(
    (res) => unwrapPage<StaffSearchUser>(res),
  );
}

export function listConversations(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<Paginated<ConversationListItem>> {
  const qs = buildListQuery(params ?? {});
  return api<unknown>(`/messages/conversations${qs ? `?${qs}` : ""}`).then(
    (res) => unwrapPage<ConversationListItem>(res),
  );
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return api<ConversationDetail>(`/messages/conversations/${id}`);
}

export function listMessages(
  conversationId: string,
  params?: { cursor?: string; limit?: number },
): Promise<MessagesPage> {
  const qs = buildListQuery(params ?? {});
  return api<MessagesPage>(
    `/messages/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
  );
}

export function sendMessage(
  conversationId: string,
  input: SendMessageInput,
): Promise<ChatMessage> {
  return api(`/messages/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Prefer WebSocket send; fall back to HTTP on failure / offline. */
export async function sendMessageLive(
  conversationId: string,
  input: SendMessageInput,
): Promise<ChatMessage> {
  try {
    const { sendMessageOverSocket } = await import("./realtime-client");
    const result = await sendMessageOverSocket({
      conversationId,
      ...input,
    });
    if (result.ok && result.message?.id) {
      return result.message as ChatMessage;
    }
  } catch {
    // fall through to HTTP
  }
  return sendMessage(conversationId, input);
}

export function attachmentContentUrl(attachmentId: string): string {
  return `${API_URL}/messages/attachments/${attachmentId}/content`;
}

export async function fetchAttachmentBlobUrl(
  attachmentId: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await authenticatedFetch(attachmentContentUrl(attachmentId), {
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, await parseError(res));
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } finally {
    clearTimeout(timer);
  }
}

export function createConversation(
  input: CreateConversationInput,
): Promise<ConversationDetail> {
  return api<ConversationDetail>("/messages/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function markRead(
  conversationId: string,
  upToMessageId: string,
): Promise<{ ok: boolean; upToMessageId: string }> {
  return api(`/messages/conversations/${conversationId}/read`, {
    method: "POST",
    body: JSON.stringify({ upToMessageId }),
  });
}

export function muteConversation(
  conversationId: string,
  muted: boolean,
): Promise<{ conversationId: string; muted: boolean }> {
  return api(`/messages/conversations/${conversationId}/mute`, {
    method: "PATCH",
    body: JSON.stringify({ muted }),
  });
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // ignore
  }
  return res.statusText || "Request failed";
}

export async function uploadAttachment(
  conversationId: string,
  file: File,
): Promise<AttachmentUploadRef> {
  const form = new FormData();
  form.append("file", file);
  const res = await authenticatedFetch(
    `${API_URL}/messages/conversations/${conversationId}/attachments`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json() as Promise<AttachmentUploadRef>;
}

export function addConversationParticipants(
  conversationId: string,
  userIds: string[],
): Promise<ConversationDetail> {
  return api(`/messages/conversations/${conversationId}/participants`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

export function removeConversationParticipant(
  conversationId: string,
  userId: string,
): Promise<ConversationDetail> {
  return api(
    `/messages/conversations/${conversationId}/participants/${userId}`,
    { method: "DELETE" },
  );
}

export function updateParticipantRole(
  conversationId: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): Promise<ConversationDetail> {
  return api(
    `/messages/conversations/${conversationId}/participants/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export function updateConversation(
  conversationId: string,
  input: { name: string },
): Promise<ConversationDetail> {
  return api(`/messages/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function downloadAttachment(
  attachmentId: string,
): Promise<AttachmentDownload> {
  return api<AttachmentDownload>(
    `/messages/attachments/${attachmentId}/download`,
  );
}

export function editMessage(
  messageId: string,
  body: string,
): Promise<{ id: string; body: string; editedAt: string | null }> {
  return api(`/messages/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export function deleteMessage(
  messageId: string,
): Promise<{ id: string; isDeleted: boolean }> {
  return api(`/messages/messages/${messageId}`, { method: "DELETE" });
}

export function addReaction(
  messageId: string,
  reactionType: string,
): Promise<{ id: string; reactionType: string }> {
  return api(`/messages/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reactionType }),
  });
}

export function removeReaction(
  messageId: string,
  reactionType: string,
): Promise<{ ok?: boolean }> {
  return api(
    `/messages/messages/${messageId}/reactions/${encodeURIComponent(reactionType)}`,
    { method: "DELETE" },
  );
}

export function markDelivered(
  messageIds: string[],
): Promise<{ updated: number }> {
  if (!messageIds.length) return Promise.resolve({ updated: 0 });
  return api("/messages/delivered", {
    method: "POST",
    body: JSON.stringify({ messageIds }),
  });
}

export function draftStorageKey(conversationId: string): string {
  return `nyalife.msg.draft.${conversationId}`;
}

export function loadDraft(conversationId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(draftStorageKey(conversationId)) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(conversationId: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = draftStorageKey(conversationId);
    if (!text.trim()) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, text);
  } catch {
    // ignore
  }
}

export function clearDraft(conversationId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(draftStorageKey(conversationId));
  } catch {
    // ignore
  }
}

export function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatConversationTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function sameCalendarDay(a: string, b: string): boolean {
  try {
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  } catch {
    return false;
  }
}

export function formatDateSeparator(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round(
      (startToday.getTime() - startMsg.getTime()) / 86_400_000,
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}
