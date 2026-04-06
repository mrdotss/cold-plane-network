"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerIcon,
  DatabaseIcon,
  FolderIcon,
  FunctionIcon,
  DashboardCircleIcon,
  RouterIcon,
  CloudIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { CfmServiceBreakdown } from "@/lib/cfm/types";

const SERVICE_ICONS: Record<string, { icon: IconSvgElement; color: string; bg: string }> = {
  EC2:          { icon: ComputerIcon,         color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950" },
  RDS:          { icon: DatabaseIcon,         color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-100 dark:bg-blue-950" },
  S3:           { icon: FolderIcon,           color: "text-green-600 dark:text-green-400",  bg: "bg-green-100 dark:bg-green-950" },
  Lambda:       { icon: FunctionIcon,         color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-100 dark:bg-amber-950" },
  CloudWatch:   { icon: DashboardCircleIcon,  color: "text-pink-600 dark:text-pink-400",   bg: "bg-pink-100 dark:bg-pink-950" },
  "NAT Gateway":{ icon: RouterIcon,           color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950" },
  CloudTrail:   { icon: CloudIcon,            color: "text-cyan-600 dark:text-cyan-400",   bg: "bg-cyan-100 dark:bg-cyan-950" },
  ECS:          { icon: ComputerIcon,         color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-950" },
};

function getServiceStyle(service: string) {
  return SERVICE_ICONS[service] ?? { icon: CloudIcon, color: "text-muted-foreground", bg: "bg-muted" };
}

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

  const style = getServiceStyle(service.service);

  return (
    <Link
      href={`/dashboard/cfm/${accountId}/${encodeURIComponent(service.service)}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card size="sm" className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <div className={`flex size-7 items-center justify-center rounded-md ${style.bg}`}>
              <HugeiconsIcon icon={style.icon} strokeWidth={2} className={`size-4 ${style.color}`} />
            </div>
            <CardTitle className="text-sm flex-1">{service.service}</CardTitle>
            {service.hasCritical && (
              <Badge variant="destructive" className="text-[10px] px-1.5 h-4">
                Critical
              </Badge>
            )}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              className="size-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
            />
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
            <Progress value={Math.min(savingsPercent, 100)} />
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
