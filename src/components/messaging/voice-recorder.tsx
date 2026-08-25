"use client";

import { Mic, Square, Trash2, Send } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { VoiceNotePlayer } from "./voice-note-player";

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type VoiceRecorderHandle = {
  start: () => void;
  isBusy: () => boolean;
};

export type VoiceRecorderProps = {
  disabled?: boolean;
  onReady: (file: File) => void;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

export const VoiceRecorder = forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(
  function VoiceRecorder({ disabled, onReady, onError, onBusyChange }, ref) {
    const [phase, setPhase] = useState<"idle" | "recording" | "preview">(
      "idle",
    );
    const [elapsed, setElapsed] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number | null>(null);
    const barsRef = useRef<HTMLDivElement>(null);
    const mimeRef = useRef<string | undefined>(undefined);

    const cleanupStream = useCallback(() => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorder.current = null;
      analyserRef.current = null;
      void audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
    }, []);

    const discardPreview = useCallback(() => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewFile(null);
      setPhase("idle");
      setElapsed(0);
      onBusyChange?.(false);
    }, [previewUrl, onBusyChange]);

    useEffect(
      () => () => {
        cleanupStream();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      },
      [cleanupStream, previewUrl],
    );

    const drawBars = useCallback(() => {
      const analyser = analyserRef.current;
      const el = barsRef.current;
      if (!analyser || !el) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const children = el.children;
      const step = Math.floor(data.length / Math.max(children.length, 1));
      for (let i = 0; i < children.length; i++) {
        const v = data[i * step] ?? 0;
        const h = Math.max(4, Math.round((v / 255) * 28));
        (children[i] as HTMLElement).style.height = `${h}px`;
      }
      rafRef.current = requestAnimationFrame(drawBars);
    }, []);

    const startRecording = useCallback(async () => {
      if (disabled || phase !== "idle") return;
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        onError?.("Voice recording is not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;
        mimeRef.current = pickMimeType();
        const recorder = mimeRef.current
          ? new MediaRecorder(stream, { mimeType: mimeRef.current })
          : new MediaRecorder(stream);
        mediaRecorder.current = recorder;
        chunksRef.current = [];

        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
          rafRef.current = requestAnimationFrame(drawBars);
        }

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const mime = mimeRef.current || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mime });
          cleanupStream();
          if (!blob.size) {
            setPhase("idle");
            onBusyChange?.(false);
            onError?.("Recording was empty. Please try again.");
            return;
          }
          const ext =
            mime.includes("mp4") || mime.includes("aac") ? "m4a" : "webm";
          const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
            type: mime,
          });
          const url = URL.createObjectURL(blob);
          setPreviewFile(file);
          setPreviewUrl(url);
          setPhase("preview");
          onBusyChange?.(true);
        };

        recorder.start(200);
        setPhase("recording");
        onBusyChange?.(true);
        setElapsed(0);
        timerRef.current = window.setInterval(() => {
          setElapsed((s) => s + 1);
        }, 1000);
      } catch {
        cleanupStream();
        setPhase("idle");
        onBusyChange?.(false);
        onError?.(
          "Microphone access was denied. Allow mic permission to send voice notes.",
        );
      }
    }, [
      cleanupStream,
      disabled,
      drawBars,
      onBusyChange,
      onError,
      phase,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        start: () => {
          void startRecording();
        },
        isBusy: () => phase !== "idle",
      }),
      [phase, startRecording],
    );

    const stopRecording = () => {
      const rec = mediaRecorder.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      } else {
        cleanupStream();
        setPhase("idle");
        onBusyChange?.(false);
      }
    };

    const cancelRecording = () => {
      const rec = mediaRecorder.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = () => {
          cleanupStream();
          setPhase("idle");
          setElapsed(0);
          onBusyChange?.(false);
        };
        rec.stop();
      } else {
        cleanupStream();
        setPhase("idle");
        setElapsed(0);
        onBusyChange?.(false);
      }
    };

    if (phase === "recording") {
      return (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-rose-500"
            aria-hidden
          />
          <span className="text-xs font-medium tabular-nums text-rose-700">
            {formatDuration(elapsed)}
          </span>
          <div
            ref={barsRef}
            className="flex h-7 flex-1 items-end justify-center gap-0.5"
            aria-hidden
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-rose-400 transition-[height] duration-75"
                style={{ height: 4 }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={cancelRecording}
            className="rounded-lg px-2 py-1 text-xs font-medium text-foreground-light hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
            aria-label="Stop recording"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </div>
      );
    }

    if (phase === "preview" && previewUrl && previewFile) {
      return (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-200 px-3 py-2">
          <div className="min-w-0 flex-1">
            <VoiceNotePlayer
              src={previewUrl}
              cacheKey={`preview-${previewFile.name}-${previewFile.size}`}
              fileName={previewFile.name}
            />
          </div>

          <button
            type="button"
            onClick={discardPreview}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-foreground-light hover:bg-white"
            aria-label="Discard voice note"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Discard
          </button>
          <button
            type="button"
            onClick={() => {
              onReady(previewFile);
              discardPreview();
            }}
            className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            aria-label="Attach voice note"
          >
            <Send className="h-3.5 w-3.5" />
            Attach
          </button>
        </div>
      );
    }

    return null;
  },
);

export function VoiceMicButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-border p-2.5 text-foreground-light hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
      aria-label="Record voice note"
      title="Voice note"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
