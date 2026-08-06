"use client";

import {
  Bell,
  Search,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleLabel } from "@/lib/auth";
import { useDashboardSummary } from "@/lib/catalog";
import { ALL_ROLES, ROLE_LABELS, canAccess, type Role } from "@/lib/roles";
import { useShell } from "@/lib/shell";
import { Avatar } from "./ui";

const SEARCH_ROUTES: Array<{ label: string; href: string; keywords: string }> = [
  { label: "Front Desk", href: "/front-desk", keywords: "check-in reception" },
  { label: "Patients", href: "/patients", keywords: "register mrn" },
  { label: "Appointments", href: "/appointments", keywords: "schedule booking" },
  { label: "Triage", href: "/triage", keywords: "vitals nurse" },
  { label: "Consultations", href: "/consultations", keywords: "doctor diagnosis" },
  { label: "Laboratory", href: "/laboratory", keywords: "lab results" },
  { label: "Pharmacy", href: "/pharmacy", keywords: "medications stock" },
  { label: "Billing", href: "/billing", keywords: "invoice mpesa claim" },
    { label: "Inpatient", href: "/inpatient", keywords: "ward bed discharge ipd admission reservation nursing" },
  { label: "Radiology", href: "/radiology", keywords: "scan imaging" },
  { label: "Doctors", href: "/doctors", keywords: "clinicians" },
  { label: "Staff", href: "/staff", keywords: "roles employees" },
  { label: "Messages", href: "/messages", keywords: "chat conversation" },
  { label: "Settings", href: "/settings", keywords: "hospital password" },
  { label: "Dashboard", href: "/dashboard", keywords: "home overview" },
];

export function Topbar() {
  const { user, logout, loginAsRole, demoAuthEnabled } = useAuth();
  const { toggleMobileNav } = useShell();
  const { data: summary } = useDashboardSummary();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const reports = summary?.reports ?? [];

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

  useEffect(() => {
    if (!menuOpen && !bellOpen && !searchOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(target)) setBellOpen(false);
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
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
            onClick={() => setBellOpen((v) => !v)}
            className="relative rounded-full bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-brand-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {reports.length > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-100">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Live alerts
              </p>
              {reports.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-400">No operational alerts.</p>
              ) : (
                reports.map((r) => {
                  const href =
                    r.source === "Billing"
                      ? "/billing"
                      : r.source === "Front desk"
                        ? "/front-desk"
                        : r.source === "Scheduling"
                          ? "/appointments"
                          : "/dashboard";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => go(href)}
                      className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-brand-50"
                    >
                      <p className="text-xs font-semibold text-slate-800">{r.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {r.source} · {r.time}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

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
