"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CfmRecommendation, CfmPriority, CfmEffort } from "@/lib/cfm/types";

interface RecommendationsTableProps {
  recommendations: CfmRecommendation[];
}

type SortField = "priority" | "estimatedSavings" | "effort";
type SortDir = "asc" | "desc";

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

export function RecommendationsTable({ recommendations }: RecommendationsTableProps) {
  const [sortField, setSortField] = useState<SortField>("estimatedSavings");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "estimatedSavings" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...recommendations];
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
  }, [recommendations, sortField, sortDir]);

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

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
      <h3 className="text-sm font-medium">Top Recommendations</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("priority")}
              aria-sort={sortField === "priority" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              Priority{sortIndicator("priority")}
            </TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Recommendation</TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => handleSort("estimatedSavings")}
              aria-sort={sortField === "estimatedSavings" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              Monthly Savings{sortIndicator("estimatedSavings")}
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("effort")}
              aria-sort={sortField === "effort" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              Effort{sortIndicator("effort")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((rec) => (
            <TableRow key={rec.id}>
              <TableCell>
                <PriorityBadge priority={rec.priority} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <code className="text-xs font-mono">{rec.resourceId}</code>
                  {rec.resourceName && (
                    <span className="text-xs text-muted-foreground">{rec.resourceName}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[300px]">
                <span className="text-xs">{rec.recommendation}</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(rec.estimatedSavings)}
              </TableCell>
              <TableCell>
                <EffortBadge effort={rec.effort} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
