"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DeltaSummaryCards } from "./DeltaSummaryCards";
import { DeltaTable } from "./DeltaTable";
import type {
  DeltaReport,
  ScanHistoryEntry,
} from "@/lib/cfm/types";

interface DeltaViewProps {
  accountId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DeltaView({ accountId }: DeltaViewProps) {
  const [scans, setScans] = useState<ScanHistoryEntry[]>([]);
  const [fromScanId, setFromScanId] = useState<string>("");
  const [toScanId, setToScanId] = useState<string>("");
  const [delta, setDelta] = useState<DeltaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingScans, setLoadingScans] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch scan history for selectors
  useEffect(() => {
    async function fetchScans() {
      setLoadingScans(true);
      try {
        const res = await fetch(
          `/api/cfm/accounts/${accountId}/history?limit=50`,
        );
        if (!res.ok) throw new Error("Failed to fetch scans");
        const data = await res.json();
        setScans(data.scans);

        // Auto-select the two most recent scans if available
        if (data.scans.length >= 2) {
          setToScanId(data.scans[0].id);
          setFromScanId(data.scans[1].id);
        }
      } catch {
        setError("Failed to load scan history");
      } finally {
        setLoadingScans(false);
      }
    }
    fetchScans();
  }, [accountId]);

  const handleCompare = useCallback(async () => {
    if (!fromScanId || !toScanId) return;
    if (fromScanId === toScanId) {
      setError("Please select two different scans to compare.");
      return;
    }

    setLoading(true);
    setError(null);
    setDelta(null);

    try {
      const res = await fetch(
        `/api/cfm/accounts/${accountId}/compare?from=${fromScanId}&to=${toScanId}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to compare scans");
      }
      const data = await res.json();
      setDelta(data.delta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [accountId, fromScanId, toScanId]);

  if (loadingScans) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 animate-pulse rounded bg-muted w-full max-w-xl" />
        <div className="h-[300px] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (scans.length < 2) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">
          You need at least 2 completed scans to compare. Run more scans to
          unlock delta reports.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Scan selectors */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            From (older)
          </label>
          <Select value={fromScanId} onValueChange={setFromScanId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select base scan" />
            </SelectTrigger>
            <SelectContent>
              {scans.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {formatDate(s.completedAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            To (newer)
          </label>
          <Select value={toScanId} onValueChange={setToScanId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select target scan" />
            </SelectTrigger>
            <SelectContent>
              {scans.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {formatDate(s.completedAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={handleCompare}
          disabled={loading || !fromScanId || !toScanId}
        >
          {loading ? "Comparing..." : "Compare"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Delta results */}
      {delta && (
        <>
          <DeltaSummaryCards summary={delta.summary} />
          <DeltaTable recommendations={delta.recommendations} />
        </>
      )}
    </div>
  );
}
