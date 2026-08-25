"use client";

import {
  Loader2,
  Shield,
  ShieldOff,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/ui";
import {
  addConversationParticipants,
  removeConversationParticipant,
  searchUsers,
  updateConversation,
  updateParticipantRole,
  type ConversationListItem,
  type ConversationParticipant,
  type StaffSearchUser,
} from "@/lib/messaging";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const MANAGEABLE = new Set(["GROUP", "DEPARTMENT", "TEAM"]);

export function GroupMembersSheet({
  open,
  onClose,
  conversation,
  currentUserId,
  currentUserSystemRole,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  conversation: ConversationListItem | null;
  currentUserId?: string;
  currentUserSystemRole?: string;
  onUpdated: (conversation: ConversationListItem) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<StaffSearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  const canManageType = conversation
    ? MANAGEABLE.has(String(conversation.type))
    : false;

  const myMembership = conversation?.participants.find(
    (p) => p.userId === currentUserId,
  );
  const isConvAdmin =
    myMembership?.participantRole === "ADMIN" ||
    currentUserSystemRole === "SUPER_ADMIN";

  const memberIds = useMemo(
    () => new Set(conversation?.participants.map((p) => p.userId) ?? []),
    [conversation],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError("");
      setAdding(false);
      setRenaming(false);
    } else if (conversation) {
      setNameDraft(conversation.name ?? "");
    }
  }, [open, conversation]);

  useEffect(() => {
    if (!open || !adding) return;
    const q = debounced.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    void searchUsers({ q, page: 1, limit: 20 })
      .then((page) => {
        if (!cancelled) {
          setResults(page.items.filter((u) => !memberIds.has(u.userId)));
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, adding, memberIds]);

  if (!conversation || !canManageType) return null;

  const addUser = async (user: StaffSearchUser) => {
    setBusyId(user.userId);
    setError("");
    try {
      const updated = await addConversationParticipants(conversation.id, [
        user.userId,
      ]);
      onUpdated(updated);
      setQuery("");
      setResults((prev) => prev.filter((r) => r.userId !== user.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (userId: string, label: string) => {
    const leaving = userId === currentUserId;
    const ok = window.confirm(
      leaving
        ? "Leave this conversation?"
        : `Remove ${label} from this conversation?`,
    );
    if (!ok) return;
    setBusyId(userId);
    setError("");
    try {
      const updated = await removeConversationParticipant(
        conversation.id,
        userId,
      );
      onUpdated(updated);
      if (leaving) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update members");
    } finally {
      setBusyId(null);
    }
  };

  const setRole = async (
    userId: string,
    role: "ADMIN" | "MEMBER",
    label: string,
  ) => {
    const ok = window.confirm(
      role === "ADMIN"
        ? `Make ${label} a group admin?`
        : `Remove admin privileges from ${label}?`,
    );
    if (!ok) return;
    setBusyId(userId);
    setError("");
    try {
      const updated = await updateParticipantRole(
        conversation.id,
        userId,
        role,
      );
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusyId(null);
    }
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next || next === (conversation.name ?? "")) {
      setRenaming(false);
      return;
    }
    setBusyId("rename");
    setError("");
    try {
      const updated = await updateConversation(conversation.id, { name: next });
      onUpdated(updated);
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename group");
    } finally {
      setBusyId(null);
    }
  };

  const roleBadge = (p: ConversationParticipant) => {
    const pr = p.participantRole ?? "MEMBER";
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          pr === "ADMIN"
            ? "bg-brand-50 text-brand-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {pr}
      </span>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Group details" size="sm">
      <div className="space-y-4 px-5 py-4">
        {error ? (
          <p className="text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
          {renaming && isConvAdmin ? (
            <div className="flex gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                aria-label="Group name"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void saveName()}
                disabled={busyId === "rename"}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Group name
                </p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {conversation.name || "Untitled group"}
                </p>
              </div>
              {isConvAdmin ? (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
                >
                  Edit
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Members ({conversation.participants.length})
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {conversation.participants.map((p) => {
              const isSelf = p.userId === currentUserId;
              const isAdmin = (p.participantRole ?? "MEMBER") === "ADMIN";
              const canRemove =
                isSelf || (isConvAdmin && p.userId !== currentUserId);
              const canChangeRole = isConvAdmin && !isSelf;
              return (
                <li
                  key={p.userId}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <Avatar name={p.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {p.displayName}
                      {isSelf ? (
                        <span className="ml-1 text-xs text-slate-400">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-slate-400">{p.role}</p>
                  </div>
                  {roleBadge(p)}
                  <div className="flex items-center gap-0.5">
                    {canChangeRole ? (
                      <button
                        type="button"
                        disabled={busyId === p.userId}
                        onClick={() =>
                          void setRole(
                            p.userId,
                            isAdmin ? "MEMBER" : "ADMIN",
                            p.displayName,
                          )
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                        aria-label={
                          isAdmin ? "Demote to member" : "Promote to admin"
                        }
                        title={isAdmin ? "Demote" : "Make admin"}
                      >
                        {busyId === p.userId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isAdmin ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    {canRemove ? (
                      <button
                        type="button"
                        disabled={busyId === p.userId}
                        onClick={() => void removeUser(p.userId, p.displayName)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        aria-label={
                          isSelf ? "Leave conversation" : "Remove member"
                        }
                        title={isSelf ? "Leave" : "Remove"}
                      >
                        {busyId === p.userId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {isConvAdmin ? (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
              >
                <UserPlus className="h-4 w-4" /> Add member
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search staff…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setQuery("");
                      setResults([]);
                    }}
                    className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-50"
                    aria-label="Cancel add"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {searching ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                  </div>
                ) : null}
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {results.map((u) => (
                    <li key={u.userId}>
                      <button
                        type="button"
                        disabled={busyId === u.userId}
                        onClick={() => void addUser(u)}
                        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-brand-50 disabled:opacity-40"
                      >
                        <Avatar name={u.displayName} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                          {u.displayName}
                        </span>
                        {busyId === u.userId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5 text-brand-600" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              currentUserId
                ? void removeUser(currentUserId, "yourself")
                : undefined
            }
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            Leave group
          </button>
        )}
      </div>
    </Modal>
  );
}
