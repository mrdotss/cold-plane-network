"use client";

import { Card, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";

interface SeverityCardsProps {
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const SEVERITY_CONFIG = [
  {
    key: "critical" as const,
    label: "Critical",
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
    icon: Alert02Icon,
  },
  {
    key: "high" as const,
    label: "High",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-900",
    icon: Alert02Icon,
  },
  {
    key: "medium" as const,
    label: "Medium",
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-900",
    icon: InformationCircleIcon,
  },
  {
    key: "low" as const,
    label: "Low",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-900",
    icon: InformationCircleIcon,
  },
];

export function SeverityCards({ severityBreakdown }: SeverityCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {SEVERITY_CONFIG.map((sev) => (
        <Card key={sev.key} className={`${sev.border}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`${sev.bg} p-2 rounded-lg`}>
                <HugeiconsIcon
                  icon={sev.icon}
                  strokeWidth={2}
                  className={`size-5 ${sev.color}`}
                />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {severityBreakdown[sev.key]}
                </div>
                <div className="text-xs text-muted-foreground">{sev.label}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
