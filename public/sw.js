/**
 * NyaLife PWA service worker.
 * Installability only — does NOT cache clinical/API responses (safety).
 */

const SHELL = "nyalife-shell-v1";
const SHELL_URLS = ["/manifest.webmanifest", "/logo-transparent.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache API / clinical data — always network.
  if (
    url.pathname.startsWith("/api") ||
    (url.hostname.includes("localhost") && url.port === "4000") ||
    url.pathname.includes("/bulk-imports") ||
    url.pathname.includes("/notifications")
  ) {
    return;
  }

  // App navigations: network first; offline fallback not clinical.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/logo-transparent.png")),
    );
    return;
  }

  // Static shell assets only from cache.
  if (SHELL_URLS.some((p) => url.pathname === p)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req)),
    );
  }
});

// FCM / Web Push payload display (when backend sends data messages via FCM).
self.addEventListener("push", (event) => {
  let title = "NyaLife";
  let body = "You have a new notification";
  try {
    const data = event.data ? event.data.json() : {};
    title = data.title || data.notification?.title || title;
    body = data.body || data.notification?.body || body;
  } catch {
    // ignore
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo-transparent.png",
      badge: "/logo-transparent.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("/dashboard");
        }
        return undefined;
      }),
  );
});
