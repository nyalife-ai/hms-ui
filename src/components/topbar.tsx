"use client";

import {
  Bell,
  Search,
  Settings,
  UserCircle,
  ChevronDown,
  LogOut,
  Menu,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleLabel } from "@/lib/auth";
import { ALL_ROLES, ROLE_LABELS, canAccess, type Role } from "@/lib/roles";
import { useShell } from "@/lib/shell";
import {
  fetchMyNotifications,
  fetchNotificationPreferences,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import {
  playNotificationSound,
  unlockNotificationAudio,
} from "@/lib/notification-sound";
import { connectRealtime } from "@/lib/realtime-client";
import { Avatar } from "./ui";

const SEARCH_ROUTES: Array<{ label: string; href: string; keywords: string }> = [
  { label: "Front Desk", href: "/front-desk", keywords: "check-in reception" },
  { label: "Patients", href: "/patients", keywords: "register mrn" },
  { label: "Appointments", href: "/appointments", keywords: "schedule booking" },
  { label: "Triage", href: "/triage", keywords: "vitals nurse" },
  { label: "Consultations", href: "/consultations", keywords: "doctor diagnosis" },
  { label: "Follow-ups", href: "/follow-ups", keywords: "review schedule" },
  { label: "Laboratory", href: "/laboratory", keywords: "lab results" },
  { label: "Pharmacy", href: "/pharmacy", keywords: "medications stock" },
  { label: "Billing", href: "/billing", keywords: "invoice mpesa claim" },
  {
    label: "Inpatient",
    href: "/inpatient",
    keywords: "ward bed discharge ipd admission reservation nursing",
  },
  { label: "Radiology", href: "/radiology", keywords: "scan imaging" },
  { label: "Doctors", href: "/doctors", keywords: "clinicians" },
  { label: "Staff", href: "/staff", keywords: "roles employees" },
  { label: "Messages", href: "/messages", keywords: "chat conversation" },
  { label: "My Account", href: "/account", keywords: "profile password 2fa security" },
  { label: "Settings", href: "/settings", keywords: "hospital system" },
  { label: "Dashboard", href: "/dashboard", keywords: "home overview" },
  {
    label: "Reports & Analytics",
    href: "/reports",
    keywords: "analytics kpi revenue reports charts",
  },
];

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function Topbar() {
  const { user, logout, loginAsRole, demoAuthEnabled } = useAuth();
  const { toggleMobileNav } = useShell();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const seenLiveIds = useRef(new Set<string>());

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ROUTES.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.keywords.includes(q) ||
        r.href.includes(q),
    ).slice(0, 6);
  }, [query]);

  const syncFromApi = useCallback(async () => {
    try {
      const [page, count, prefs] = await Promise.all([
        fetchMyNotifications({ page: 1, limit: 15 }),
        fetchUnreadCount(),
        fetchNotificationPreferences(),
      ]);
      setItems(page.items);
      setUnread(count);
      setSoundEnabled(prefs.notificationSoundEnabled);
      // Seed seen set so history never triggers sound after login/reconnect.
      for (const n of page.items) seenLiveIds.current.add(n.id);
    } catch {
      // Notification center is best-effort; do not break the shell.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void syncFromApi();
  }, [user, syncFromApi]);

  useEffect(() => {
    if (!user) return;
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const disconnect = connectRealtime({
      role: user.role,
      onReconnect: () => {
        void syncFromApi();
      },
      onEvent: (type, payload) => {
        const notificationId =
          typeof payload.notificationId === "string"
            ? payload.notificationId
            : null;
        const isLive = payload.isLive === true;

        if (notificationId && isLive && !seenLiveIds.current.has(notificationId)) {
          seenLiveIds.current.add(notificationId);
          const next: AppNotification = {
            id: notificationId,
            userId: user.id,
            notificationType:
              typeof payload.notificationType === "string"
                ? payload.notificationType
                : type,
            title:
              typeof payload.title === "string" ? payload.title : "Notification",
            body: typeof payload.body === "string" ? payload.body : null,
            priority:
              typeof payload.priority === "string" ? payload.priority : "NORMAL",
            isRead: false,
            actionPath:
              typeof payload.actionPath === "string" ? payload.actionPath : null,
            entityType:
              typeof payload.entityType === "string" ? payload.entityType : null,
            entityId:
              typeof payload.entityId === "string" ? payload.entityId : null,
            deliveryStatus: "DELIVERED",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setItems((prev) => {
            if (prev.some((p) => p.id === notificationId)) return prev;
            return [next, ...prev].slice(0, 30);
          });
          setUnread((c) => c + 1);
          if (soundEnabled) {
            const actionPath =
              typeof payload.actionPath === "string" ? payload.actionPath : null;
            const onMessages =
              typeof window !== "undefined" &&
              window.location.pathname.includes("/messages");
            if (onMessages && actionPath) {
              try {
                const url = new URL(actionPath, window.location.origin);
                const notifConv = url.searchParams.get("c");
                const currentConv = new URLSearchParams(
                  window.location.search,
                ).get("c");
                if (notifConv && currentConv && notifConv === currentConv) {
                  // Already viewing this conversation — skip topbar chime.
                } else {
                  void playNotificationSound();
                }
              } catch {
                void playNotificationSound();
              }
            } else {
              void playNotificationSound();
            }
          }
        } else if (!notificationId) {
          // Department queue events without durable row — refresh quietly.
          void syncFromApi();
        }
      },
    });

    return () => {
      disconnect();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [user, soundEnabled, syncFromApi]);

  useEffect(() => {
    if (!menuOpen && !bellOpen && !searchOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(target)) setBellOpen(false);
      if (searchRef.current && !searchRef.current.contains(target))
        setSearchOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setBellOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, bellOpen, searchOpen]);

  if (!user) return null;

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  };

  const go = (href: string) => {
    setQuery("");
    setSearchOpen(false);
    setBellOpen(false);
    router.push(href);
  };

  const openNotification = async (n: AppNotification) => {
    setBellOpen(false);
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    go(n.actionPath || "/dashboard");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 bg-[#faf7f9]/90 px-4 backdrop-blur sm:gap-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleMobileNav}
          className="rounded-full bg-white p-2.5 text-brand-600 shadow-sm transition hover:bg-brand-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative hidden w-full max-w-xs sm:block" ref={searchRef}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0].href);
            }}
            placeholder="Search modules…"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
          />
          {searchOpen && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-100">
              {results.map((r) => (
                <button
                  key={r.href}
                  type="button"
                  onClick={() => go(r.href)}
                  className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition hover:bg-brand-50 sm:gap-2.5 sm:pr-3"
          >
            <Avatar name={user.name} size="sm" />
            <span className="hidden text-left md:block">
              <span className="block text-sm font-semibold leading-tight text-slate-800">
                {user.name}
              </span>
              <span className="block text-xs leading-tight text-slate-400">
                {roleLabel(user.role)}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-slate-100"
            >
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-400">{user.email}</p>
              </div>

              {demoAuthEnabled && (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Preview another role (demo)
                  </p>
                  {ALL_ROLES.map((role: Role) => (
                    <button
                      key={role}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void loginAsRole(role).then(() => setMenuOpen(false));
                      }}
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        role === user.role
                          ? "bg-brand-50 font-semibold text-brand-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => void handleLogout()}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => {
              unlockNotificationAudio();
              setBellOpen((v) => !v);
              if (!bellOpen) void syncFromApi();
            }}
            className="relative rounded-full bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-brand-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Notifications
                </p>
                {unread > 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                    onClick={() => {
                      void markAllNotificationsRead()
                        .then(() => {
                          setItems((prev) =>
                            prev.map((x) => ({ ...x, isRead: true })),
                          );
                          setUnread(0);
                        })
                        .catch(() => undefined);
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-400">
                  No notifications yet.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void openNotification(n)}
                    className={`block w-full rounded-xl px-3 py-2.5 text-left hover:bg-brand-50 ${
                      n.isRead ? "opacity-70" : ""
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-800">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {n.notificationType} · {formatWhen(n.createdAt)}
                      {!n.isRead ? " · unread" : ""}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {canAccess(user.role, "account", user.permissions) && (
          <button
            type="button"
            onClick={() => router.push("/account")}
            className="hidden rounded-full bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-brand-50 sm:inline-flex"
            aria-label="My Account"
          >
            <UserCircle className="h-4 w-4" />
          </button>
        )}

        {canAccess(user.role, "settings", user.permissions) && (
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="hidden rounded-full bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-brand-50 sm:inline-flex"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
