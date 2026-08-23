/**
 * Soft notification / message chimes via Web Audio (no asset required).
 * Respects user preference and browser autoplay policies.
 */

let unlocked = false;
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

async function ensureCtx(): Promise<AudioContext | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  unlocked = true;
  return ctx;
}

/** Call once after a user gesture so later autoplay is allowed. */
export function unlockNotificationAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    unlocked = true;
  });
}

export async function playNotificationSound(): Promise<void> {
  try {
    const ctx = await ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Autoplay blocked or AudioContext unavailable — fail silently.
  }
}

/** Short high click for successful outgoing send. */
export async function playMessageSentSound(): Promise<void> {
  try {
    const ctx = await ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(1900, now + 0.04);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // ignore
  }
}

/** Soft receive chime (quieter variant of the notification sound). */
export async function playMessageReceivedSound(): Promise<void> {
  try {
    const ctx = await ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // ignore
  }
}

export function isNotificationAudioUnlocked(): boolean {
  return unlocked;
}
