"use client";

import { PwaUpdateBanner } from "@/components/pwa-update-banner";

/** Root-level client mount so login + installed mobile PWAs also auto-update. */
export function PwaUpdateRoot() {
  return <PwaUpdateBanner />;
}
