"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CfmScanSummary } from "@/lib/cfm/types";

interface SummaryCardsProps {
  summary: CfmScanSummary;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const savingsPercent =
    summary.totalMonthlySpend > 0
      ? Math.round(
          (summary.totalPotentialSavings / summary.totalMonthlySpend) * 100,
        )
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Monthly Spend */}
      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs text-muted-foreground font-normal">
            Monthly Spend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-xl font-semibold">
            {formatCurrency(summary.totalMonthlySpend)}
          </span>
        </CardContent>
      </Card>

      {/* Potential Savings */}
      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs text-muted-foreground font-normal">
            Potential Savings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-baseline gap-2">
          <span className="text-xl font-semibold">
            {formatCurrency(summary.totalPotentialSavings)}
          </span>
          {savingsPercent > 0 && (
            <span className="text-xs text-muted-foreground">
              {savingsPercent}% of spend
            </span>
          )}
        </CardContent>
      </Card>

      {/* Total Recommendations */}
      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs text-muted-foreground font-normal">
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-xl font-semibold">
            {summary.recommendationCount}
          </span>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs text-muted-foreground font-normal">
            Priority Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-1.5">
          {summary.priorityBreakdown.critical > 0 && (
            <Badge variant="destructive">
              {summary.priorityBreakdown.critical} Critical
            </Badge>
          )}
          {summary.priorityBreakdown.medium > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
              {summary.priorityBreakdown.medium} Medium
            </Badge>
          )}
          {summary.priorityBreakdown.low > 0 && (
            <Badge variant="secondary">
              {summary.priorityBreakdown.low} Low
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
