"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth";
import { navForRole, type NavChild, type NavItem } from "@/lib/nav";
import { useShell } from "@/lib/shell";

/** Exact match, or nested under this href only when no sibling is more specific. */
function isAccordionChildActive(
  pathname: string,
  childHref: string,
  siblings: NavChild[],
): boolean {
  if (pathname === childHref) return true;
  if (!pathname.startsWith(`${childHref}/`)) return false;
  return !siblings.some(
    (s) =>
      s.href !== childHref &&
      s.href.length > childHref.length &&
      (pathname === s.href || pathname.startsWith(`${s.href}/`)),
  );
}

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
          className={`flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-1.5 text-[13px] font-medium transition ${
            active
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-transparent text-foreground-light hover:bg-surface-200 hover:text-foreground"
          }`}
        >
          <item.icon
            className={`h-4 w-4 ${active ? "text-brand-600" : "text-foreground-lighter"}`}
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
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${
          selfActive
            ? "bg-brand-50 text-brand-700"
            : "text-foreground-light hover:bg-surface-200 hover:text-foreground"
        }`}
        aria-expanded={open}
      >
        <item.icon className="h-4 w-4 text-foreground-lighter" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-2">
          {item.children!.map((child) => {
            const active = isAccordionChildActive(
              pathname,
              child.href,
              item.children!,
            );
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  prefetch
                  onClick={onNavigate}
                  className={`block rounded-md px-2.5 py-1 text-[13px] transition ${
                    active
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-foreground-light hover:bg-surface-200 hover:text-foreground"
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
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <BrandLogo height={32} priority />
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-md p-2 text-foreground-lighter transition hover:bg-surface-200 hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <NavLinkItem key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2.5">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-foreground-light transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar lg:flex">
        <SidebarNav />
      </aside>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-foreground/40 transition-opacity ${
            mobileNavOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu overlay"
          onClick={closeMobileNav}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(100%,16rem)] flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-200 ease-out ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarNav onNavigate={closeMobileNav} />
        </aside>
      </div>
    </>
  );
}
