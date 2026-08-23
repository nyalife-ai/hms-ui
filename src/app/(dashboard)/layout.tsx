"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PushNotificationsBootstrap } from "@/components/push-notifications-bootstrap";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useAuth } from "@/lib/auth";
import { ShellProvider } from "@/lib/shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f9]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <ShellProvider>
      <div className="min-h-screen bg-[#faf7f9]">
        <Sidebar />
        <div className="lg:pl-60">
          <Topbar />
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
        <PushNotificationsBootstrap />
        <PwaUpdateBanner />
      </div>
    </ShellProvider>
  );
}
