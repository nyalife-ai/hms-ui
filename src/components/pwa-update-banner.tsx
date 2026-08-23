"use client";

import { useEffect, useState } from "react";

/**
 * Subtle banner when a waiting service worker is ready.
 * Skips auto-reload when the page has unsaved work or the messaging composer is focused.
 */
export function PwaUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller &&
          !cancelled
        ) {
          setWaiting(registration?.waiting ?? installing);
        }
      });
    };

    void navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      registration = reg;
      if (reg.waiting) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", onUpdateFound);
    });

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  if (!waiting) return null;

  const applyUpdate = () => {
    const hasUnsaved = Boolean(document.querySelector('[data-unsaved="true"]'));
    const active = document.activeElement as HTMLElement | null;
    const composerFocused = Boolean(
      active?.closest?.("#msg-composer, [data-messaging-composer]"),
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
    if (hasUnsaved || composerFocused) {
      setWaiting(null);
      return;
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[70] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
      role="status"
    >
      <p className="min-w-0 flex-1">
        An updated version of NyaLife is ready.
      </p>
      <button
        type="button"
        onClick={applyUpdate}
        className="shrink-0 rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
      >
        Update now
      </button>
      <button
        type="button"
        onClick={() => setWaiting(null)}
        className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600"
        aria-label="Dismiss update notice"
      >
        Later
      </button>
    </div>
  );
}
