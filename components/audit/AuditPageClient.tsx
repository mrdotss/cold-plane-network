"use client";

import { useCallback, useEffect, useState } from "react";
import { AuditTable, type AuditEvent, type AuditPagination } from "./AuditTable";
import { AuditFilters, type AuditFilterValues } from "./AuditFilters";
import { AuditDetailDrawer } from "./AuditDetailDrawer";

const DEFAULT_FILTERS: AuditFilterValues = {
  eventType: "",
  from: "",
  to: "",
  search: "",
};

interface AuditApiResponse {
  events: AuditEvent[];
  pagination: AuditPagination;
  error?: string;
}

export function AuditPageClient() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pagination, setPagination] = useState<AuditPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilterValues>(DEFAULT_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (filters.eventType) params.set("eventType", filters.eventType);
    if (filters.from) params.set("from", new Date(filters.from).toISOString());
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      params.set("to", toDate.toISOString());
    }

    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) {
        setEvents([]);
        setPagination(null);
        return;
      }
      const data = (await res.json()) as AuditApiResponse;
      let filteredEvents = data.events;

      // Client-side text search on metadata (the API doesn't support text search)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        filteredEvents = filteredEvents.filter(
          (e) =>
            e.metadata.toLowerCase().includes(q) ||
            e.eventType.toLowerCase().includes(q)
        );
      }

      setEvents(filteredEvents);
      setPagination(data.pagination);
    } catch {
      setEvents([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleFiltersChange(newFilters: AuditFilterValues) {
    setFilters(newFilters);
    setPage(1);
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  function handleEventClick(event: AuditEvent) {
    setSelectedEvent(event);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <AuditFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleReset}
      />
      <AuditTable
        events={events}
        pagination={pagination}
        loading={loading}
        onPageChange={setPage}
        onEventClick={handleEventClick}
      />
      <AuditDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
