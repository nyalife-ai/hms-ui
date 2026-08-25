"use client";

import { Paperclip, Send, Smile, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type ConversationParticipant,
} from "@/lib/messaging";
import { emitTyping } from "@/lib/realtime-client";
import { EmojiPicker } from "./emoji-picker";
import {
  VoiceMicButton,
  VoiceRecorder,
  type VoiceRecorderHandle,
} from "./voice-recorder";

export type ComposerReply = {
  id: string;
  preview: string;
} | null;

export function MessageComposer({
  conversationId,
  replyTo,
  onClearReply,
  onSend,
  disabled,
  participants = [],
  currentUserId,
}: {
  conversationId: string;
  replyTo: ComposerReply;
  onClearReply: () => void;
  onSend: (input: {
    body: string;
    parentMessageId?: string;
    file?: File | null;
    mentionedUserIds?: string[];
  }) => Promise<void>;
  disabled?: boolean;
  participants?: ConversationParticipant[];
  currentUserId?: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<VoiceRecorderHandle>(null);
  const typingTimer = useRef<number | null>(null);
  const typingActive = useRef(false);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return participants
      .filter((p) => p.userId !== currentUserId)
      .filter((p) => !q || p.displayName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [participants, currentUserId, mentionQuery]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current != null) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    if (typingActive.current) {
      emitTyping(conversationId, "stopped");
      typingActive.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    setText(loadDraft(conversationId));
    setFile(null);
    setFilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError("");
    setEmojiOpen(false);
    setMentionedIds(new Set());
    setMentionQuery(null);
    setMentionStart(null);
    stopTyping();
  }, [conversationId, stopTyping]);

  useEffect(() => {
    saveDraft(conversationId, text);
  }, [conversationId, text]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const setAttachment = (next: File | null) => {
    setFilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      if (next && next.type.startsWith("audio/")) {
        return URL.createObjectURL(next);
      }
      return null;
    });
    setFile(next);
  };

  const bumpTyping = () => {
    if (!typingActive.current) {
      emitTyping(conversationId, "started");
      typingActive.current = true;
    }
    if (typingTimer.current != null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => stopTyping(), 1800);
  };

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = before.match(/(^|\s)@([^\s@]*)$/);
    if (!match) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    const start = caret - (match[2]?.length ?? 0) - 1;
    setMentionStart(start);
    setMentionQuery(match[2] ?? "");
    setMentionIndex(0);
  };

  const insertMention = (p: ConversationParticipant) => {
    const el = taRef.current;
    const start = mentionStart ?? text.length;
    const caret = el?.selectionStart ?? text.length;
    const insert = `@${p.displayName} `;
    const next = text.slice(0, start) + insert + text.slice(caret);
    setText(next);
    setMentionedIds((prev) => new Set(prev).add(p.userId));
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + insert.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const insertEmoji = (emoji: string) => {
    const el = taRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const body = text.trim();
    if ((!body && !file) || busy || disabled) return;
    setBusy(true);
    setError("");
    stopTyping();
    try {
      const mentionedUserIds = [...mentionedIds].filter((id) =>
        participants.some((p) => p.userId === id),
      );
      await onSend({
        body,
        parentMessageId: replyTo?.id,
        file,
        mentionedUserIds: mentionedUserIds.length
          ? mentionedUserIds
          : undefined,
      });
      setText("");
      setAttachment(null);
      setMentionedIds(new Set());
      clearDraft(conversationId);
      onClearReply();
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery != null && mentionCandidates.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = mentionCandidates[mentionIndex];
        if (pick) insertMention(pick);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        setMentionStart(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const canSend = Boolean(text.trim() || file) && !busy && !disabled;

  return (
    <div className="sticky bottom-0 shrink-0 border-t border-border bg-white px-3 py-3 sm:px-4">
      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-xs text-foreground-light">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-700">Replying</p>
            <p className="truncate">{replyTo.preview}</p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="rounded-lg p-1 text-foreground-lighter hover:bg-white hover:text-foreground-light"
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <VoiceRecorder
        ref={voiceRef}
        disabled={busy || disabled || Boolean(file)}
        onReady={(f) => setAttachment(f)}
        onError={setError}
        onBusyChange={setVoiceBusy}
      />

      {file ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-surface-200 px-3 py-2 text-xs text-foreground-light">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          {filePreviewUrl ? (
            <audio controls src={filePreviewUrl} className="h-8 max-w-[10rem]" />
          ) : null}
          <button
            type="button"
            onClick={() => {
              setAttachment(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-lg p-1 text-foreground-lighter hover:bg-white"
            aria-label="Remove attachment"
            title="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mb-2 text-xs text-rose-500" role="alert">
          {error}
        </p>
      ) : null}

      <div className="relative flex items-end gap-2">
        {mentionQuery != null && mentionCandidates.length ? (
          <ul
            className="absolute bottom-full left-12 z-20 mb-1 max-h-48 w-64 overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg"
            role="listbox"
          >
            {mentionCandidates.map((p, i) => (
              <li key={p.userId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={`flex w-full px-3 py-2 text-left text-sm ${
                    i === mentionIndex
                      ? "bg-brand-50 text-brand-800"
                      : "text-foreground hover:bg-surface-200"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(p);
                  }}
                >
                  @{p.displayName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            className="rounded-full border border-border p-2.5 text-foreground-light hover:border-brand-300 hover:text-brand-600"
            aria-label="Insert emoji"
            title="Emoji"
            aria-expanded={emojiOpen}
          >
            <Smile className="h-4 w-4" />
          </button>
          {emojiOpen ? (
            <EmojiPicker
              onSelect={(e) => {
                insertEmoji(e);
                setEmojiOpen(false);
              }}
              onClose={() => setEmojiOpen(false)}
            />
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-border p-2.5 text-foreground-light hover:border-brand-300 hover:text-brand-600"
          aria-label="Attach file"
          title="Attach file"
          disabled={busy || disabled || voiceBusy}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <VoiceMicButton
          disabled={busy || disabled || Boolean(file) || voiceBusy}
          onClick={() => voiceRef.current?.start()}
        />

        <label className="sr-only" htmlFor="msg-composer">
          Message
        </label>
        <textarea
          id="msg-composer"
          ref={taRef}
          rows={1}
          value={text}
          disabled={busy || disabled}
          placeholder="Write a message… Use @ to mention"
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            bumpTyping();
            detectMention(value, e.target.selectionStart ?? value.length);
          }}
          onKeyDown={onKeyDown}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        />

        <button
          type="button"
          disabled={!canSend}
          onClick={() => void submit()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
          title="Send"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
}
