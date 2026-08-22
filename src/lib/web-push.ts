/**
 * PWA installability + Web Push / FCM device registration.
 * Graceful when permission denied or Firebase env is not configured.
 */

import { api } from "@/lib/api";

const DEVICE_ID_KEY = "nyalife.deviceId";
const PUSH_TOKEN_KEY = "nyalife.fcmToken";
const PUSH_STATUS_KEY = "nyalife.pushStatus";

export type PushRegistrationStatus =
  | "unsupported"
  | "denied"
  | "prompt"
  | "granted"
  | "registered"
  | "unavailable"
  | "error";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getPushStatus(): PushRegistrationStatus | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PUSH_STATUS_KEY) as PushRegistrationStatus | null;
}

function setPushStatus(status: PushRegistrationStatus) {
  localStorage.setItem(PUSH_STATUS_KEY, status);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

function firebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  );
}

async function obtainFcmToken(
  registration: ServiceWorkerRegistration,
): Promise<string | null> {
  if (!firebaseConfigured()) return null;
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import(
      "firebase/messaging"
    );
    if (!(await isSupported())) return null;

    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    };
    const app = getApps().length ? getApps()[0]! : initializeApp(config);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Request notification permission and register this browser as a WEB device.
 * Safe to call repeatedly (upserts by deviceId).
 */
export async function enablePushNotifications(): Promise<{
  status: PushRegistrationStatus;
  message: string;
}> {
  if (typeof window === "undefined") {
    return { status: "unsupported", message: "Not available on server." };
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    setPushStatus("unsupported");
    return {
      status: "unsupported",
      message: "This browser does not support push notifications.",
    };
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    setPushStatus("error");
    return {
      status: "error",
      message: "Could not register the app service worker.",
    };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission === "denied") {
    setPushStatus("denied");
    return {
      status: "denied",
      message: "Notifications are blocked. You can enable them in browser settings.",
    };
  }
  if (permission !== "granted") {
    setPushStatus("prompt");
    return {
      status: "prompt",
      message: "Notification permission was not granted.",
    };
  }

  if (!firebaseConfigured()) {
    setPushStatus("unavailable");
    return {
      status: "unavailable",
      message:
        "Browser notifications are allowed. Configure Firebase env vars to register an FCM device token.",
    };
  }

  const token = await obtainFcmToken(registration);
  if (!token || token.length < 32) {
    setPushStatus("error");
    return {
      status: "error",
      message: "Could not obtain an FCM token for this device.",
    };
  }

  try {
    await api("/notifications/device-tokens", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: "WEB",
        deviceId: getOrCreateDeviceId(),
      }),
    });
    localStorage.setItem(PUSH_TOKEN_KEY, token);
    setPushStatus("registered");
    return {
      status: "registered",
      message: "This device is registered for push notifications.",
    };
  } catch (err) {
    setPushStatus("error");
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Could not register device token with the server.",
    };
  }
}

export async function disablePushNotifications(): Promise<void> {
  const token = localStorage.getItem(PUSH_TOKEN_KEY);
  if (token) {
    try {
      await api("/notifications/device-tokens", {
        method: "DELETE",
        body: JSON.stringify({ token }),
      });
    } catch {
      // ignore — local status still cleared
    }
  }
  localStorage.removeItem(PUSH_TOKEN_KEY);
  setPushStatus("granted");
}

/** After login: register SW; optionally auto-register FCM if already granted. */
export async function bootstrapPushAfterLogin(): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg) return;
  if (Notification.permission !== "granted") return;
  if (!firebaseConfigured()) return;
  if (getPushStatus() === "registered") {
    // Refresh token in case it rotated
    void enablePushNotifications();
    return;
  }
  void enablePushNotifications();
}
