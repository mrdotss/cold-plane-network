"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AUDIT_EVENT_TYPES } from "@/lib/audit/events";

export interface AuditFilterValues {
  eventType: string;
  from: string;
  to: string;
  search: string;
}

interface AuditFiltersProps {
  filters: AuditFilterValues;
  onFiltersChange: (filters: AuditFilterValues) => void;
  onReset: () => void;
}

export function AuditFilters({
  filters,
  onFiltersChange,
  onReset,
}: AuditFiltersProps) {
  const hasActiveFilters =
    filters.eventType !== "" ||
    filters.from !== "" ||
    filters.to !== "" ||
    filters.search !== "";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-event-type" className="text-xs text-muted-foreground">
          Event Type
        </label>
        <Select
          value={filters.eventType}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, eventType: value === "all" ? "" : value })
          }
        >
          <SelectTrigger id="audit-event-type" className="w-[200px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {AUDIT_EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="audit-from-date" className="text-xs text-muted-foreground">
          From
        </label>
        <Input
          id="audit-from-date"
          type="date"
          value={filters.from}
          onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
          className="w-[160px]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="audit-to-date" className="text-xs text-muted-foreground">
          To
        </label>
        <Input
          id="audit-to-date"
          type="date"
          value={filters.to}
          onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
          className="w-[160px]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="audit-search" className="text-xs text-muted-foreground">
          Search
        </label>
        <Input
          id="audit-search"
          type="text"
          placeholder="Search metadata…"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-[200px]"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
