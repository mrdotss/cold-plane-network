"use client";

import { useState, useEffect, useRef } from "react";
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
import { CSP_CATEGORIES } from "@/lib/csp/types";
import type { CspCategory, CspScanProgressEvent } from "@/lib/csp/types";

type CategoryStatus = "pending" | "collecting" | "done" | "failed";

interface CategoryState {
  category: CspCategory;
  label: string;
  status: CategoryStatus;
  detail?: string;
  findingCount?: number;
  error?: string;
}

interface CspScanProgressProps {
  scanId: string;
  accountId: string;
}

export function CspScanProgress({
  scanId,
  accountId,
}: CspScanProgressProps) {
  const router = useRouter();
  const [categoryStates, setCategoryStates] = useState<CategoryState[]>(() =>
    CSP_CATEGORIES.map((cat) => ({
      category: cat.id,
      label: cat.label,
      status: "collecting",
      detail: "Collecting data...",
    })),
  );
  const [phase, setPhase] = useState<"collecting" | "analyzing" | "done">(
    "collecting",
  );
  const [scanDone, setScanDone] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const completedCount = categoryStates.filter(
    (s) => s.status === "done" || s.status === "failed",
  ).length;
  const totalCategories = categoryStates.length;
  const progress =
    phase === "done"
      ? 100
      : Math.round((completedCount / totalCategories) * 100);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      try {
        const res = await fetch(`/api/csp/scans/${scanId}/stream`, {
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

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
            if (!line.startsWith("data: ")) continue;
            try {
              const event: CspScanProgressEvent = JSON.parse(
                line.slice(6),
              );
              handleEvent(event);
            } catch {
              // skip malformed SSE
            }
          }
        }
      } catch {
        // aborted or network error
      }
    };

    connect();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  function handleEvent(event: CspScanProgressEvent) {
    switch (event.type) {
      case "category_started":
        setCategoryStates((prev) =>
          prev.map((s) =>
            s.category === event.category
              ? { ...s, status: "collecting", detail: "Starting..." }
              : s,
          ),
        );
        break;
      case "category_collecting":
        setCategoryStates((prev) =>
          prev.map((s) =>
            s.category === event.category
              ? { ...s, status: "collecting", detail: event.detail }
              : s,
          ),
        );
        break;
      case "data_collected":
        setPhase("analyzing");
        break;
      case "category_complete":
        setCategoryStates((prev) =>
          prev.map((s) =>
            s.category === event.category
              ? {
                  ...s,
                  status: "done",
                  findingCount: event.findingCount,
                  detail: `${event.findingCount} finding(s)`,
                }
              : s,
          ),
        );
        break;
      case "category_failed":
        setCategoryStates((prev) =>
          prev.map((s) =>
            s.category === event.category
              ? { ...s, status: "failed", error: event.error }
              : s,
          ),
        );
        break;
      case "scan_complete":
        setPhase("done");
        setScanDone(true);
        break;
      case "scan_failed":
        setPhase("done");
        setScanFailed(true);
        setScanError(event.error);
        break;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CSP Security Scan</CardTitle>
          <div className="text-sm text-muted-foreground">
            {phase === "collecting" && "Collecting security configuration data..."}
            {phase === "analyzing" && "Analyzing findings with AI agent..."}
            {phase === "done" && !scanFailed && "Scan complete!"}
            {scanFailed && "Scan failed."}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-2" />

          <div className="text-xs text-muted-foreground text-right">
            {completedCount}/{totalCategories} categories analyzed
          </div>

          <div className="space-y-2">
            {categoryStates.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center gap-3 p-2 rounded-lg border"
              >
                {cat.status === "collecting" && (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    strokeWidth={2}
                    className="size-4 text-primary animate-spin"
                  />
                )}
                {cat.status === "done" && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                    className="size-4 text-green-500 dark:text-green-400"
                  />
                )}
                {cat.status === "failed" && (
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    strokeWidth={2}
                    className="size-4 text-red-500 dark:text-red-400"
                  />
                )}
                {cat.status === "pending" && (
                  <div className="size-4 rounded-full border-2 border-muted" />
                )}

                <span className="text-sm font-medium flex-1">{cat.label}</span>

                {cat.status === "done" && cat.findingCount !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    {cat.findingCount} finding{cat.findingCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {cat.status === "collecting" && cat.detail && (
                  <span className="text-xs text-muted-foreground">
                    {cat.detail}
                  </span>
                )}
                {cat.status === "failed" && cat.error && (
                  <span className="text-xs text-red-500 dark:text-red-400">{cat.error}</span>
                )}
              </div>
            ))}
          </div>

          {scanError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
              {scanError}
            </div>
          )}

          {scanDone && (
            <Button
              className="w-full"
              onClick={() => router.push(`/dashboard/csp/${accountId}`)}
            >
              View Results
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className="size-4 ml-2"
              />
            </Button>
          )}

          {scanFailed && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/dashboard/csp/${accountId}`)}
            >
              Back to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
