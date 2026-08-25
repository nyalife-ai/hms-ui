"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/ui";
import {
  conversationDisplayName,
  listConversations,
  sendMessageLive,
  type ChatMessage,
  type ConversationListItem,
} from "@/lib/messaging";

export function ForwardMessageModal({
  open,
  onClose,
  message,
  currentUserId,
  excludeConversationId,
  onForwarded,
}: {
  open: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  currentUserId?: string;
  excludeConversationId?: string;
  onForwarded?: (conversationId: string) => void;
}) {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setQ("");
    setLoading(true);
    void listConversations({ page: 1, limit: 50 })
      .then((page) => setItems(page.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((c) => {
      if (c.id === excludeConversationId) return false;
      if (!needle) return true;
      const name = conversationDisplayName(c, currentUserId).toLowerCase();
      return name.includes(needle);
    });
  }, [items, q, excludeConversationId, currentUserId]);

  const forward = async (conversationId: string) => {
    if (!message) return;
    const body =
      message.body?.trim() ||
      (message.attachments?.[0]?.fileName
        ? `[Attachment: ${message.attachments[0].fileName}]`
        : "[Forwarded message]");
    setBusyId(conversationId);
    setError("");
    try {
      await sendMessageLive(conversationId, {
        body: `Forwarded: ${body}`,
        messageType: "TEXT",
      });
      onForwarded?.(conversationId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not forward");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Forward to conversation" size="sm">
      <div className="space-y-3 px-5 py-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        />
        {error ? (
          <p className="text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          </div>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {filtered.map((c) => {
              const name = conversationDisplayName(c, currentUserId);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={busyId != null}
                    onClick={() => void forward(c.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand-50 disabled:opacity-50"
                  >
                    <Avatar name={name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                      {name}
                    </span>
                    {busyId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                    ) : (
                      <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white">
                        Send
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {!filtered.length ? (
              <li className="py-6 text-center text-sm text-slate-400">
                No conversations found
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </Modal>
  );
}
