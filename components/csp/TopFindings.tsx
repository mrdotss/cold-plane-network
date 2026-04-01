"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserIcon,
  Wifi01Icon,
  FolderIcon,
  CloudIcon,
  ShieldIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { EnrichedCspFinding } from "./FindingsTable";

interface TopFindingsProps {
  findings: EnrichedCspFinding[];
}

const SERVICE_ICONS: Record<string, { icon: IconSvgElement; color: string }> = {
  IAM: { icon: UserIcon, color: "text-violet-600" },
  EC2: { icon: Wifi01Icon, color: "text-blue-600" },
  VPC: { icon: Wifi01Icon, color: "text-blue-600" },
  S3: { icon: FolderIcon, color: "text-green-600" },
  CloudTrail: { icon: CloudIcon, color: "text-cyan-600" },
  Config: { icon: CloudIcon, color: "text-cyan-600" },
  AccessAnalyzer: { icon: ShieldIcon, color: "text-orange-600" },
};

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-500";
    default:
      return "bg-blue-400";
  }
}

export function TopFindings({ findings }: TopFindingsProps) {
  // Group findings by finding text (rule), take top 8
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        finding: string;
        service: string;
        severity: string;
        cisReference: string | null;
        count: number;
        resources: string[];
      }
    >();

    for (const f of findings) {
      // Normalize: strip specific resource names for grouping
      const key = `${f.service}::${f.severity}::${f.finding.replace(/"[^"]*"/g, '"..."')}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (existing.resources.length < 3) {
          existing.resources.push(
            f.resourceName ?? f.resourceId,
          );
        }
      } else {
        map.set(key, {
          finding: f.finding,
          service: f.service,
          severity: f.severity,
          cisReference: f.cisReference,
          count: 1,
          resources: [f.resourceName ?? f.resourceId],
        });
      }
    }

    const SEVERITY_ORDER: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return Array.from(map.values())
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) -
            (SEVERITY_ORDER[b.severity] ?? 99) || b.count - a.count,
      )
      .slice(0, 8);
  }, [findings]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Issues
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {grouped.length} rules
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-1 border-b">
          <span>Rule</span>
          <span className="text-center">Issues</span>
          <span className="text-center">Severity</span>
          <span className="text-right">CIS</span>
        </div>

        {grouped.map((group, idx) => {
          const svcStyle = SERVICE_ICONS[group.service] ?? {
            icon: ShieldIcon,
            color: "text-muted-foreground",
          };

          return (
            <div
              key={idx}
              className="grid grid-cols-[1fr_80px_80px_60px] gap-2 items-center py-2 border-b last:border-0"
            >
              {/* Rule */}
              <div className="flex items-center gap-2 min-w-0">
                <HugeiconsIcon
                  icon={svcStyle.icon}
                  strokeWidth={2}
                  className={`size-4 shrink-0 ${svcStyle.color}`}
                />
                <div className="min-w-0">
                  <div className="text-sm truncate">{group.finding}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {group.service}
                  </div>
                </div>
              </div>

              {/* Count */}
              <div className="text-center">
                <span className="text-sm font-medium">{group.count}</span>
              </div>

              {/* Severity */}
              <div className="flex justify-center">
                <Badge
                  className={`text-[10px] px-2 ${
                    group.severity === "critical"
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                      : group.severity === "high"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                        : group.severity === "medium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                  }`}
                >
                  {group.severity}
                </Badge>
              </div>

              {/* CIS */}
              <div className="text-right text-xs text-muted-foreground">
                {group.cisReference ?? "-"}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
