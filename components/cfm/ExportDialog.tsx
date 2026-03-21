"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileExportIcon,
  File01Icon,
  Loading03Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

type ExportFormat = "excel" | "pdf";

interface ExportDialogProps {
  scanId: string;
  accountName: string;
  serviceCount: number;
}

interface FormatOption {
  id: ExportFormat;
  label: string;
  description: string;
  sections: string[];
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "excel",
    label: "Excel (.xlsx)",
    description: "Full workbook with per-service sheets and pivot-ready tables",
    sections: [
      "Executive Summary — spend, savings, priority breakdown",
      "Per-service sheets — recommendation tables with service-specific columns",
      "Prioritized Action Plan — all recommendations sorted by savings impact",
    ],
  },
  {
    id: "pdf",
    label: "PDF",
    description: "One-page executive summary for management review",
    sections: [
      "Account details header",
      "Spend breakdown by service",
      "Savings by service",
      "Top 10 recommendations table",
    ],
  },
];

type DownloadStatus = "idle" | "loading" | "success" | "error";

interface FormatState {
  selected: boolean;
  status: DownloadStatus;
  error?: string;
}

export function ExportDialog({ scanId, accountName, serviceCount }: ExportDialogProps) {
  const [formats, setFormats] = useState<Record<ExportFormat, FormatState>>({
    excel: { selected: true, status: "idle" },
    pdf: { selected: false, status: "idle" },
  });

  const selectedFormats = (Object.keys(formats) as ExportFormat[]).filter(
    (f) => formats[f].selected,
  );
  const isAnyLoading = (Object.keys(formats) as ExportFormat[]).some(
    (f) => formats[f].status === "loading",
  );

  const toggleFormat = useCallback((format: ExportFormat) => {
    setFormats((prev) => ({
      ...prev,
      [format]: { ...prev[format], selected: !prev[format].selected, status: "idle", error: undefined },
    }));
  }, []);

  const downloadFile = useCallback(
    async (format: ExportFormat) => {
      setFormats((prev) => ({
        ...prev,
        [format]: { ...prev[format], status: "loading", error: undefined },
      }));

      try {
        const res = await fetch("/api/cfm/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanId, format }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Export failed" }));
          throw new Error(body.error ?? "Export failed");
        }

        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
        const fileName = fileNameMatch?.[1] ?? `CFM-Report.${format === "excel" ? "xlsx" : "pdf"}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setFormats((prev) => ({
          ...prev,
          [format]: { ...prev[format], status: "success" },
        }));
      } catch (err) {
        setFormats((prev) => ({
          ...prev,
          [format]: {
            ...prev[format],
            status: "error",
            error: err instanceof Error ? err.message : "Export failed",
          },
        }));
      }
    },
    [scanId],
  );

  const handleExport = useCallback(async () => {
    if (isAnyLoading || selectedFormats.length === 0) return;
    for (const format of selectedFormats) {
      await downloadFile(format);
    }
  }, [isAnyLoading, selectedFormats, downloadFile]);

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-xs text-muted-foreground">
        Generate a report for {accountName}
      </p>

      {/* Format selection */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Select Format</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((opt) => {
            const state = formats[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleFormat(opt.id)}
                disabled={isAnyLoading}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  state.selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                } ${isAnyLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={File01Icon} className="size-4 text-muted-foreground" strokeWidth={2} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <StatusIndicator status={state.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Content preview */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Content Preview</h3>
        {selectedFormats.length === 0 ? (
          <p className="text-xs text-muted-foreground">Select at least one format to see what the report will include.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedFormats.map((format) => {
              const opt = FORMAT_OPTIONS.find((o) => o.id === format)!;
              return (
                <Card key={format} className="gap-0 py-0">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      {opt.label}
                      <Badge variant="secondary" className="text-[10px]">
                        {format === "excel" ? `${serviceCount + 2} sheets` : "1 page"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-2">
                    <ul className="flex flex-col gap-1">
                      {opt.sections.map((section) => (
                        <li key={section} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          {section}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Error messages */}
      {(Object.keys(formats) as ExportFormat[]).map((f) =>
        formats[f].error ? (
          <div key={f} className="flex items-center gap-2 text-xs text-destructive">
            <span>
              {FORMAT_OPTIONS.find((o) => o.id === f)?.label}: {formats[f].error}
            </span>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive"
              onClick={() => downloadFile(f)}
            >
              Retry
            </Button>
          </div>
        ) : null,
      )}

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={selectedFormats.length === 0 || isAnyLoading}
        className="w-fit"
      >
        {isAnyLoading ? (
          <>
            <HugeiconsIcon icon={Loading03Icon} className="animate-spin" data-icon="inline-start" strokeWidth={2} />
            Generating…
          </>
        ) : (
          <>
            <HugeiconsIcon icon={FileExportIcon} data-icon="inline-start" strokeWidth={2} />
            Export {selectedFormats.length > 1 ? "Reports" : "Report"}
          </>
        )}
      </Button>
    </div>
  );
}

function StatusIndicator({ status }: { status: DownloadStatus }) {
  switch (status) {
    case "loading":
      return <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin text-primary" strokeWidth={2} />;
    case "success":
      return <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-green-600" strokeWidth={2} />;
    case "error":
      return <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-destructive" strokeWidth={2} />;
    default:
      return null;
  }
}
