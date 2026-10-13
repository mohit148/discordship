"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

let lastRun = 0;
const MIN_GAP_MS = 5 * 60 * 1000;

/**
 * Invisible. After a page shows, quietly asks the server to refresh stale Discord
 * profiles (see app/api/profile-sync/route.ts). If anything actually changed it
 * re-fetches the current page once, so a new picture appears without a manual reload.
 */
export function ProfileSync() {
  const router = useRouter();
  useEffect(() => {
    if (Date.now() - lastRun < MIN_GAP_MS) return;
    lastRun = Date.now();
    fetch("/api/profile-sync", { method: "POST", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.changed) router.refresh();
      })
      .catch(() => {
        /* best effort */
      });
  }, [router]);
  return null;
}
