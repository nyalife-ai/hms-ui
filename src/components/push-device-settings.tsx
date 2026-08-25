"use client";

import { useEffect, useState } from "react";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  type PushRegistrationStatus,
} from "@/lib/web-push";

export function PushDeviceSettings() {
  const [status, setStatus] = useState<PushRegistrationStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(getPushStatus());
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await enablePushNotifications();
      setStatus(result.status);
      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage("");
    try {
      await disablePushNotifications();
      setStatus("granted");
      setMessage("This device was unregistered from push alerts.");
    } finally {
      setBusy(false);
    }
  };

  const label =
    status === "registered"
      ? "Registered on this device"
      : status === "denied"
        ? "Blocked in browser settings"
        : status === "unavailable"
          ? "Permission OK — FCM not configured"
          : status === "unsupported"
            ? "Not supported in this browser"
            : "Not registered yet";

  return (
    <div className="space-y-4 px-5 pb-5 sm:max-w-xl">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-foreground-light">
          Multi-device: each browser registers its own token. You can enable
          several devices under the same account.
        </p>
        {message ? (
          <p className="mt-2 text-xs text-foreground-light">{message}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || status === "denied" || status === "unsupported"}
          onClick={() => void enable()}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Working…" : status === "registered" ? "Refresh registration" : "Enable on this device"}
        </button>
        {status === "registered" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disable()}
            className="rounded-full bg-surface-200 px-4 py-2 text-sm font-semibold text-foreground hover:bg-slate-200 disabled:opacity-50"
          >
            Disable on this device
          </button>
        ) : null}
      </div>
    </div>
  );
}
