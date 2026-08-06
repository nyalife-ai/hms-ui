"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { canAccess, MODULE_ACCESS } from "@/lib/roles";

/**
 * Blocks rendering of a module page when the current role has no access.
 * Mirrors what the backend RBAC engine will enforce server-side.
 */
export function RoleGuard({
  module,
  children,
}: {
  module: keyof typeof MODULE_ACCESS;
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (!user) return null;

  if (!canAccess(user.role, module, user.permissions)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Access restricted</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Your role does not have permission to view this module. Contact an
          administrator if you believe this is a mistake.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
