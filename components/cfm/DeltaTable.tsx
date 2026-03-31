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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DeltaCategory, DeltaRecommendation } from "@/lib/cfm/types";

interface DeltaTableProps {
  recommendations: DeltaRecommendation[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CategoryBadge({ category }: { category: DeltaCategory }) {
  switch (category) {
    case "new":
      return <Badge variant="destructive">New</Badge>;
    case "resolved":
      return (
        <Badge
          variant="outline"
          className="border-green-500/50 text-green-600 dark:text-green-400"
        >
          Resolved
        </Badge>
      );
    case "changed":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/50 text-amber-600 dark:text-amber-400"
        >
          Changed
        </Badge>
      );
    case "unchanged":
      return <Badge variant="secondary">Unchanged</Badge>;
  }
}

const ROW_BG: Record<DeltaCategory, string> = {
  new: "bg-red-50/50 dark:bg-red-950/10",
  resolved: "bg-green-50/50 dark:bg-green-950/10",
  changed: "bg-amber-50/50 dark:bg-amber-950/10",
  unchanged: "",
};

type FilterTab = "all" | DeltaCategory;

export function DeltaTable({ recommendations }: DeltaTableProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const counts = useMemo(() => {
    const c = { all: recommendations.length, new: 0, resolved: 0, changed: 0, unchanged: 0 };
    for (const r of recommendations) c[r.category]++;
    return c;
  }, [recommendations]);

  const filtered = useMemo(() => {
    if (filter === "all") return recommendations;
    return recommendations.filter((r) => r.category === filter);
  }, [recommendations, filter]);

  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No differences found between the selected scans.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {counts.all}
            </span>
          </TabsTrigger>
          <TabsTrigger value="new">
            New
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {counts.new}
            </span>
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {counts.resolved}
            </span>
          </TabsTrigger>
          <TabsTrigger value="changed">
            Changed
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {counts.changed}
            </span>
          </TabsTrigger>
          <TabsTrigger value="unchanged">
            Unchanged
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">
              {counts.unchanged}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[80px]">Service</TableHead>
              <TableHead className="w-[180px]">Resource</TableHead>
              <TableHead>Recommendation</TableHead>
              <TableHead className="w-[130px] text-right">
                Savings
              </TableHead>
              <TableHead className="w-[130px] text-right">
                Change
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((rec, idx) => {
              const current = rec.current;
              const previous = rec.previous;
              const savings =
                current?.estimatedSavings ?? previous?.estimatedSavings ?? 0;
              const prevSavings = previous?.estimatedSavings ?? 0;
              const savingsChange =
                rec.category === "changed"
                  ? (current?.estimatedSavings ?? 0) - prevSavings
                  : 0;

              return (
                <TableRow key={`${rec.resourceId}-${rec.service}-${idx}`} className={ROW_BG[rec.category]}>
                  <TableCell>
                    <CategoryBadge category={rec.category} />
                  </TableCell>
                  <TableCell className="text-xs">{rec.service}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <code className="text-xs font-mono">
                        {rec.resourceId}
                      </code>
                      {rec.resourceName && (
                        <span className="text-xs text-muted-foreground">
                          {rec.resourceName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[400px]">
                    <span className="text-xs line-clamp-2">
                      {current?.recommendation ??
                        previous?.recommendation ??
                        "—"}
                    </span>
                    {rec.changes?.recommendationChanged && previous && (
                      <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        Was: {previous.recommendation}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(savings)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {rec.category === "changed" && savingsChange !== 0 ? (
                      <span
                        className={
                          savingsChange > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {savingsChange > 0 ? "+" : ""}
                        {formatCurrency(savingsChange)}
                      </span>
                    ) : rec.category === "new" ? (
                      <span className="text-red-600 dark:text-red-400">New</span>
                    ) : rec.category === "resolved" ? (
                      <span className="text-green-600 dark:text-green-400">
                        Fixed
                      </span>
                    ) : (
                      "—"
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
