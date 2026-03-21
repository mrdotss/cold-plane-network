"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Loading03Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import type { ScanProgressEvent } from "@/lib/cfm/types";

// ─── Service status tracking ─────────────────────────────────────────────────

type ServiceStatus = "pending" | "in_progress" | "done" | "failed";

interface ServiceState {
  service: string;
  status: ServiceStatus;
  summary?: string;
  recommendationCount?: number;
  error?: string;
}

interface ScanProgressProps {
  scanId: string;
  accountId: string;
  services: string[];
}

export function ScanProgress({ scanId, accountId, services }: ScanProgressProps) {
  const router = useRouter();
  const [serviceStates, setServiceStates] = useState<ServiceState[]>(() =>
    services.map((service) => ({ service, status: "pending" })),
  );
  const [scanDone, setScanDone] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const completedCount = serviceStates.filter(
    (s) => s.status === "done" || s.status === "failed",
  ).length;
  const progressPercent = services.length > 0 ? Math.round((completedCount / services.length) * 100) : 0;

  // Handle an incoming SSE event
  const handleEvent = useCallback((event: ScanProgressEvent) => {
    switch (event.type) {
      case "service_started":
        setServiceStates((prev) =>
          prev.map((s) =>
            s.service === event.service ? { ...s, status: "in_progress" } : s,
          ),
        );
        break;
      case "service_complete":
        setServiceStates((prev) =>
          prev.map((s) =>
            s.service === event.service
              ? {
                  ...s,
                  status: "done",
                  summary: event.summary,
                  recommendationCount: event.recommendationCount,
                }
              : s,
          ),
        );
        break;
      case "service_failed":
        setServiceStates((prev) =>
          prev.map((s) =>
            s.service === event.service
              ? { ...s, status: "failed", error: event.error }
              : s,
          ),
        );
        break;
      case "scan_complete":
        setScanDone(true);
        break;
      case "scan_failed":
        setScanFailed(true);
        setScanError(event.error);
        break;
    }
  }, []);

  // Connect to SSE stream
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function pollScanStatus() {
      try {
        const res = await fetch(`/api/cfm/scans/${scanId}`);
        if (!res.ok) return;
        const { scan } = await res.json();
        if (scan.status === "completed") {
          setScanDone(true);
          if (pollInterval) clearInterval(pollInterval);
        } else if (scan.status === "failed") {
          setScanFailed(true);
          setScanError(scan.error ?? "Scan failed");
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch {
        // Silently fail — will retry on next interval
      }
    }

    function startPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(pollScanStatus, 3000);
      // Also poll immediately on connection drop
      pollScanStatus();
    }

    async function connectStream() {
      try {
        const res = await fetch(`/api/cfm/scans/${scanId}/stream`, {
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          startPolling();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as ScanProgressEvent;
                handleEvent(event);
              } catch {
                // Skip malformed events
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Connection dropped — fall back to polling scan status
        startPolling();
      }
    }

    connectStream();

    return () => {
      controller.abort();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [scanId, handleEvent]);

  // Auto-navigate to dashboard on scan completion
  useEffect(() => {
    if (scanDone) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/cfm/${accountId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [scanDone, accountId, router]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Scan Progress</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Overall progress bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {scanDone
                  ? "Scan complete"
                  : scanFailed
                    ? "Scan failed"
                    : `Analyzing services…`}
              </span>
              <span>
                {completedCount} / {services.length}
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>

          {/* Per-service status list */}
          <div className="flex flex-col gap-1" role="list" aria-label="Service analysis status">
            {serviceStates.map((svc) => (
              <ServiceRow key={svc.service} state={svc} />
            ))}
          </div>

          {/* Scan-level error */}
          {scanFailed && scanError && (
            <p className="text-xs text-destructive">{scanError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {scanDone && (
              <Badge variant="default" className="text-xs">
                Redirecting to dashboard…
              </Badge>
            )}
            {!scanDone && completedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/cfm/${accountId}`)}
              >
                Skip to results (partial)
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" strokeWidth={2} />
              </Button>
            )}
            {scanFailed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/cfm`)}
              >
                Back to accounts
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Service row sub-component ───────────────────────────────────────────────

function ServiceRow({ state }: { state: ServiceState }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
      role="listitem"
    >
      <StatusIcon status={state.status} />
      <span className="font-medium min-w-[80px]">{state.service}</span>
      <span className="text-xs text-muted-foreground flex-1 truncate">
        {state.status === "done" && state.summary}
        {state.status === "failed" && (
          <span className="text-destructive">{state.error}</span>
        )}
        {state.status === "in_progress" && "Analyzing…"}
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "pending":
      return (
        <span
          className="size-4 rounded-full border border-muted-foreground/30 bg-muted"
          aria-label="Pending"
        />
      );
    case "in_progress":
      return (
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-4 text-blue-500 animate-spin"
          strokeWidth={2}
          aria-label="In progress"
        />
      );
    case "done":
      return (
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          className="size-4 text-green-500"
          strokeWidth={2}
          aria-label="Complete"
        />
      );
    case "failed":
      return (
        <HugeiconsIcon
          icon={Cancel01Icon}
          className="size-4 text-destructive"
          strokeWidth={2}
          aria-label="Failed"
        />
      );
  }
}
