"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { CfmServiceBreakdown } from "@/lib/cfm/types";

interface ServiceCardProps {
  accountId: string;
  service: CfmServiceBreakdown;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ServiceCard({ accountId, service }: ServiceCardProps) {
  const savingsPercent =
    service.currentSpend > 0
      ? Math.round((service.potentialSavings / service.currentSpend) * 100)
      : 0;

  return (
    <Link
      href={`/dashboard/cfm/${accountId}/${encodeURIComponent(service.service)}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card size="sm" className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">{service.service}</CardTitle>
            {service.hasCritical && (
              <Badge variant="destructive" className="text-[10px] px-1.5 h-4">
                Critical
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-semibold">
              {formatCurrency(service.potentialSavings)}
            </span>
            <span className="text-xs text-muted-foreground">
              of {formatCurrency(service.currentSpend)}
            </span>
          </div>

          {/* Savings progress bar */}
          <div className="flex flex-col gap-1">
            <Progress value={savingsPercent} />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{savingsPercent}% savings</span>
              <span>
                {service.resourceCount} resource{service.resourceCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Recommendation type badges */}
          {service.recommendationTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {service.recommendationTypes.map((type) => (
                <Badge key={type} variant="secondary" className="text-[10px] px-1.5 h-4">
                  {type}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
