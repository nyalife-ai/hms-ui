"use client";

import { PenSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConversationList } from "@/components/messaging/conversation-list";
import { MessageComposer } from "@/components/messaging/message-composer";
import { NewConversationModal } from "@/components/messaging/new-conversation-modal";
import { ThreadView } from "@/components/messaging/thread-view";
import { RoleGuard } from "@/components/role-guard";
import { Card, PageHeader, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  addReaction,
  deleteMessage,
  editMessage,
  getConversation,
  listConversations,
  listMessages,
  markDelivered,
  markRead,
  muteConversation,
  removeReaction,
  sendMessageLive,
  uploadAttachment,
  type ChatMessage,
  type ConversationListItem,
} from "@/lib/messaging";
import {
  connectRealtime,
  emitPresenceHeartbeat,
  joinRealtimeRoom,
  leaveRealtimeRoom,
  type RealtimeConnectionStatus,
} from "@/lib/realtime-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";

function mergeById(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
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
    map.set(m.id, prev ? { ...prev, ...m } : m);
  };

  for (const m of a) put(m);
  for (const m of b) put(m);

  return [...map.values()].sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
  );
}

function payloadToMessage(
  payload: Record<string, unknown>,
): ChatMessage | null {
  const id =
    (typeof payload.id === "string" && payload.id) ||
    (typeof payload.messageId === "string" && payload.messageId) ||
    null;
  const conversationId =
    typeof payload.conversationId === "string" ? payload.conversationId : null;
  if (!id || !conversationId) return null;

  // Ignore notification-center wake-ups (no chat body) so they cannot
  // overwrite a rich message.created already merged from MessagingService.
  const isRich =
    "body" in payload ||
    "attachments" in payload ||
    typeof payload.senderName === "string";
  if (!isRich) return null;

  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const a = raw as Record<string, unknown>;
          if (typeof a.id !== "string") return null;
          return {
            id: a.id,
            fileName: typeof a.fileName === "string" ? a.fileName : "file",
            mimeType: typeof a.mimeType === "string" ? a.mimeType : null,
            fileSize: typeof a.fileSize === "number" ? a.fileSize : null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    : [];

  return {
    id,
    conversationId,
    senderId: typeof payload.senderId === "string" ? payload.senderId : "",
    senderName:
      typeof payload.senderName === "string" ? payload.senderName : "Staff",
    messageType:
      typeof payload.messageType === "string" ? payload.messageType : "TEXT",
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
    attachments,
    reactions: Array.isArray(payload.reactions)
      ? (payload.reactions as ChatMessage["reactions"])
      : [],
    deliveryStatus:
      typeof payload.deliveryStatus === "string"
        ? payload.deliveryStatus
        : "SENT",
    clientMessageId:
      typeof payload.clientMessageId === "string"
        ? payload.clientMessageId
        : null,
    pending: false,
  };
}

function applyReactionLocal(
  messages: ChatMessage[],
  messageId: string,
  reactionType: string,
  userId: string,
  added: boolean,
): ChatMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    const reactions = [...(m.reactions ?? [])];
    const idx = reactions.findIndex((r) => r.reactionType === reactionType);
    if (added) {
      if (idx >= 0) {
        const r = reactions[idx]!;
        if (!r.userIds.includes(userId)) {
          reactions[idx] = { ...r, userIds: [...r.userIds, userId], count: r.count + 1 };
        }
      } else {
        reactions.push({ reactionType, count: 1, userIds: [userId] });
      }
    } else if (idx >= 0) {
      const r = reactions[idx]!;
      const userIds = r.userIds.filter((id) => id !== userId);
      if (!userIds.length) reactions.splice(idx, 1);
      else reactions[idx] = { ...r, userIds, count: userIds.length };
    }
    return { ...m, reactions };
  });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("c");
  const userId = user?.id;

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [selectedId, setSelectedId] = useState<string | null>(queryId);
  const [active, setActive] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>("disconnected");
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(queryId));

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const deliveredRef = useRef(new Set<string>());

  const refreshConversations = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const page = await listConversations({
        page: 1,
        limit: 50,
        search: debouncedSearch || undefined,
      });
      setConversations(page.items);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not load conversations");
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const bumpConversationPreview = useCallback(
    (
      conversationId: string,
      preview: string | null,
      createdAt: string,
      opts: { fromSelf: boolean; isActive: boolean },
    ) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conversationId);
        if (!existing) {
          void refreshConversations();
          return prev;
        }
        const unreadBump =
          !opts.fromSelf && !opts.isActive ? existing.unreadCount + 1 : existing.unreadCount;
        const next: ConversationListItem = {
          ...existing,
          preview: preview ?? existing.preview,
          updatedAt: createdAt,
          unreadCount: opts.isActive && !opts.fromSelf ? 0 : unreadBump,
        };
        return [next, ...prev.filter((c) => c.id !== conversationId)];
      });
    },
    [refreshConversations],
  );

  const loadThread = useCallback(
    async (conversationId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setThreadLoading(true);
      setThreadError(null);
      try {
        const [conv, page] = await Promise.all([
          getConversation(conversationId),
          listMessages(conversationId, { limit: 50 }),
        ]);
        setActive(conv);
        setMessages(page.items);
        setNextCursor(page.nextCursor);
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);

        const toDeliver = page.items
          .filter((m) => m.senderId !== userId && !m.isDeleted)
          .map((m) => m.id)
          .filter((id) => !deliveredRef.current.has(id));
        if (toDeliver.length) {
          toDeliver.forEach((id) => deliveredRef.current.add(id));
          void markDelivered(toDeliver);
        }

        const last = page.items[page.items.length - 1];
        if (last && conv.unreadCount > 0) {
          void markRead(conversationId, last.id).then(() => {
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
            );
            setActive((a) => (a?.id === conversationId ? { ...a, unreadCount: 0 } : a));
          });
        }
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Could not load messages");
      } finally {
        if (!opts?.silent) setThreadLoading(false);
      }
    },
    [userId],
  );

  const selectConversation = useCallback(
    (conv: ConversationListItem | string) => {
      const id = typeof conv === "string" ? conv : conv.id;
      setSelectedId(id);
      setMobileShowThread(true);
      setReplyTo(null);
      setTypingUsers({});
      router.replace(`/messages?c=${id}`, { scroll: false });
      if (typeof conv !== "string") setActive(conv);
      void loadThread(id);
    },
    [loadThread, router],
  );

  useEffect(() => {
    if (!queryId) return;
    if (selectedId === queryId && active?.id === queryId) return;
    selectConversation(queryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId]);

  useEffect(() => {
    if (!selectedId) return;
    joinRealtimeRoom(`conversation:${selectedId}`);
    return () => leaveRealtimeRoom(`conversation:${selectedId}`);
  }, [selectedId]);

  useEffect(() => {
    if (!user) return;
    const heartbeat = window.setInterval(() => emitPresenceHeartbeat(), 25_000);
    emitPresenceHeartbeat();

    const disconnect = connectRealtime({
      role: user.role,
      onStatus: setConnectionStatus,
      onReconnect: () => {
        void refreshConversations();
        if (selectedIdRef.current) void loadThread(selectedIdRef.current, { silent: true });
      },
      onEvent: (type, payload) => {
        const conversationId =
          typeof payload.conversationId === "string" ? payload.conversationId : null;
        const messageId =
          (typeof payload.messageId === "string" && payload.messageId) ||
          (typeof payload.id === "string" && payload.id) ||
          null;
        const activeId = selectedIdRef.current;

        if (type === "presence.updated") {
          const uid = typeof payload.userId === "string" ? payload.userId : null;
          const status = typeof payload.status === "string" ? payload.status : "";
          if (!uid) return;
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            if (status === "online") next.add(uid);
            else next.delete(uid);
            return next;
          });
          return;
        }

        if (type === "message.typing.started" || type === "message.typing.stopped") {
          const uid = typeof payload.userId === "string" ? payload.userId : null;
          if (!conversationId || !uid || uid === user.id || conversationId !== activeId) return;
          setTypingUsers((prev) => {
            const next = { ...prev };
            if (type === "message.typing.started") {
              next[uid] =
                typeof payload.displayName === "string" ? payload.displayName : "Someone";
            } else {
              delete next[uid];
            }
            return next;
          });
          return;
        }

        if (type === "message.created") {
          const mapped = payloadToMessage(payload);
          const preview =
            typeof payload.preview === "string"
              ? payload.preview
              : mapped?.body?.slice(0, 160) ?? null;
          const createdAt =
            mapped?.createdAt ??
            (typeof payload.createdAt === "string"
              ? payload.createdAt
              : new Date().toISOString());
          const fromSelf =
            (mapped?.senderId ??
              (typeof payload.senderId === "string" ? payload.senderId : "")) ===
            user.id;

          if (conversationId) {
            bumpConversationPreview(conversationId, preview, createdAt, {
              fromSelf,
              isActive: conversationId === activeId,
            });
          }

          if (mapped && conversationId === activeId) {
            setMessages((prev) => {
              const withoutOptimistic = mapped.clientMessageId
                ? prev.filter(
                    (m) =>
                      m.clientMessageId !== mapped.clientMessageId &&
                      m.id !== mapped.clientMessageId,
                  )
                : prev;
              return mergeById(withoutOptimistic, [mapped]);
            });

            if (!fromSelf && mapped.id && !deliveredRef.current.has(mapped.id)) {
              deliveredRef.current.add(mapped.id);
              void markDelivered([mapped.id]);
            }

            if (!fromSelf && mapped.id) {
              void markRead(conversationId!, mapped.id).then(() => {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === conversationId ? { ...c, unreadCount: 0 } : c,
                  ),
                );
                setActive((a) =>
                  a?.id === conversationId ? { ...a, unreadCount: 0 } : a,
                );
              });
            }
          }
          return;
        }

        if (type === "message.updated") {
          if (!conversationId || conversationId !== activeId || !messageId) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    body:
                      typeof payload.body === "string" ? payload.body : m.body,
                    editedAt:
                      typeof payload.editedAt === "string"
                        ? payload.editedAt
                        : m.editedAt,
                  }
                : m,
            ),
          );
          if (typeof payload.body === "string") {
            bumpConversationPreview(
              conversationId,
              payload.body.slice(0, 160),
              new Date().toISOString(),
              { fromSelf: true, isActive: true },
            );
          }
          return;
        }

        if (type === "message.deleted") {
          if (!conversationId || conversationId !== activeId || !messageId) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, isDeleted: true, body: null } : m,
            ),
          );
          return;
        }

        if (type === "message.delivered") {
          const ids = Array.isArray(payload.messageIds)
            ? payload.messageIds.filter((x): x is string => typeof x === "string")
            : [];
          if (!ids.length) return;
          if (conversationId && conversationId !== activeId) return;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.senderId !== user.id || !ids.includes(m.id)) return m;
              if (m.deliveryStatus === "READ") return m;
              return { ...m, deliveryStatus: "DELIVERED" };
            }),
          );
          return;
        }

        if (type === "message.reaction_added" || type === "message.reaction_removed") {
          if (!conversationId || conversationId !== activeId || !messageId) return;
          const reactionType =
            typeof payload.reactionType === "string" ? payload.reactionType : null;
          const uid = typeof payload.userId === "string" ? payload.userId : null;
          if (!reactionType || !uid) return;
          setMessages((prev) =>
            applyReactionLocal(prev, messageId, reactionType, uid, type === "message.reaction_added"),
          );
          return;
        }

        if (type === "conversation.read") {
          const readerId = typeof payload.userId === "string" ? payload.userId : null;
          const upTo =
            typeof payload.upToMessageId === "string" ? payload.upToMessageId : null;
          if (conversationId === activeId && readerId && readerId !== user.id && upTo) {
            setMessages((prev) => {
              const upToMsg = prev.find((m) => m.id === upTo);
              if (!upToMsg) return prev;
              const upToTs = new Date(upToMsg.createdAt).getTime();
              return prev.map((m) => {
                if (m.senderId !== user.id) return m;
                if (new Date(m.createdAt).getTime() > upToTs) return m;
                return { ...m, deliveryStatus: "READ" };
              });
            });
          }
          return;
        }

        if (type === "conversation.created" || type === "conversation.updated") {
          void refreshConversations();
        }
      },
    });

    return () => {
      disconnect();
      window.clearInterval(heartbeat);
    };
  }, [user, refreshConversations, loadThread, bumpConversationPreview]);

  const loadOlder = async () => {
    if (!selectedId || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(selectedId, { cursor: nextCursor, limit: 50 });
      setMessages((prev) => mergeById(page.items, prev));
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  };

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (!names.length) return null;
    if (names.length === 1) return `${names[0]} is typing…`;
    return "Several people are typing…";
  }, [typingUsers]);

  const handleSend = async (input: {
    body: string;
    parentMessageId?: string;
    file?: File | null;
  }) => {
    if (!selectedId || !user) return;
    const clientMessageId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}`;

    let attachmentRefs:
      | Array<{ key: string; fileName: string; mimeType?: string; fileSize?: number }>
      | undefined;

    if (input.file) {
      const uploaded = await uploadAttachment(selectedId, input.file);
      attachmentRefs = [
        {
          key: uploaded.key,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType ?? undefined,
          fileSize: uploaded.fileSize,
        },
      ];
    }

    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversationId: selectedId,
      senderId: user.id,
      senderName: user.name,
      messageType: attachmentRefs?.length ? "FILE" : "TEXT",
      body: input.body || null,
      isDeleted: false,
      editedAt: null,
      createdAt: new Date().toISOString(),
      parentMessageId: input.parentMessageId ?? null,
      parentPreview: replyTo?.preview ?? null,
      attachments: [],
      reactions: [],
      deliveryStatus: "SENT",
      clientMessageId,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    bumpConversationPreview(
      selectedId,
      input.body?.slice(0, 160) || (attachmentRefs?.length ? "Attachment" : null),
      optimistic.createdAt,
      { fromSelf: true, isActive: true },
    );

    try {
      const saved = await sendMessageLive(selectedId, {
        body: input.body || undefined,
        parentMessageId: input.parentMessageId,
        clientMessageId,
        attachmentRefs,
        messageType: attachmentRefs?.length ? "FILE" : "TEXT",
      });
      setMessages((prev) => {
        const withoutOptimistic = prev.filter(
          (m) =>
            m.clientMessageId !== clientMessageId && m.id !== clientMessageId,
        );
        const reconciled: ChatMessage = {
          ...optimistic,
          ...saved,
          id: saved.id,
          pending: false,
          deliveryStatus: saved.deliveryStatus ?? "SENT",
          body: saved.body ?? optimistic.body,
          attachments: saved.attachments?.length
            ? saved.attachments
            : optimistic.attachments,
          clientMessageId,
        };
        return mergeById(withoutOptimistic, [reconciled]);
      });
      setReplyTo(null);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
      throw err;
    }
  };

  const handleReact = async (message: ChatMessage, reactionType: string) => {
    if (!userId) return;
    const mine = message.reactions?.some(
      (r) => r.reactionType === reactionType && r.userIds.includes(userId),
    );
    setMessages((prev) => applyReactionLocal(prev, message.id, reactionType, userId, !mine));
    try {
      if (mine) await removeReaction(message.id, reactionType);
      else await addReaction(message.id, reactionType);
    } catch {
      void loadThread(message.conversationId, { silent: true });
    }
  };

  const handleEdit = async (message: ChatMessage) => {
    const next = window.prompt("Edit message", message.body ?? "");
    if (next == null || next.trim() === (message.body ?? "")) return;
    try {
      const updated = await editMessage(message.id, next.trim());
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, body: updated.body, editedAt: updated.editedAt } : m,
        ),
      );
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not edit message");
    }
  };

  const handleDelete = async (message: ChatMessage) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessage(message.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, isDeleted: true, body: null } : m)),
      );
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not delete message");
    }
  };

  const handleMute = async () => {
    if (!active) return;
    const next = !active.muted;
    try {
      await muteConversation(active.id, next);
      setActive({ ...active, muted: next });
      setConversations((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, muted: next } : c)),
      );
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not update mute");
    }
  };

  const clearSelection = () => {
    setSelectedId(null);
    setActive(null);
    setMessages([]);
    setMobileShowThread(false);
    setReplyTo(null);
    router.replace("/messages", { scroll: false });
  };

  return (
    <RoleGuard module="messages">
      <PageHeader
        title="Messages"
        subtitle="Secure care-team conversations"
        action={
          <PrimaryButton onClick={() => setNewOpen(true)}>
            <PenSquare className="h-4 w-4" /> New message
          </PrimaryButton>
        }
      />

      {connectionStatus === "reconnecting" ? (
        <div
          className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          role="status"
        >
          Reconnecting… messages will sync when you are back online.
        </div>
      ) : null}

      <div className="grid h-[calc(100dvh-11rem)] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card
          className={`flex min-h-0 flex-col overflow-hidden ${
            mobileShowThread ? "hidden lg:flex" : "flex"
          }`}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            currentUserId={userId}
            search={search}
            onSearchChange={setSearch}
            onSelect={selectConversation}
            loading={listLoading}
            error={listError}
            onlineUserIds={onlineUserIds}
          />
        </Card>

        <Card
          className={`flex min-h-0 flex-col overflow-hidden ${
            mobileShowThread ? "flex" : "hidden lg:flex"
          }`}
        >
          {active && selectedId ? (
            <>
              <div className="min-h-0 flex-1">
                <ThreadView
                  conversation={active}
                  currentUserId={userId}
                  messages={messages}
                  loading={threadLoading}
                  loadingOlder={loadingOlder}
                  hasOlder={Boolean(nextCursor)}
                  error={threadError}
                  typingLabel={typingLabel}
                  muted={active.muted}
                  onBack={clearSelection}
                  onLoadOlder={loadOlder}
                  onReply={(m) =>
                    setReplyTo({
                      id: m.id,
                      preview: m.body?.slice(0, 120) || "Attachment",
                    })
                  }
                  onReact={handleReact}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMuteToggle={handleMute}
                />
              </div>
              <MessageComposer
                conversationId={selectedId}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
                onSend={handleSend}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-5 py-16 text-sm text-slate-400">
              Select a conversation or start a new one.
            </div>
          )}
        </Card>
      </div>

      <NewConversationModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          void refreshConversations().then(() => selectConversation(id));
        }}
      />
    </RoleGuard>
  );
}
