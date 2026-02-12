"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface AuditEvent {
  id: string;
  userId: string;
  eventType: string;
  metadata: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AuditTableProps {
  events: AuditEvent[];
  pagination: AuditPagination | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  onEventClick: (event: AuditEvent) => void;
}

function eventTypeBadgeVariant(eventType: string) {
  if (eventType.startsWith("AUTH_LOGIN_FAILURE")) return "destructive" as const;
  if (eventType.startsWith("AUTH_")) return "secondary" as const;
  if (eventType.startsWith("STUDIO_")) return "default" as const;
  return "outline" as const;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetadata(metadata: string): string {
  try {
    const parsed = JSON.parse(metadata);
    const entries = Object.entries(parsed).filter(([k]) => k !== "_truncated");
    if (entries.length === 0) return "";
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  } catch {
    return "";
  }
}

function MetadataPreview({ metadata }: { metadata: string }) {
  const text = formatMetadata(metadata);
  if (!text) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-muted-foreground truncate max-w-[200px] inline-block">
      {text}
    </span>
  );
}

export function AuditTable({
  events,
  pagination,
  loading,
  onPageChange,
  onEventClick,
}: AuditTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground text-sm">No audit events found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Event Type</TableHead>
            <TableHead>Metadata</TableHead>
            <TableHead>IP Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow
              key={event.id}
              className="cursor-pointer"
              onClick={() => onEventClick(event)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventClick(event);
                }
              }}
            >
              <TableCell className="text-xs">{formatDate(event.createdAt)}</TableCell>
              <TableCell>
                <Badge variant={eventTypeBadgeVariant(event.eventType)}>
                  {event.eventType}
                </Badge>
              </TableCell>
              <TableCell>
                <MetadataPreview metadata={event.metadata} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {event.ipAddress ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
