"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PushNotificationsBootstrap } from "@/components/push-notifications-bootstrap";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { PADDING_CLASSES } from "@/components/studio";
import { useAuth } from "@/lib/auth";
import { ShellProvider } from "@/lib/shell";
import { cn } from "@/components/ui-studio";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <ShellProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:pl-60">
          <Topbar />
          <main className="min-h-[calc(100vh-3rem)]">
            <div className={cn("mx-auto w-full max-w-[1600px] pb-12 pt-6", PADDING_CLASSES)}>
              {children}
            </div>
          </main>
        </div>
        <PushNotificationsBootstrap />
      </div>
    </ShellProvider>
  );
}
