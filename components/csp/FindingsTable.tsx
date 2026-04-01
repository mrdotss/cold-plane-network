"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  InformationCircleIcon,
  UserIcon,
  Wifi01Icon,
  FolderIcon,
  CloudIcon,
  ShieldIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { CSP_CATEGORIES } from "@/lib/csp/types";

export interface EnrichedCspFinding {
  id: string;
  scanId: string;
  category: string;
  service: string;
  resourceId: string;
  resourceName: string | null;
  severity: string;
  finding: string;
  remediation: string;
  cisReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  trackingId: string | null;
  lifecycleStatus: string | null;
  acknowledgedAt: Date | null;
  remediatedAt: Date | null;
  notes: string | null;
}

interface FindingsTableProps {
  findings: EnrichedCspFinding[];
  accountId: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_CONFIG: Record<
  string,
  { icon: IconSvgElement; color: string; bg: string; label: string }
> = {
  critical: {
    icon: Alert02Icon,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950/50",
    label: "Critical",
  },
  high: {
    icon: Alert02Icon,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950/50",
    label: "High",
  },
  medium: {
    icon: InformationCircleIcon,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-950/50",
    label: "Medium",
  },
  low: {
    icon: InformationCircleIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/50",
    label: "Low",
  },
};

const SERVICE_ICONS: Record<string, { icon: IconSvgElement; color: string }> = {
  IAM: { icon: UserIcon, color: "text-violet-600" },
  EC2: { icon: Wifi01Icon, color: "text-blue-600" },
  VPC: { icon: Wifi01Icon, color: "text-blue-600" },
  S3: { icon: FolderIcon, color: "text-green-600" },
  CloudTrail: { icon: CloudIcon, color: "text-cyan-600" },
  Config: { icon: CloudIcon, color: "text-cyan-600" },
  AccessAnalyzer: { icon: ShieldIcon, color: "text-orange-600" },
};

function statusBadge(status: string | null) {
  if (!status || status === "open") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 border-muted-foreground/30"
      >
        Open
      </Badge>
    );
  }
  if (status === "acknowledged") {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
        Acknowledged
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
      Remediated
    </Badge>
  );
}

export function FindingsTable({ findings, accountId }: FindingsTableProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...findings];
    if (categoryFilter !== "all") {
      result = result.filter((f) => f.category === categoryFilter);
    }
    if (severityFilter !== "all") {
      result = result.filter((f) => f.severity === severityFilter);
    }
    result.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 99) -
        (SEVERITY_ORDER[b.severity] ?? 99),
    );
    return result;
  }, [findings, categoryFilter, severityFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Security Findings ({filtered.length})
          </CardTitle>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CSP_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No findings match the selected filters.
          </div>
        ) : (
          <div className="space-y-1">
            {/* Table header */}
            <div className="grid grid-cols-[24px_28px_1fr_80px_60px_70px] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-1 px-3 border-b">
              <span />
              <span />
              <span>Finding</span>
              <span className="text-center">Service</span>
              <span className="text-center">Status</span>
              <span className="text-right">CIS</span>
            </div>

            {filtered.map((finding) => {
              const isExpanded = expandedId === finding.id;
              const categoryLabel =
                CSP_CATEGORIES.find((c) => c.id === finding.category)?.label ??
                finding.category;
              const sevConfig =
                SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.medium;
              const svcIcon = SERVICE_ICONS[finding.service] ?? {
                icon: ShieldIcon,
                color: "text-muted-foreground",
              };

              return (
                <div
                  key={finding.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    isExpanded ? "border-primary/30" : ""
                  }`}
                >
                  <button
                    className="w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : finding.id)
                    }
                  >
                    <div className="grid grid-cols-[24px_28px_1fr_80px_60px_70px] gap-2 items-center">
                      {/* Expand icon */}
                      <HugeiconsIcon
                        icon={
                          isExpanded ? ArrowDown01Icon : ArrowRight01Icon
                        }
                        strokeWidth={2}
                        className="size-3.5 text-muted-foreground"
                      />

                      {/* Severity icon */}
                      <div
                        className={`${sevConfig.bg} p-1 rounded`}
                      >
                        <HugeiconsIcon
                          icon={sevConfig.icon}
                          strokeWidth={2}
                          className={`size-3.5 ${sevConfig.color}`}
                        />
                      </div>

                      {/* Finding text */}
                      <div className="min-w-0">
                        <div className="text-sm truncate">
                          {finding.finding}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {finding.resourceName ?? finding.resourceId}
                        </div>
                      </div>

                      {/* Service badge */}
                      <div className="flex justify-center">
                        <div className="flex items-center gap-1">
                          <HugeiconsIcon
                            icon={svcIcon.icon}
                            strokeWidth={2}
                            className={`size-3 ${svcIcon.color}`}
                          />
                          <span className="text-xs">{finding.service}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        {statusBadge(finding.lifecycleStatus)}
                      </div>

                      {/* CIS */}
                      <div className="text-right text-xs text-muted-foreground">
                        {finding.cisReference ?? "-"}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10">
                      {/* Top metadata bar */}
                      <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
                        <div
                          className={`${sevConfig.bg} px-2.5 py-0.5 rounded text-xs font-semibold ${sevConfig.color}`}
                        >
                          {sevConfig.label}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {categoryLabel}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <HugeiconsIcon
                            icon={svcIcon.icon}
                            strokeWidth={2}
                            className={`size-3 ${svcIcon.color}`}
                          />
                          {finding.service}
                        </div>
                        {finding.cisReference && (
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            CIS {finding.cisReference}
                          </Badge>
                        )}
                        {statusBadge(finding.lifecycleStatus)}
                      </div>

                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                          {/* Left column: Resource + Context (2/5) */}
                          <div className="lg:col-span-2 space-y-3">
                            <div>
                              <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                                Affected Resource
                              </div>
                              <div className="bg-muted/50 border rounded-lg p-2.5">
                                <div className="text-xs font-mono font-medium break-all">
                                  {finding.resourceId}
                                </div>
                                {finding.resourceName &&
                                  finding.resourceName !==
                                    finding.resourceId && (
                                    <div className="text-[11px] text-muted-foreground mt-1">
                                      {finding.resourceName}
                                    </div>
                                  )}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                                What was detected
                              </div>
                              <div className="text-sm leading-relaxed">
                                {finding.finding}
                              </div>
                            </div>

                            {finding.cisReference && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-2.5">
                                <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-0.5 uppercase tracking-wider">
                                  Compliance Reference
                                </div>
                                <div className="text-sm font-medium">
                                  CIS AWS Foundations Benchmark v3.0
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Section {finding.cisReference}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right column: Remediation (3/5) — hero section */}
                          <div className="lg:col-span-3">
                            <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                              Remediation Steps
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3">
                              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                {finding.remediation}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
