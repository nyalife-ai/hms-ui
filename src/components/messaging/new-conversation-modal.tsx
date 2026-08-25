"use client";

import { Check, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Avatar, PrimaryButton } from "@/components/ui";
import {
  createConversation,
  searchUsers,
  type StaffSearchUser,
} from "@/lib/messaging";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export function NewConversationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const [mode, setMode] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<StaffSearchUser[]>([]);
  const [selected, setSelected] = useState<StaffSearchUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("DIRECT");
    setQuery("");
    setResults([]);
    setSelected([]);
    setGroupName("");
    setInitialMessage("");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    void searchUsers({ q, page: 1, limit: 20 })
      .then((page) => {
        if (!cancelled) setResults(page.items);
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
  }, [debounced, open]);

  const toggle = (user: StaffSearchUser) => {
    setSelected((prev) => {
      const exists = prev.some((p) => p.userId === user.userId);
      if (mode === "DIRECT") return exists ? [] : [user];
      if (exists) return prev.filter((p) => p.userId !== user.userId);
      return [...prev, user];
    });
  };

  const submit = async () => {
    if (!selected.length) {
      setError("Select at least one colleague.");
      return;
    }
    if (mode === "DIRECT" && selected.length !== 1) {
      setError("Direct messages include exactly one person.");
      return;
    }
    if (mode === "GROUP" && !groupName.trim()) {
      setError("Group name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const conv = await createConversation({
        type: mode,
        participantIds: selected.map((s) => s.userId),
        name: mode === "GROUP" ? groupName.trim() : undefined,
        initialMessage: initialMessage.trim() || undefined,
      });
      onCreated(conv.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start conversation",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New conversation" size="md">
      <div className="space-y-4 px-5 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("DIRECT");
              setSelected((s) => s.slice(0, 1));
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              mode === "DIRECT"
                ? "bg-brand-500 text-white"
                : "bg-surface-200 text-foreground-light"
            }`}
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setMode("GROUP")}
            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              mode === "GROUP"
                ? "bg-brand-500 text-white"
                : "bg-surface-200 text-foreground-light"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Group
          </button>
        </div>

        {mode === "GROUP" ? (
          <input
            className={inputClass}
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        ) : null}

        <div>
          <label
            htmlFor="staff-search"
            className="mb-1.5 block text-xs font-medium text-foreground-light"
          >
            Find colleagues
          </label>
          <input
            id="staff-search"
            className={inputClass}
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <button
                key={s.userId}
                type="button"
                onClick={() => toggle(s)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {s.displayName}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        ) : null}

        <ul className="max-h-52 overflow-y-auto rounded-xl border border-border">
          {searching ? (
            <li className="px-3 py-4 text-center text-xs text-foreground-lighter">
              Searching…
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-foreground-lighter">
              {query.trim() ? "No matches" : "Type a name to search"}
            </li>
          ) : (
            results.map((u) => {
              const isSelected = selected.some((s) => s.userId === u.userId);
              return (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => toggle(u)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-200 ${
                      isSelected ? "bg-brand-50/60" : ""
                    }`}
                  >
                    <Avatar name={u.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.displayName}
                      </p>
                      <p className="truncate text-xs text-foreground-lighter">
                        {u.role}
                        {u.department ? ` · ${u.department}` : ""}
                        {u.online ? " · Online" : ""}
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-brand-600" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <textarea
          className={`${inputClass} min-h-[72px] resize-y`}
          placeholder="Optional opening message"
          value={initialMessage}
          onChange={(e) => setInitialMessage(e.target.value)}
        />

        {error ? (
          <p className="text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}

        <PrimaryButton disabled={busy} onClick={() => void submit()}>
          {busy ? "Starting…" : "Start conversation"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
