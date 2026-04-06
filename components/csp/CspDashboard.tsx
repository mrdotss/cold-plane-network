"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import { RepeatIcon, FilterIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { SecurityScoreCard } from "./SecurityScoreCard";
import { SeverityCards } from "./SeverityCards";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { TopFindings } from "./TopFindings";
import { FindingsTable } from "./FindingsTable";
import { SavedViewsDropdown } from "@/components/views/SavedViewsDropdown";
import { SaveViewDialog } from "@/components/views/SaveViewDialog";
import { LastUpdated } from "@/components/freshness/LastUpdated";
import { LiveBadge } from "@/components/freshness/LiveBadge";
import { useScanRefreshToast } from "@/hooks/use-scan-refresh-toast";
import { useFilterState } from "@/hooks/use-filter-state";
import type { EnrichedCspFinding } from "./FindingsTable";
import type { CspScanSummary } from "@/lib/csp/types";
import { CSP_CATEGORIES } from "@/lib/csp/types";
import type { CspFilters } from "@/lib/views/types";
import type { SerializedCspAccount } from "./CspLanding";

export interface SerializedCspScan {
  id: string;
  accountId: string;
  status: string;
  summary: CspScanSummary | null;
  completedAt: string | null;
}

interface CspDashboardProps {
  account: SerializedCspAccount;
  scan: SerializedCspScan | null;
  findings: EnrichedCspFinding[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const CSP_SEVERITIES = ["critical", "high", "medium", "low"] as const;
const CSP_STATUSES: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "remediated", label: "Remediated" },
];

export function CspDashboard({
  account,
  scan,
  findings,
}: CspDashboardProps) {
  const router = useRouter();
  const [rescanError, setRescanError] = useState<string | null>(null);
  const { filters, setFilter, resetFilters, hasActiveFilters, applyView } =
    useFilterState<CspFilters>();

  useScanRefreshToast();

  const handleRescan = useCallback(async () => {
    setRescanError(null);
    try {
      const res = await fetch("/api/csp/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(
          `/dashboard/csp/${account.id}/scan?scanId=${data.scan.id}`,
        );
      } else {
        const body = await res.json().catch(() => ({ error: "Scan failed" }));
        setRescanError(
          body.error ?? "Failed to start scan. Please try again.",
        );
      }
    } catch {
      setRescanError("Failed to start scan. Please try again.");
    }
  }, [account.id, router]);

  // Toggle helpers for multi-select
  const toggleArrayFilter = useCallback(
    (key: "severity" | "category", value: string) => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setFilter(key, next.length > 0 ? next : undefined as unknown as string[]);
    },
    [filters, setFilter],
  );

  // Apply filters to findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (filters.severity?.length && !filters.severity.includes(f.severity)) {
        return false;
      }
      if (filters.category?.length && !filters.category.includes(f.category)) {
        return false;
      }
      if (filters.status && (f.lifecycleStatus ?? "open") !== filters.status) {
        return false;
      }
      return true;
    });
  }, [findings, filters]);

  if (!scan || !scan.summary) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <LiveBadge completedAt={null} />
              <h1 className="text-2xl font-bold">{account.accountName}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {account.awsAccountId}
            </p>
          </div>
          <Button onClick={handleRescan}>
            <HugeiconsIcon
              icon={RepeatIcon}
              strokeWidth={2}
              className="size-4 mr-2"
            />
            Run Security Scan
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No completed security scan. Run a scan to analyze your security
          posture.
        </div>
        {rescanError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            {rescanError}
          </div>
        )}
      </div>
    );
  }

  const summary = scan.summary;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <LiveBadge completedAt={scan.completedAt} />
            <h1 className="text-2xl font-bold">{account.accountName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {account.awsAccountId}
            </p>
            <span className="text-muted-foreground">&middot;</span>
            <LastUpdated
              completedAt={scan.completedAt}
              isScanning={scan.status === "running"}
            />
          </div>
        </div>
        <Button onClick={handleRescan}>
          <HugeiconsIcon
            icon={RepeatIcon}
            strokeWidth={2}
            className="size-4 mr-2"
          />
          Re-scan
        </Button>
      </div>

      {rescanError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
          {rescanError}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="size-4 text-muted-foreground" />

        <SavedViewsDropdown feature="csp" onApplyView={applyView} />

        {hasActiveFilters && (
          <SaveViewDialog feature="csp" filters={filters as Record<string, unknown>} />
        )}

        {/* Severity multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Severity{filters.severity?.length ? ` (${filters.severity.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Severity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CSP_SEVERITIES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.severity?.includes(s) ?? false}
                onCheckedChange={() => toggleArrayFilter("severity", s)}
                onSelect={(e) => e.preventDefault()}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Category multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Category{filters.category?.length ? ` (${filters.category.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CSP_CATEGORIES.map((cat) => (
              <DropdownMenuCheckboxItem
                key={cat.id}
                checked={filters.category?.includes(cat.id) ?? false}
                onCheckedChange={() => toggleArrayFilter("category", cat.id)}
                onSelect={(e) => e.preventDefault()}
              >
                {cat.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status single-select */}
        <Select
          value={filters.status ?? "all"}
          onValueChange={(v) => setFilter("status", v === "all" ? undefined as unknown as string : v)}
        >
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CSP_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Score + Severity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SecurityScoreCard
              score={summary.securityScore}
              totalFindings={summary.totalFindings}
              severityBreakdown={summary.severityBreakdown}
            />
            <div className="lg:col-span-2">
              <SeverityCards severityBreakdown={summary.severityBreakdown} />
            </div>
          </div>

          {/* Category Breakdown */}
          <CategoryBreakdown
            categoryBreakdown={summary.categoryBreakdown}
            totalFindings={summary.totalFindings}
            findings={filteredFindings}
          />

          {/* Top Issues */}
          {filteredFindings.length > 0 && <TopFindings findings={filteredFindings} />}
        </TabsContent>

        <TabsContent value="findings">
          <FindingsTable findings={filteredFindings} accountId={account.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
