/**
 * PWA service-worker update helpers.
 * Mobile browsers check for SW updates infrequently — we poll on focus/visibility.
 */

export function canUseServiceWorker(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export function pageHasUnsavedWork(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector('[data-unsaved="true"]')) return true;
  const active = document.activeElement as HTMLElement | null;
  return Boolean(active?.closest?.("#msg-composer, [data-messaging-composer]"));
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;
  try {
    // Never serve a cached sw.js — mobile Safari/Chrome otherwise keep an old worker.
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

export async function checkForServiceWorkerUpdate(
  registration?: ServiceWorkerRegistration | null,
): Promise<ServiceWorkerRegistration | null> {
  const reg = registration ?? (await ensureServiceWorker());
  if (!reg) return null;
  try {
    await reg.update();
  } catch {
    // Offline / transient — ignore
  }
  return reg;
}

export function getWaitingWorker(
  registration: ServiceWorkerRegistration | null | undefined,
): ServiceWorker | null {
  if (!registration) return null;
  return registration.waiting ?? null;
}

/**
 * Activate waiting worker. Reloads when safe; returns false if reload was deferred.
 */
export function activateWaitingWorker(waiting: ServiceWorker): boolean {
  const deferReload = pageHasUnsavedWork();
  let refreshing = false;

  const reloadOnce = () => {
    if (refreshing || deferReload) return;
    refreshing = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
  waiting.postMessage({ type: "SKIP_WAITING" });

  // Some mobile WebViews skip controllerchange; fall back after a short delay.
  window.setTimeout(reloadOnce, 800);

  return !deferReload;
}
