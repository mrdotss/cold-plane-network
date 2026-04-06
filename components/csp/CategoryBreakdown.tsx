"use client";

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
import type { CspCategory } from "@/lib/csp/types";
import { CSP_CATEGORIES } from "@/lib/csp/types";
import type { EnrichedCspFinding } from "./FindingsTable";

interface CategoryBreakdownProps {
  categoryBreakdown: Record<CspCategory, number>;
  totalFindings: number;
  findings: EnrichedCspFinding[];
}

const CATEGORY_ICONS: Record<
  CspCategory,
  { icon: IconSvgElement; color: string; bg: string }
> = {
  identity_access: {
    icon: UserIcon,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-950",
  },
  network: {
    icon: Wifi01Icon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950",
  },
  data_protection: {
    icon: FolderIcon,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-950",
  },
  logging: {
    icon: CloudIcon,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-950",
  },
  external_access: {
    icon: ShieldIcon,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950",
  },
};

export function CategoryBreakdown({
  categoryBreakdown,
  totalFindings,
  findings,
}: CategoryBreakdownProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {CSP_CATEGORIES.map((cat) => {
        const count = categoryBreakdown[cat.id] ?? 0;
        const style = CATEGORY_ICONS[cat.id];

        // Calculate severity distribution for this category
        const catFindings = findings.filter((f) => f.category === cat.id);
        const critical = catFindings.filter(
          (f) => f.severity === "critical",
        ).length;
        const high = catFindings.filter((f) => f.severity === "high").length;
        const medium = catFindings.filter(
          (f) => f.severity === "medium",
        ).length;
        const low = catFindings.filter((f) => f.severity === "low").length;

        return (
          <Card key={cat.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`${style.bg} p-2 rounded-lg`}>
                  <HugeiconsIcon
                    icon={style.icon}
                    strokeWidth={2}
                    className={`size-4 ${style.color}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cat.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {count} finding{count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {count > 0 ? (
                <>
                  {/* Severity bar */}
                  <div className="flex h-2 rounded-full overflow-hidden mb-2">
                    {critical > 0 && (
                      <div
                        className="bg-red-500 dark:bg-red-400"
                        style={{ width: `${(critical / count) * 100}%` }}
                      />
                    )}
                    {high > 0 && (
                      <div
                        className="bg-orange-500 dark:bg-orange-400"
                        style={{ width: `${(high / count) * 100}%` }}
                      />
                    )}
                    {medium > 0 && (
                      <div
                        className="bg-yellow-500 dark:bg-yellow-400"
                        style={{ width: `${(medium / count) * 100}%` }}
                      />
                    )}
                    {low > 0 && (
                      <div
                        className="bg-blue-400 dark:bg-blue-300"
                        style={{ width: `${(low / count) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
                    {critical > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                        <span className="font-medium text-foreground">{critical}</span> crit
                      </span>
                    )}
                    {high > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                        <span className="font-medium text-foreground">{high}</span> high
                      </span>
                    )}
                    {medium > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="font-medium text-foreground">{medium}</span> med
                      </span>
                    )}
                    {low > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                        <span className="font-medium text-foreground">{low}</span> low
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-2 rounded-full bg-green-200 dark:bg-green-950 mb-2" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
