"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DeltaSummary } from "@/lib/cfm/types";

interface DeltaSummaryCardsProps {
  summary: DeltaSummary;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function ChangeIndicator({ value, inverse }: { value: number; inverse?: boolean }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">No change</span>;

  const isPositive = value > 0;
  // For spend: positive is bad (red), negative is good (green)
  // For savings: positive is good (green), negative is bad (red)
  const isGood = inverse ? !isPositive : isPositive;

  return (
    <span
      className={`text-xs font-medium ${isGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
    >
      {isPositive ? "+" : ""}
      {formatCurrency(value)}
    </span>
  );
}

export function DeltaSummaryCards({ summary }: DeltaSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Spend Change */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Spend Change
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeIndicator value={summary.spendChange} inverse />
        </CardContent>
      </Card>

      {/* Savings Change */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Savings Change
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeIndicator value={summary.savingsChange} />
        </CardContent>
      </Card>

      {/* Recommendation Changes */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            New Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold">{summary.newCount}</span>
            {summary.resolvedCount > 0 && (
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-600 dark:text-green-400 text-[10px]"
              >
                {summary.resolvedCount} resolved
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Changed / Unchanged */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Existing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            {summary.changedCount > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px]"
              >
                {summary.changedCount} changed
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {summary.unchangedCount} unchanged
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
