"use client";

import { useState, useEffect } from "react";

interface AutofillProgressProps {
  serviceCount: number;
  /** Current batch index (0-based). When provided, shows real progress. */
  currentBatch?: number;
  /** Total number of batches. */
  totalBatches?: number;
  /** Name of the service currently being processed. */
  currentServiceName?: string;
  /** Number of services that completed successfully so far. */
  completedCount?: number;
  /** Number of services that failed so far. */
  failedCount?: number;
  /** High-level phase for live status display. */
  phase?: "sending" | "parsing" | "done";
  /** Number of services parsed so far (used with phase="parsing"). */
  parsedCount?: number;
}

export function AutofillProgress({
  serviceCount,
  currentBatch,
  totalBatches,
  currentServiceName,
  completedCount = 0,
  failedCount = 0,
  phase,
  parsedCount = 0,
}: AutofillProgressProps) {
  const [dots, setDots] = useState("");

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Phase-based progress takes priority when available
  const hasPhase = phase !== undefined;
  const phasePercent =
    phase === "done"
      ? 100
      : phase === "parsing"
        ? parsedCount > 0 && serviceCount > 0
          ? Math.round((parsedCount / serviceCount) * 100)
          : 50
        : 0;

  const hasRealProgress = hasPhase
    ? phase === "parsing" || phase === "done"
    : currentBatch !== undefined && totalBatches !== undefined && totalBatches > 0;

  const progressPercent = hasPhase
    ? phasePercent
    : hasRealProgress && currentBatch !== undefined && totalBatches !== undefined
      ? Math.round(((currentBatch + 1) / totalBatches) * 100)
      : 0;

  let statusText: string;
  if (hasPhase) {
    if (phase === "sending") {
      statusText = `Sending ${serviceCount} service${serviceCount !== 1 ? "s" : ""} to AI Agent${dots}`;
    } else if (phase === "parsing") {
      statusText = `Parsing results: ${parsedCount} of ${serviceCount} services matched${dots}`;
    } else {
      statusText = `Done — ${parsedCount} service${parsedCount !== 1 ? "s" : ""} filled`;
    }
  } else if (hasRealProgress && currentBatch !== undefined && totalBatches !== undefined) {
    statusText = currentServiceName
      ? `Processing service ${currentBatch + 1} of ${totalBatches}: ${currentServiceName}${dots}`
      : `Processing service ${currentBatch + 1} of ${totalBatches}${dots}`;
  } else {
    statusText = `Preparing to look up ${serviceCount} service${serviceCount !== 1 ? "s" : ""}${dots}`;
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
      <div className="flex items-center gap-3">
        {/* Animated AI icon */}
        <div className="relative flex size-10 shrink-0 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-400/20" />
          <div className="relative flex size-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
            <svg
              className="size-5 animate-pulse text-purple-600 dark:text-purple-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
            AI Agent pricing lookup — {serviceCount} service{serviceCount !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 transition-opacity duration-300">
            {statusText}
          </p>
        </div>
      </div>

      {/* Progress bar — real or shimmer */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-purple-200 dark:bg-purple-800">
        {hasRealProgress ? (
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              phase === "done"
                ? "bg-gradient-to-r from-green-500 to-green-600"
                : "bg-gradient-to-r from-purple-500 to-purple-600"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500"
            style={{
              width: "40%",
              animation: "shimmer 2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Stats row */}
      {hasRealProgress && (completedCount > 0 || failedCount > 0) && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {completedCount > 0 && (
            <span className="text-green-600 dark:text-green-400">
              ✓ {completedCount} done
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">
              ⚠ {failedCount} skipped
            </span>
          )}
          <span className="text-purple-500 dark:text-purple-400">
            {progressPercent}%
          </span>
        </div>
      )}
    </div>
  );
}
