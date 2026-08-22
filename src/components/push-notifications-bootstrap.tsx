"use client";

import { Bell, BellOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  bootstrapPushAfterLogin,
  enablePushNotifications,
  getPushStatus,
  type PushRegistrationStatus,
} from "@/lib/web-push";

/**
 * After login: register PWA SW; soft-prompt for notifications once per session.
 */
export function PushNotificationsBootstrap() {
  const { user } = useAuth();
  const [banner, setBanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PushRegistrationStatus | null>(null);

  useEffect(() => {
    if (!user) return;
    void bootstrapPushAfterLogin().then(() => {
      const s = getPushStatus();
      setStatus(s);
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default" &&
        sessionStorage.getItem("nyalife.pushBanner") !== "1"
      ) {
        setBanner(true);
      }
    });
  }, [user]);

  if (!user || !banner) return null;

  const dismiss = () => {
    sessionStorage.setItem("nyalife.pushBanner", "1");
    setBanner(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const result = await enablePushNotifications();
      setStatus(result.status);
      dismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mt-0.5 rounded-full bg-brand-50 p-2 text-brand-700">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            Enable desktop alerts?
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Get live HMS alerts on this device. You can change this anytime in
            Settings → Notifications.
            {status === "unavailable"
              ? " Browser permission works; FCM env is not configured yet."
              : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Enabling…" : "Enable"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              <BellOff className="h-3.5 w-3.5" /> Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
