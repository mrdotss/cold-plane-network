"use client";

import { Card, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoneyBag02Icon,
  AnalyticsUpIcon,
  AiInnovation01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

interface AggregatedStats {
  totalAccounts: number;
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  totalRecommendations: number;
  totalCritical: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatCard({
  icon,
  label,
  value,
  className,
}: {
  icon: IconSvgElement;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-muted">
          <HugeiconsIcon
            icon={icon}
            strokeWidth={1.5}
            className={`size-5 ${className ?? "text-muted-foreground"}`}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-lg font-semibold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AggregatedSummary({ stats }: { stats: AggregatedStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={MoneyBag02Icon}
        label="Total Monthly Spend"
        value={formatCurrency(stats.totalMonthlySpend)}
      />
      <StatCard
        icon={AnalyticsUpIcon}
        label="Potential Savings"
        value={formatCurrency(stats.totalPotentialSavings)}
        className="text-green-600 dark:text-green-400"
      />
      <StatCard
        icon={AiInnovation01Icon}
        label="Total Recommendations"
        value={String(stats.totalRecommendations)}
      />
      <StatCard
        icon={Cancel01Icon}
        label="Critical Issues"
        value={String(stats.totalCritical)}
        className={stats.totalCritical > 0 ? "text-destructive" : undefined}
      />
    </div>
  );
}
