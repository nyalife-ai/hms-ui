"use client";

import { useCallback, useEffect, useState } from "react";
import {
  activateWaitingWorker,
  checkForServiceWorkerUpdate,
  ensureServiceWorker,
  getWaitingWorker,
  pageHasUnsavedWork,
} from "@/lib/pwa-update";

/**
 * Keeps the installed PWA / mobile browser on the latest build.
 *
 * Desktop often picks up updates casually; mobile keeps tabs/homescreen apps
 * alive and rarely re-checks sw.js. This component:
 *  - registers SW with updateViaCache: "none"
 *  - checks for updates on load, focus, visibility, and periodically
 *  - auto-applies (skipWaiting + reload) when safe
 *  - shows a high-visibility banner only if reload must wait (unsaved work)
 */
export function PwaUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const tryActivate = useCallback((worker: ServiceWorker) => {
    setWaiting(worker);
    if (pageHasUnsavedWork()) {
      setNeedsConfirm(true);
      return;
    }
    setNeedsConfirm(false);
    activateWaitingWorker(worker);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let pollId = 0;

    const adoptWaiting = (reg: ServiceWorkerRegistration | null) => {
      if (cancelled || !reg) return;
      const w = getWaitingWorker(reg);
      if (w) tryActivate(w);
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (cancelled) return;
        if (
          installing.state === "installed" &&
          (registration?.waiting || navigator.serviceWorker.controller)
        ) {
          const w = registration?.waiting ?? installing;
          if (w) tryActivate(w);
        }
      });
    };

    const runCheck = async () => {
      const reg = await checkForServiceWorkerUpdate(registration);
      if (cancelled || !reg) return;
      registration = reg;
      adoptWaiting(reg);
    };

    void (async () => {
      registration = await ensureServiceWorker();
      if (cancelled || !registration) return;
      registration.addEventListener("updatefound", onUpdateFound);
      adoptWaiting(registration);
      await runCheck();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void runCheck();
    };
    const onFocus = () => {
      void runCheck();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    // Mobile PWAs often sit in memory — poll while the tab is open.
    pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") void runCheck();
    }, 60_000);

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(pollId);
    };
  }, [tryActivate]);

  if (!waiting || !needsConfirm) return null;

  const applyUpdate = () => {
    activateWaitingWorker(waiting);
    setNeedsConfirm(false);
    setWaiting(null);
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-brand-200 bg-surface px-4 py-3 text-sm text-foreground shadow-lg"
      role="status"
    >
      <p className="min-w-0 flex-1">
        A new version of NyaLife is ready. Save your work, then update.
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
        onClick={() => {
          setNeedsConfirm(false);
          setWaiting(null);
        }}
        className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-foreground-lighter hover:text-foreground-light"
        aria-label="Dismiss update notice"
      >
        Later
      </button>
    </div>
  );
}
