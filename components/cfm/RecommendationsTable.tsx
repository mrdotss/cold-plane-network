"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LifecycleStatusBadge } from "./LifecycleStatusBadge";
import { LifecycleActions } from "./LifecycleActions";
import type {
  CfmPriority,
  CfmEffort,
  EnrichedRecommendation,
  RecommendationLifecycleStatus,
} from "@/lib/cfm/types";

interface RecommendationsTableProps {
  recommendations: EnrichedRecommendation[];
  accountId: string;
}

type SortField = "priority" | "estimatedSavings" | "effort";
type SortDir = "asc" | "desc";
type LifecycleFilter = "all" | RecommendationLifecycleStatus;

const PRIORITY_ORDER: Record<CfmPriority, number> = {
  critical: 0,
  medium: 1,
  low: 2,
};

const EFFORT_ORDER: Record<CfmEffort, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function PriorityBadge({ priority }: { priority: CfmPriority }) {
  switch (priority) {
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "medium":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
          Medium
        </Badge>
      );
    case "low":
      return <Badge variant="secondary">Low</Badge>;
  }
}

function EffortBadge({ effort }: { effort: CfmEffort }) {
  switch (effort) {
    case "low":
      return <Badge variant="secondary">Low</Badge>;
    case "medium":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
          Medium
        </Badge>
      );
    case "high":
      return <Badge variant="destructive">High</Badge>;
  }
}

export function RecommendationsTable({ recommendations, accountId }: RecommendationsTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>("estimatedSavings");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "estimatedSavings" ? "desc" : "asc");
    }
  };

  const handleStatusChange = useCallback(() => {
    router.refresh();
  }, [router]);

  // Count by lifecycle status
  const lifecycleCounts = useMemo(() => {
    const counts: Record<LifecycleFilter, number> = {
      all: recommendations.length,
      open: 0,
      acknowledged: 0,
      implemented: 0,
      verified: 0,
    };
    for (const rec of recommendations) {
      const status = rec.lifecycleStatus ?? "open";
      counts[status]++;
    }
    return counts;
  }, [recommendations]);

  // Filter by lifecycle
  const filtered = useMemo(() => {
    if (lifecycleFilter === "all") return recommendations;
    return recommendations.filter(
      (r) => (r.lifecycleStatus ?? "open") === lifecycleFilter,
    );
  }, [recommendations, lifecycleFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortField) {
        case "priority":
          return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
        case "estimatedSavings":
          return (a.estimatedSavings - b.estimatedSavings) * dir;
        case "effort":
          return (EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort]) * dir;
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Top Recommendations</h3>
        <p className="text-sm text-muted-foreground py-6 text-center">
          No recommendations found for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Top Recommendations</h3>
      </div>

      {/* Lifecycle filter tabs */}
      <Tabs
        value={lifecycleFilter}
        onValueChange={(v) => setLifecycleFilter(v as LifecycleFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">
            All
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {lifecycleCounts.all}
            </span>
          </TabsTrigger>
          <TabsTrigger value="open">
            Open
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {lifecycleCounts.open}
            </span>
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {lifecycleCounts.acknowledged}
            </span>
          </TabsTrigger>
          <TabsTrigger value="implemented">
            Implemented
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {lifecycleCounts.implemented}
            </span>
          </TabsTrigger>
          <TabsTrigger value="verified">
            Verified
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {lifecycleCounts.verified}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="w-[90px] cursor-pointer select-none"
              onClick={() => handleSort("priority")}
              aria-sort={sortField === "priority" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              Priority{sortIndicator("priority")}
            </TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[180px]">Resource</TableHead>
            <TableHead>Recommendation</TableHead>
            <TableHead
              className="w-[130px] cursor-pointer select-none text-right"
              onClick={() => handleSort("estimatedSavings")}
              aria-sort={sortField === "estimatedSavings" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              Monthly Savings{sortIndicator("estimatedSavings")}
            </TableHead>
            <TableHead
              className="w-[80px] cursor-pointer select-none"
              onClick={() => handleSort("effort")}
              aria-sort={sortField === "effort" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              Effort{sortIndicator("effort")}
            </TableHead>
            <TableHead className="w-[140px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((rec) => {
            const lifecycleStatus = (rec.lifecycleStatus ?? "open") as RecommendationLifecycleStatus;
            return (
              <TableRow key={rec.id}>
                <TableCell>
                  <PriorityBadge priority={rec.priority} />
                </TableCell>
                <TableCell>
                  <LifecycleStatusBadge status={lifecycleStatus} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <code className="text-xs font-mono">{rec.resourceId}</code>
                    {rec.resourceName && (
                      <span className="text-xs text-muted-foreground">{rec.resourceName}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[400px]">
                  <span className="text-xs line-clamp-2">{rec.recommendation}</span>
                  {rec.notes && (
                    <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                      Note: {rec.notes}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(rec.estimatedSavings)}
                </TableCell>
                <TableCell>
                  <EffortBadge effort={rec.effort} />
                </TableCell>
                <TableCell>
                  {rec.trackingId ? (
                    <LifecycleActions
                      trackingId={rec.trackingId}
                      currentStatus={lifecycleStatus}
                      accountId={accountId}
                      onStatusChange={handleStatusChange}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
