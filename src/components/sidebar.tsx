"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth";
import { navForRole, type NavItem } from "@/lib/nav";
import { useShell } from "@/lib/shell";

function NavLinkItem({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const hasChildren = Boolean(item.children?.length);
  const childActive = item.children?.some(
    (c) => pathname === c.href || (c.href !== item.href && pathname.startsWith(`${c.href}/`)),
  );
  const selfActive =
    pathname === item.href ||
    (hasChildren && pathname.startsWith(`${item.href}/`)) ||
    childActive;
  const [open, setOpen] = useState(selfActive);

  useEffect(() => {
    if (selfActive) setOpen(true);
  }, [selfActive]);

  if (!hasChildren) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li>
        <Link
          href={item.href}
          prefetch
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
            active
              ? "bg-brand-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-brand-50 hover:text-brand-800"
          }`}
        >
          <item.icon
            className={`h-[18px] w-[18px] ${active ? "text-white" : "text-brand-500"}`}
          />
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
          selfActive
            ? "bg-brand-50 text-brand-800"
            : "text-slate-500 hover:bg-brand-50 hover:text-brand-800"
        }`}
        aria-expanded={open}
      >
        <item.icon className="h-[18px] w-[18px] text-brand-500" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 border-l border-slate-100 ml-6 pl-2">
          {item.children!.map((child) => {
            const active =
              pathname === child.href ||
              (child.href !== "/inpatient" &&
                pathname.startsWith(`${child.href}/`));
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  prefetch
                  onClick={onNavigate}
                  className={`block rounded-full px-3 py-2 text-sm transition ${
                    active
                      ? "bg-brand-500 font-medium text-white shadow-sm"
                      : "text-slate-500 hover:bg-brand-50 hover:text-brand-800"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const sections = useMemo(
    () => (user ? navForRole(user.role, user.permissions) : []),
    [user],
  );
  const prefetchKey = useMemo(
    () =>
      sections
        .flatMap((s) =>
          s.items.flatMap((i) => [
            i.href,
            ...(i.children?.map((c) => c.href) ?? []),
          ]),
        )
        .join("|"),
    [sections],
  );

  useEffect(() => {
    if (!prefetchKey) return;
    for (const href of prefetchKey.split("|")) {
      router.prefetch(href);
    }
  }, [router, prefetchKey]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
    router.replace("/login");
  };

  return (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <BrandLogo height={36} priority />
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-full p-2 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <NavLinkItem
                  key={item.href}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const { mobileNavOpen, closeMobileNav } = useShell();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-white lg:flex">
        <SidebarNav />
      </aside>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-900/40 transition-opacity ${
            mobileNavOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu overlay"
          onClick={closeMobileNav}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(100%,16rem)] flex-col bg-white shadow-xl transition-transform duration-200 ease-out ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarNav onNavigate={closeMobileNav} />
        </aside>
      </div>
    </>
  );
}
