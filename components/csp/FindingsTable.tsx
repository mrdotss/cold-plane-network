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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  InformationCircleIcon,
  UserIcon,
  Wifi01Icon,
  FolderIcon,
  CloudIcon,
  ShieldIcon,
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
  {
    icon: IconSvgElement;
    color: string;
    bg: string;
    label: string;
    border: string;
  }
> = {
  critical: {
    icon: Alert02Icon,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950/50",
    border: "border-red-200 dark:border-red-800",
    label: "Critical",
  },
  high: {
    icon: Alert02Icon,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950/50",
    border: "border-orange-200 dark:border-orange-800",
    label: "High",
  },
  medium: {
    icon: InformationCircleIcon,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-950/50",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "Medium",
  },
  low: {
    icon: InformationCircleIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/50",
    border: "border-blue-200 dark:border-blue-800",
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

/**
 * Parse remediation text into step-by-step instructions.
 * Handles: numbered steps ("1. xxx"), newline-separated sentences,
 * or single instruction (wrapped as step 1).
 */
function parseRemediationSteps(text: string): string[] {
  if (!text) return [];

  // If the text already has numbered steps (1. 2. 3.)
  const numberedMatch = text.match(/^\d+[\.\)]/m);
  if (numberedMatch) {
    const steps = text
      .split(/\n?\d+[\.\)]\s*/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim().replace(/\n/g, " "));
    if (steps.length > 1) return steps;
  }

  // If there are bullet points
  if (text.includes("\n- ") || text.includes("\n• ")) {
    const steps = text
      .split(/\n[-•]\s*/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim().replace(/\n/g, " "));
    if (steps.length > 1) return steps;
  }

  // Split by newlines (common for multi-line remediation)
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length > 1) return lines;

  // Single instruction — split by sentence-like patterns for longer text
  if (text.length > 120) {
    const sentences = text
      .split(/(?<=\.)\s+(?=[A-Z])/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length > 1) return sentences;
  }

  return [text];
}

// ─── Finding Detail Sheet ──────────────────────────────────────────────────

function FindingDetailSheet({
  finding,
  open,
  onOpenChange,
}: {
  finding: EnrichedCspFinding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sevConfig = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.medium;
  const svcIcon = SERVICE_ICONS[finding.service] ?? {
    icon: ShieldIcon,
    color: "text-muted-foreground",
  };
  const categoryLabel =
    CSP_CATEGORIES.find((c) => c.id === finding.category)?.label ??
    finding.category;
  const steps = parseRemediationSteps(finding.remediation);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md data-[side=right]:sm:max-w-md w-full overflow-y-auto p-0"
        showCloseButton={false}
      >
        {/* Header — clean white, severity shown via badge color */}
        <div className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={`${sevConfig.bg} border ${sevConfig.border} px-2.5 py-0.5 rounded text-xs font-semibold ${sevConfig.color}`}
              >
                {sevConfig.label}
              </div>
              <Badge variant="outline" className="text-xs">
                {categoryLabel}
              </Badge>
              {statusBadge(finding.lifecycleStatus)}
            </div>
            <SheetClose className="rounded-full p-1.5 hover:bg-muted transition-colors">
              <svg
                width="14"
                height="14"
                viewBox="0 0 15 15"
                fill="none"
                className="text-foreground"
              >
                <path
                  d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </SheetClose>
          </div>
          <SheetTitle className="text-base leading-snug pr-6">
            {finding.finding}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Security finding detail
          </SheetDescription>
        </div>

        {/* Body content */}
        <div className="px-5 py-5 space-y-5">
          {/* Service & Resource */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-muted p-1.5 rounded">
                <HugeiconsIcon
                  icon={svcIcon.icon}
                  strokeWidth={2}
                  className={`size-4 ${svcIcon.color}`}
                />
              </div>
              <div>
                <div className="text-sm font-medium">{finding.service}</div>
                <div className="text-[11px] text-muted-foreground">
                  AWS Service
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Affected Resource
              </div>
              <div className="bg-muted/50 border rounded-lg p-3">
                <div className="text-xs font-mono font-medium break-all">
                  {finding.resourceId}
                </div>
                {finding.resourceName &&
                  finding.resourceName !== finding.resourceId && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {finding.resourceName}
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* What was detected */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              What was detected
            </div>
            <p className="text-sm leading-relaxed">{finding.finding}</p>
          </div>

          {/* Remediation Steps — numbered list */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">
              Remediation Steps
            </div>
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Compliance Reference */}
          {finding.cisReference && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3">
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
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Findings Table ───────────────────────────────────────────────────

export function FindingsTable({ findings, accountId }: FindingsTableProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedFinding, setSelectedFinding] =
    useState<EnrichedCspFinding | null>(null);

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
    <>
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
              <div className="grid grid-cols-[20px_1fr_80px_60px_50px] gap-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-1 px-3 border-b">
                <span />
                <span>Finding</span>
                <span className="text-center">Service</span>
                <span className="text-center">Status</span>
                <span className="text-right">CIS</span>
              </div>

              {filtered.map((finding) => {
                const sevConfig =
                  SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.medium;
                const svcIcon = SERVICE_ICONS[finding.service] ?? {
                  icon: ShieldIcon,
                  color: "text-muted-foreground",
                };

                return (
                  <button
                    key={finding.id}
                    className="w-full border rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedFinding(finding)}
                  >
                    <div className="grid grid-cols-[20px_1fr_80px_60px_50px] gap-3 items-center">
                      {/* Severity icon — compact, inline */}
                      <div className={`${sevConfig.bg} p-0.5 rounded`}>
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slide-over detail panel */}
      {selectedFinding && (
        <FindingDetailSheet
          finding={selectedFinding}
          open={!!selectedFinding}
          onOpenChange={(open) => {
            if (!open) setSelectedFinding(null);
          }}
        />
      )}
    </>
  );
}
