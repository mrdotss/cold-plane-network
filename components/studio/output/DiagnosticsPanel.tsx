"use client";

import type { SpecDiagnostic } from "@/lib/spec/schema";
import { cn } from "@/lib/utils";

interface DiagnosticsPanelProps {
  diagnostics: SpecDiagnostic[];
  onDiagnosticClick?: (diagnostic: SpecDiagnostic) => void;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  error: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    label: "ERR",
  },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "WARN",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    label: "INFO",
  },
};

export function DiagnosticsPanel({
  diagnostics,
  onDiagnosticClick,
}: DiagnosticsPanelProps) {
  if (diagnostics.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
        No diagnostics — spec is valid
      </div>
    );
  }

  return (
    <div className="p-1 space-y-0.5">
      {diagnostics.map((d, i) => {
        const style = SEVERITY_STYLES[d.severity] ?? SEVERITY_STYLES.info;
        const hasLocation = d.line != null || d.nodeId != null;

        return (
          <button
            key={`${d.severity}-${d.message}-${i}`}
            onClick={() => onDiagnosticClick?.(d)}
            disabled={!hasLocation}
            className={cn(
              "w-full text-left rounded px-2 py-1.5 text-xs flex items-start gap-2 transition-colors",
              hasLocation && "hover:bg-muted/50 cursor-pointer",
              !hasLocation && "cursor-default"
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-mono font-medium",
                style.bg,
                style.text
              )}
            >
              {style.label}
            </span>
            <span className="text-foreground min-w-0">
              {d.message}
              {d.line != null && (
                <span className="text-muted-foreground ml-1">
                  (line {d.line}{d.column != null ? `:${d.column}` : ""})
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
