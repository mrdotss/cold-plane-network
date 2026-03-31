"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendChart } from "./TrendChart";
import { ScanHistoryTable } from "./ScanHistoryTable";
import type { ScanHistoryEntry, TrendDataPoint } from "@/lib/cfm/types";

interface ScanHistoryViewProps {
  accountId: string;
}

export function ScanHistoryView({ accountId }: ScanHistoryViewProps) {
  const [scans, setScans] = useState<ScanHistoryEntry[]>([]);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cfm/accounts/${accountId}/history?limit=50`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch history");
      }
      const data = await res.json();
      setScans(data.scans);
      setTrend(data.trend);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load scan history",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-[340px] animate-pulse rounded-xl bg-muted" />
        <div className="h-[200px] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TrendChart data={trend} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Scan History</h3>
          <span className="text-xs text-muted-foreground">
            {total} completed scan{total !== 1 ? "s" : ""}
          </span>
        </div>
        <ScanHistoryTable scans={scans} accountId={accountId} />
      </div>
    </div>
  );
}
