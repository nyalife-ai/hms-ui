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
import { ForwardMessageModal } from "@/components/messaging/forward-message-modal";
import { GroupMembersSheet } from "@/components/messaging/group-members-sheet";
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
  type MessageType,
} from "@/lib/messaging";
import {
  mergeMessagesById,
  normalizeChatMessage,
} from "@/lib/message-normalize";
import {
  playMessageReceivedSound,
  playMessageSentSound,
} from "@/lib/notification-sound";
import { fetchNotificationPreferences } from "@/lib/notifications";
import {
  connectRealtime,
  emitPresenceHeartbeat,
  joinRealtimeRoom,
  leaveRealtimeRoom,
  type RealtimeConnectionStatus,
} from "@/lib/realtime-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";

function inferMessageTypeFromMime(mime?: string | null): MessageType {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "IMAGE";
  if (m.startsWith("video/")) return "VIDEO";
  if (m.startsWith("audio/")) return "AUDIO";
  if (mime) return "FILE";
  return "TEXT";
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
  const [membersOpen, setMembersOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>("disconnected");
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(queryId));
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(
    null,
  );
  const [messageSoundsEnabled, setMessageSoundsEnabled] = useState(true);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const deliveredRef = useRef(new Set<string>());
  const highlightTimerRef = useRef<number | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;

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

  useEffect(() => {
    let cancelled = false;
    void fetchNotificationPreferences()
      .then((prefs) => {
        if (!cancelled) setMessageSoundsEnabled(prefs.notificationSoundEnabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

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
          const mapped = normalizeChatMessage(payload);
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
              return mergeMessagesById(withoutOptimistic, [mapped]);
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
              if (
                messageSoundsEnabled &&
                typeof document !== "undefined" &&
                document.visibilityState === "visible"
              ) {
                void playMessageReceivedSound();
              }
            }
          }
          return;
        }

        // Notification-center wake-ups (distinct from rich message.created).
        if (type === "message.notification" || type === "message.mention") {
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
          const action =
            typeof payload.action === "string" ? payload.action : null;
          const participants = Array.isArray(payload.participants)
            ? (payload.participants as ConversationListItem["participants"])
            : null;

          if (
            conversationId &&
            participants &&
            (action === "participants.added" ||
              action === "participants.removed" ||
              action === "participant.role_updated" ||
              action === "conversation.updated")
          ) {
            const stillIn = participants.some((p) => p.userId === user.id);
            const name =
              typeof payload.name === "string" ? payload.name : undefined;
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      participants,
                      ...(name !== undefined ? { name } : {}),
                      updatedAt: new Date().toISOString(),
                    }
                  : c,
              ),
            );
            setActive((a) => {
              if (!a || a.id !== conversationId) return a;
              if (!stillIn) return a;
              return {
                ...a,
                participants,
                ...(name !== undefined ? { name } : {}),
              };
            });
            if (!stillIn && selectedIdRef.current === conversationId) {
              setSelectedId(null);
              setActive(null);
              setMessages([]);
              setMembersOpen(false);
              setMobileShowThread(false);
            }
          }
          void refreshConversations();
        }
      },
    });

    return () => {
      disconnect();
      window.clearInterval(heartbeat);
    };
  }, [user, refreshConversations, loadThread, bumpConversationPreview, messageSoundsEnabled]);

  const loadOlder = async () => {
    if (!selectedId || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(selectedId, { cursor: nextCursor, limit: 50 });
      setMessages((prev) => mergeMessagesById(page.items, prev));
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  };

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      if (!selectedId) return;
      let found = messagesRef.current.some((m) => m.id === messageId);
      let guard = 0;
      while (!found && nextCursorRef.current && guard < 20) {
        guard += 1;
        const cursor = nextCursorRef.current;
        setLoadingOlder(true);
        try {
          const page = await listMessages(selectedId, {
            cursor,
            limit: 50,
          });
          setMessages((prev) => mergeMessagesById(page.items, prev));
          setNextCursor(page.nextCursor);
          nextCursorRef.current = page.nextCursor;
          found = page.items.some((m) => m.id === messageId) ||
            messagesRef.current.some((m) => m.id === messageId);
          if (!page.nextCursor) break;
        } finally {
          setLoadingOlder(false);
        }
      }
      setHighlightedMessageId(messageId);
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2500);
    },
    [selectedId],
  );

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (!names.length) return null;
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return "Several people are typing…";
  }, [typingUsers]);

  const handleSend = async (input: {
    body: string;
    parentMessageId?: string;
    file?: File | null;
    mentionedUserIds?: string[];
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

    const mime =
      attachmentRefs?.[0]?.mimeType ?? input.file?.type ?? null;
    const messageType = inferMessageTypeFromMime(mime);
    const localPreviewUrl = input.file
      ? URL.createObjectURL(input.file)
      : undefined;

    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversationId: selectedId,
      senderId: user.id,
      senderName: user.name,
      messageType,
      body: input.body || null,
      isDeleted: false,
      editedAt: null,
      createdAt: new Date().toISOString(),
      parentMessageId: input.parentMessageId ?? null,
      parentPreview: replyTo?.preview ?? null,
      mentions: (input.mentionedUserIds ?? []).map((userId) => {
        const p = active?.participants.find((x) => x.userId === userId);
        return { userId, displayName: p?.displayName ?? "Staff" };
      }),
      attachments: input.file
        ? [
            {
              id: `local-${clientMessageId}`,
              fileName: input.file.name,
              mimeType: input.file.type || null,
              fileSize: input.file.size,
              previewUrl: localPreviewUrl,
            },
          ]
        : [],
      reactions: [],
      deliveryStatus: "SENT",
      clientMessageId,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    bumpConversationPreview(
      selectedId,
      input.body?.slice(0, 160) ||
        (attachmentRefs?.length
          ? mime?.startsWith("image/")
            ? "📷 Image"
            : mime?.startsWith("video/")
              ? "🎬 Video"
              : mime?.startsWith("audio/")
                ? "🎤 Voice message"
                : "📎 Attachment"
          : null),
      optimistic.createdAt,
      { fromSelf: true, isActive: true },
    );

    try {
      const saved = await sendMessageLive(selectedId, {
        body: input.body || undefined,
        parentMessageId: input.parentMessageId,
        clientMessageId,
        attachmentRefs,
        messageType,
        mentionedUserIds: input.mentionedUserIds,
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
          messageType: saved.messageType || messageType,
          attachments: saved.attachments?.length
            ? saved.attachments.map((a, i) => ({
                ...a,
                // Keep local object URL until authenticated blob fetch replaces it.
                previewUrl:
                  a.previewUrl ??
                  optimistic.attachments[i]?.previewUrl ??
                  localPreviewUrl,
              }))
            : optimistic.attachments,
          mentions: saved.mentions?.length
            ? saved.mentions
            : optimistic.mentions,
          clientMessageId,
        };
        return mergeMessagesById(withoutOptimistic, [reconciled]);
      });
      // Revoke after a delay so the player/image can start from previewUrl.
      if (localPreviewUrl) {
        window.setTimeout(() => URL.revokeObjectURL(localPreviewUrl), 60_000);
      }
      setReplyTo(null);
      if (messageSoundsEnabled) void playMessageSentSound();
    } catch (err) {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
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

  const handleEdit = async (message: ChatMessage, body: string) => {
    const next = body.trim();
    if (!next || next === (message.body ?? "")) return;
    try {
      const updated = await editMessage(message.id, next);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, body: updated.body, editedAt: updated.editedAt }
            : m,
        ),
      );
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not edit message");
      throw err;
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
                  highlightedMessageId={highlightedMessageId}
                  onBack={clearSelection}
                  onLoadOlder={loadOlder}
                  onJumpToMessage={(id) => void jumpToMessage(id)}
                  onReply={(m) =>
                    setReplyTo({
                      id: m.id,
                      preview:
                        m.body?.slice(0, 120) ||
                        (m.attachments?.[0]
                          ? m.attachments[0].mimeType?.startsWith("image/")
                            ? "📷 Image"
                            : m.attachments[0].mimeType?.startsWith("video/")
                              ? "🎬 Video"
                              : m.attachments[0].mimeType?.startsWith("audio/")
                                ? "🎤 Voice message"
                                : `📎 ${m.attachments[0].fileName}`
                          : "Attachment"),
                    })
                  }
                  onReact={handleReact}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onForward={(m) => setForwardMessage(m)}
                  onMuteToggle={handleMute}
                  onOpenParticipants={() => setMembersOpen(true)}
                />
              </div>
              <MessageComposer
                conversationId={selectedId}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
                onSend={handleSend}
                participants={active.participants}
                currentUserId={userId}
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

      <GroupMembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        conversation={active}
        currentUserId={userId}
        currentUserSystemRole={user?.role}
        onUpdated={(conv) => {
          const stillIn = conv.participants.some((p) => p.userId === userId);
          if (!stillIn) {
            setMembersOpen(false);
            clearSelection();
            void refreshConversations();
            return;
          }
          setActive(conv);
          setConversations((prev) =>
            prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)),
          );
        }}
      />

      <ForwardMessageModal
        open={Boolean(forwardMessage)}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
        currentUserId={userId}
        excludeConversationId={selectedId ?? undefined}
        onForwarded={(id) => {
          void refreshConversations().then(() => selectConversation(id));
        }}
      />
    </RoleGuard>
  );
}
