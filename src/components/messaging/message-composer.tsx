"use client";

import { Paperclip, Send, Smile, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ALLOWED_REACTIONS,
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/lib/messaging";
import { emitTyping } from "@/lib/realtime-client";

const COMPOSER_EMOJIS = [
  ...ALLOWED_REACTIONS,
  "😊",
  "🎉",
  "👏",
  "🔥",
  "✅",
  "👋",
  "💪",
  "🤝",
];

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
}: {
  conversationId: string;
  replyTo: ComposerReply;
  onClearReply: () => void;
  onSend: (input: {
    body: string;
    parentMessageId?: string;
    file?: File | null;
  }) => Promise<void>;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);
  const typingActive = useRef(false);

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
    setError("");
    setEmojiOpen(false);
    stopTyping();
  }, [conversationId, stopTyping]);

  useEffect(() => {
    saveDraft(conversationId, text);
  }, [conversationId, text]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  const bumpTyping = () => {
    if (!typingActive.current) {
      emitTyping(conversationId, "started");
      typingActive.current = true;
    }
    if (typingTimer.current != null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => stopTyping(), 1800);
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
      await onSend({
        body,
        parentMessageId: replyTo?.id,
        file,
      });
      setText("");
      setFile(null);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const canSend = Boolean(text.trim() || file) && !busy && !disabled;

  return (
    <div className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-white px-3 py-3 sm:px-4">
      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-xs text-slate-600">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-700">Replying</p>
            <p className="truncate">{replyTo.preview}</p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {file ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-lg p-1 text-slate-400 hover:bg-white"
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

      <div className="flex items-end gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            className="rounded-full border border-slate-200 p-2.5 text-slate-500 hover:border-brand-300 hover:text-brand-600"
            aria-label="Insert emoji"
            title="Emoji"
            aria-expanded={emojiOpen}
          >
            <Smile className="h-4 w-4" />
          </button>
          {emojiOpen ? (
            <div className="absolute bottom-full left-0 z-20 mb-2 grid w-56 grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
              {COMPOSER_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded-lg p-1 text-lg hover:bg-slate-50"
                  aria-label={`Insert ${e}`}
                  onClick={() => {
                    insertEmoji(e);
                    setEmojiOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-slate-200 p-2.5 text-slate-500 hover:border-brand-300 hover:text-brand-600"
          aria-label="Attach file"
          title="Attach file"
          disabled={busy || disabled}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <label className="sr-only" htmlFor="msg-composer">
          Message
        </label>
        <textarea
          id="msg-composer"
          ref={taRef}
          rows={1}
          value={text}
          disabled={busy || disabled}
          placeholder="Write a message…"
          onChange={(e) => {
            setText(e.target.value);
            bumpTyping();
          }}
          onKeyDown={onKeyDown}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
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
