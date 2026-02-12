"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AuditEvent } from "./AuditTable";

interface AuditDetailDrawerProps {
  event: AuditEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseMetadataSafe(metadata: string): Record<string, unknown> {
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatDateFull(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function AuditDetailDrawer({
  event,
  open,
  onOpenChange,
}: AuditDetailDrawerProps) {
  if (!event) return null;

  const metadata = parseMetadataSafe(event.metadata);
  const metaEntries = Object.entries(metadata);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Audit Event Detail</SheetTitle>
          <SheetDescription>
            Event ID: {event.id}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Event Type</span>
              <Badge variant="secondary">{event.eventType}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Time</span>
              <span className="text-sm">{formatDateFull(event.createdAt)}</span>
            </div>
            {event.ipAddress && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">IP Address</span>
                <span className="text-sm font-mono">{event.ipAddress}</span>
              </div>
            )}
            {event.userAgent && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">User Agent</span>
                <span className="text-xs font-mono break-all text-muted-foreground">
                  {event.userAgent}
                </span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Metadata</span>
            {metaEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No metadata</p>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
