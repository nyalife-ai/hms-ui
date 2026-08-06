"use client";

import { PenSquare, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Card, PageHeader, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useConversations, type CatalogConversation } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ThreadMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const { data: conversations, loading, error, refresh } = useConversations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState("");
  const [formError, setFormError] = useState("");
  const [selected, setSelected] = useState<CatalogConversation | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [threadError, setThreadError] = useState("");

  const loadThread = useCallback(async (conversationId: string) => {
    try {
      const rows = await api<ThreadMessage[]>(`/ops/conversations/${conversationId}/messages`);
      setMessages(rows);
      setThreadError("");
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not load messages");
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    void loadThread(selected.id);
    const id = window.setInterval(() => void loadThread(selected.id), 10_000);
    return () => window.clearInterval(id);
  }, [selected, loadThread]);

  const submit = async () => {
    if (!name.trim()) {
      setFormError("Conversation name is required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const created = await api<{ id: string }>("/ops/conversations", {
        method: "POST",
        body: JSON.stringify({ name, preview: preview || undefined }),
      });
      setOpen(false);
      setName("");
      setPreview("");
      await refresh();
      const next = { id: created.id, with: name, preview: preview || "Conversation started", time: "now", unread: 0 };
      setSelected(next);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setBusy(true);
    try {
      await api(`/ops/conversations/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      await loadThread(selected.id);
      await refresh();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="messages">
      <PageHeader
        title="Messages"
        subtitle={loading ? "Loading…" : "Internal conversations and care-team updates"}
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <PenSquare className="h-4 w-4" /> New message
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          {error && <p className="px-5 py-3 text-sm text-rose-500">{error}</p>}
          <ul className="divide-y divide-slate-50">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/60 ${
                    selected?.id === c.id ? "bg-brand-50/70" : ""
                  }`}
                >
                  <Avatar name={c.with} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium text-slate-800">{c.with}</p>
                      <span className="ml-3 shrink-0 text-xs text-slate-400">{c.time}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{c.preview}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                      {c.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!loading && conversations.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No conversations yet.</p>
          )}
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          {selected ? (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">{selected.with}</p>
                <p className="text-xs text-slate-400">Care-team thread</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {threadError && <p className="text-sm text-rose-500">{threadError}</p>}
                {messages.length === 0 && !threadError && (
                  <p className="text-sm text-slate-400">No messages yet — send the first update.</p>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          mine ? "bg-brand-500 text-white" : "bg-[#f3f7f7] text-slate-700"
                        }`}
                      >
                        {!mine && (
                          <p className="mb-1 text-[11px] font-semibold opacity-70">{m.senderName}</p>
                        )}
                        <p>{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
                <input
                  className={inputClass}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void send()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-5 py-16 text-sm text-slate-400">
              Select a conversation or start a new one.
            </div>
          )}
        </Card>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">New conversation</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input className={inputClass} placeholder="With (name)" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={inputClass} placeholder="Opening message" value={preview} onChange={(e) => setPreview(e.target.value)} />
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Creating…" : "Start conversation"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
