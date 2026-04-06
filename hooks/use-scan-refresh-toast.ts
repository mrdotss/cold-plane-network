"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls `/api/notifications` and shows a toast when a new `scan_complete`
 * notification appears. The toast includes a "Refresh" button that calls
 * `router.refresh()` to revalidate dashboard data.
 */
export function useScanRefreshToast() {
  const router = useRouter();
  const lastSeenIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/notifications?limit=5&unreadOnly=true");
        if (!res.ok) return;

        const data = await res.json();
        const notifications: { id: string; type: string }[] =
          data.notifications ?? [];

        // Find the most recent scan_complete notification
        const scanNotification = notifications.find(
          (n) =>
            n.type === "cfm_scan_complete" || n.type === "csp_scan_complete",
        );

        if (!scanNotification) return;

        // On first poll, just record the latest ID without showing a toast
        if (!initializedRef.current) {
          lastSeenIdRef.current = scanNotification.id;
          initializedRef.current = true;
          return;
        }

        // If we've already seen this notification, skip
        if (scanNotification.id === lastSeenIdRef.current) return;

        // New scan completion detected
        lastSeenIdRef.current = scanNotification.id;

        toast.info("New scan data available", {
          action: {
            label: "Refresh",
            onClick: () => router.refresh(),
          },
          duration: 10_000,
        });
      } catch {
        // Silently retry on next interval
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);
}
