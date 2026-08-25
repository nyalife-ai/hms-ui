"use client";

import { Loader2, Pause, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

const BAR_COUNT = 40;
const peaksCache = new Map<string, number[]>();

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function decodePeaks(url: string, cacheKey: string): Promise<number[]> {
  const cached = peaksCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audioBuf = await ctx.decodeAudioData(buf.slice(0));
    const channel = audioBuf.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let max = 0;
      const start = i * block;
      const end = Math.min(start + block, channel.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j] ?? 0);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    const peakMax = Math.max(...peaks, 0.01);
    const normalized = peaks.map((p) => Math.max(0.08, p / peakMax));
    peaksCache.set(cacheKey, normalized);
    return normalized;
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

export function VoiceNotePlayer({
  src,
  cacheKey,
  sent,
  fileName,
  loading,
  failed,
  onRetry,
}: {
  src?: string | null;
  cacheKey: string;
  sent?: boolean;
  fileName?: string;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [rate, setRate] = useState(1);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [decodeError, setDecodeError] = useState(false);

  useEffect(() => {
    if (!src) {
      setPeaks(null);
      setDecodeError(false);
      return;
    }
    let cancelled = false;
    setDecodeError(false);
    void decodePeaks(src, cacheKey)
      .then((p) => {
        if (!cancelled) setPeaks(p);
      })
      .catch(() => {
        if (!cancelled) {
          setPeaks(Array.from({ length: BAR_COUNT }, () => 0.25));
          setDecodeError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [src, cacheKey]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = rate;
  }, [rate]);

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
  }, []);

  const onLoadedMeta = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const onEnded = useCallback(() => {
    setPlaying(false);
    setCurrent(0);
    const el = audioRef.current;
    if (el) el.currentTime = 0;
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const seekFromClientX = (clientX: number, target: HTMLElement) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = target.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  };

  const onWaveClick = (e: MouseEvent<HTMLButtonElement>) => {
    seekFromClientX(e.clientX, e.currentTarget);
  };

  const onWavePointer = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.buttons !== 1) return;
    seekFromClientX(e.clientX, e.currentTarget);
  };

  const progress = duration > 0 ? current / duration : 0;
  const barFill = sent ? "bg-white" : "bg-brand-500";
  const barMuted = sent ? "bg-white/35" : "bg-brand-200";
  const text = sent ? "text-white" : "text-slate-600";
  const btn = sent
    ? "bg-white/20 text-white hover:bg-white/30"
    : "bg-brand-500 text-white hover:bg-brand-600";

  if (failed) {
    return (
      <div className={`flex items-center gap-2 text-xs ${text}`}>
        <span className="opacity-80">Voice note failed</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={`rounded-lg px-2 py-1 font-medium ${
              sent ? "bg-white/20 hover:bg-white/30" : "bg-white ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (loading || !src) {
    return (
      <div className={`flex h-10 items-center gap-2 ${text}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
        <span className="text-xs opacity-70">{fileName ?? "Loading voice note…"}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[12rem] max-w-xs items-center gap-2">
      {/* Hidden native audio — custom controls only */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMeta}
        onEnded={onEnded}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      <button
        type="button"
        onClick={togglePlay}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${btn}`}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
      </button>

      <button
        type="button"
        className="flex h-10 min-w-0 flex-1 items-end gap-px py-1"
        aria-label="Seek voice note"
        onClick={onWaveClick}
        onPointerDown={onWavePointer}
        onPointerMove={onWavePointer}
      >
        {(peaks ?? Array.from({ length: BAR_COUNT }, () => 0.3)).map((p, i) => {
          const filled = i / BAR_COUNT <= progress;
          return (
            <span
              key={i}
              className={`w-full max-w-[3px] rounded-full ${filled ? barFill : barMuted}`}
              style={{ height: `${Math.round(4 + p * 20)}px` }}
            />
          );
        })}
      </button>

      <div className={`flex shrink-0 flex-col items-end gap-0.5 ${text}`}>
        <span className="text-[10px] tabular-nums opacity-80">
          {formatDuration(playing || current > 0 ? current : duration)}
        </span>
        <button
          type="button"
          onClick={() => setRate((r) => (r === 1 ? 1.5 : 1))}
          className={`rounded px-1 text-[10px] font-semibold ${
            sent ? "bg-white/15 hover:bg-white/25" : "bg-white/80 hover:bg-white"
          }`}
          aria-label={`Playback speed ${rate}x`}
          title={decodeError ? "Waveform approximate" : undefined}
        >
          {rate === 1 ? "1x" : "1.5x"}
        </button>
      </div>
    </div>
  );
}
