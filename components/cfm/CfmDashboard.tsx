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
import { RepeatIcon, FileExportIcon, FilterIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { SummaryCards } from "./SummaryCards";
import { ServiceCard } from "./ServiceCard";
import { RecommendationsTable } from "./RecommendationsTable";
import { ScanHistoryView } from "./ScanHistoryView";
import { DeltaView } from "./DeltaView";
import { ScheduleConfig } from "./ScheduleConfig";
import { SavedViewsDropdown } from "@/components/views/SavedViewsDropdown";
import { SaveViewDialog } from "@/components/views/SaveViewDialog";
import { LastUpdated } from "@/components/freshness/LastUpdated";
import { LiveBadge } from "@/components/freshness/LiveBadge";
import { useScanRefreshToast } from "@/hooks/use-scan-refresh-toast";
import { useFilterState } from "@/hooks/use-filter-state";
import type {
  CfmScanSummary,
  EnrichedRecommendation,
  RecommendationLifecycleStatus,
} from "@/lib/cfm/types";
import type { CfmFilters } from "@/lib/views/types";
import type { SerializedCfmAccount } from "./CfmLanding";

/** Serialized scan shape passed from server component */
export interface SerializedCfmScan {
  id: string;
  accountId: string;
  status: string;
  summary: CfmScanSummary | null;
  completedAt: string | null;
}

interface CfmDashboardProps {
  account: SerializedCfmAccount;
  accounts: SerializedCfmAccount[];
  scan: SerializedCfmScan | null;
  recommendations: EnrichedRecommendation[];
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

const CFM_PRIORITIES = ["critical", "medium", "low"] as const;
const CFM_STATUSES: { value: RecommendationLifecycleStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "implemented", label: "Implemented" },
  { value: "verified", label: "Verified" },
];
const MIN_SAVINGS_OPTIONS = [
  { value: 10, label: "$10+" },
  { value: 50, label: "$50+" },
  { value: 100, label: "$100+" },
  { value: 500, label: "$500+" },
  { value: 1000, label: "$1,000+" },
];

export function CfmDashboard({
  account,
  accounts,
  scan,
  recommendations,
}: CfmDashboardProps) {
  const router = useRouter();
  const [rescanError, setRescanError] = useState<string | null>(null);
  const { filters, setFilter, resetFilters, hasActiveFilters, applyView } =
    useFilterState<CfmFilters>();

  useScanRefreshToast();

  const handleRescan = useCallback(async () => {
    setRescanError(null);
    try {
      const res = await fetch("/api/cfm/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      if (res.ok) {
        router.push(`/dashboard/cfm/${account.id}/scan`);
      } else {
        const body = await res.json().catch(() => ({ error: "Scan failed" }));
        setRescanError(body.error ?? "Failed to start scan. Please try again.");
      }
    } catch {
      setRescanError("Failed to start scan. Please try again.");
    }
  }, [account.id, router]);

  const handleAccountChange = useCallback(
    (accountId: string) => {
      router.push(`/dashboard/cfm/${accountId}`);
    },
    [router],
  );

  const summary = scan?.summary ?? null;

  // Derive unique service names from recommendations for the filter dropdown
  const availableServices = useMemo(() => {
    const set = new Set<string>();
    for (const rec of recommendations) {
      if (rec.service) set.add(rec.service);
    }
    return Array.from(set).sort();
  }, [recommendations]);

  // Apply filters to recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((rec) => {
      if (filters.service?.length && !filters.service.includes(rec.service)) {
        return false;
      }
      if (filters.priority?.length && !filters.priority.includes(rec.priority)) {
        return false;
      }
      if (filters.status && (rec.lifecycleStatus ?? "open") !== filters.status) {
        return false;
      }
      if (filters.minSavings != null && rec.estimatedSavings < filters.minSavings) {
        return false;
      }
      return true;
    });
  }, [recommendations, filters]);

  // Apply filters to service breakdown
  const filteredServiceBreakdown = useMemo(() => {
    if (!summary?.serviceBreakdown) return [];
    if (!filters.service?.length) return summary.serviceBreakdown;
    return summary.serviceBreakdown.filter((svc) =>
      filters.service!.includes(svc.service),
    );
  }, [summary, filters.service]);

  // Toggle helpers for multi-select
  const toggleArrayFilter = useCallback(
    (key: "service" | "priority", value: string) => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setFilter(key, next.length > 0 ? next : undefined as unknown as string[]);
    },
    [filters, setFilter],
  );

  // No scan at all — show prompt to run first scan
  if (!scan) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <DashboardHeader
          account={account}
          accounts={accounts}
          scan={scan}
          onAccountChange={handleAccountChange}
          onRescan={handleRescan}
        />
        {rescanError && (
          <p className="text-xs text-destructive px-1">{rescanError}</p>
        )}
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2 text-center max-w-sm">
            <p className="text-sm text-muted-foreground">
              No scan results yet. Run a scan to see cost optimization recommendations.
            </p>
            <Button size="sm" onClick={handleRescan}>
              <HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" strokeWidth={2} />
              Run Scan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <DashboardHeader
        account={account}
        accounts={accounts}
        scan={scan}
        onAccountChange={handleAccountChange}
        onRescan={handleRescan}
      />
      {rescanError && (
        <p className="text-xs text-destructive px-1">{rescanError}</p>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="size-4 text-muted-foreground" />

        <SavedViewsDropdown feature="cfm" onApplyView={applyView} />

        {hasActiveFilters && (
          <SaveViewDialog feature="cfm" filters={filters as Record<string, unknown>} />
        )}

        {/* Service multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Service{filters.service?.length ? ` (${filters.service.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Services</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableServices.map((svc) => (
              <DropdownMenuCheckboxItem
                key={svc}
                checked={filters.service?.includes(svc) ?? false}
                onCheckedChange={() => toggleArrayFilter("service", svc)}
                onSelect={(e) => e.preventDefault()}
              >
                {svc}
              </DropdownMenuCheckboxItem>
            ))}
            {availableServices.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">No services</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Priority{filters.priority?.length ? ` (${filters.priority.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CFM_PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={filters.priority?.includes(p) ?? false}
                onCheckedChange={() => toggleArrayFilter("priority", p)}
                onSelect={(e) => e.preventDefault()}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
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
            {CFM_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Min savings select */}
        <Select
          value={filters.minSavings != null ? String(filters.minSavings) : "any"}
          onValueChange={(v) =>
            setFilter("minSavings", v === "any" ? undefined as unknown as number : Number(v))
          }
        >
          <SelectTrigger className="w-[120px] h-8 text-sm">
            <SelectValue placeholder="Min savings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any savings</SelectItem>
            {MIN_SAVINGS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History & Trends</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="flex flex-col gap-4">
            {summary && <SummaryCards summary={summary} />}
            {/* Service grid */}
            {filteredServiceBreakdown.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServiceBreakdown.map((svc) => (
                  <ServiceCard
                    key={svc.service}
                    accountId={account.id}
                    service={svc}
                  />
                ))}
              </div>
            )}
            {filteredRecommendations.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "No recommendations match the current filters."
                    : "Great news — no significant optimization opportunities found."}
                </p>
              </div>
            ) : (
              <RecommendationsTable
                recommendations={filteredRecommendations}
                accountId={account.id}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <ScanHistoryView accountId={account.id} />
        </TabsContent>

        <TabsContent value="compare">
          <DeltaView accountId={account.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Dashboard header sub-component ──────────────────────────────────────────

interface DashboardHeaderProps {
  account: SerializedCfmAccount;
  accounts: SerializedCfmAccount[];
  scan: SerializedCfmScan | null;
  onAccountChange: (accountId: string) => void;
  onRescan: () => void;
}

function DashboardHeader({
  account,
  accounts,
  scan,
  onAccountChange,
  onRescan,
}: DashboardHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        {/* Account selector */}
        {accounts.length > 1 ? (
          <div className="flex items-center gap-1.5">
            <LiveBadge completedAt={scan?.completedAt ?? null} />
            <Select value={account.id} onValueChange={onAccountChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <LiveBadge completedAt={scan?.completedAt ?? null} />
            <span className="text-sm font-medium">{account.accountName}</span>
          </div>
        )}
        <LastUpdated
          completedAt={scan?.completedAt ?? null}
          isScanning={scan?.status === "running"}
        />
      </div>
      <div className="flex items-center gap-2">
        <ScheduleConfig accountId={account.id} />
        <Button variant="outline" size="sm" onClick={onRescan}>
          <HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" strokeWidth={2} />
          Re-scan
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/cfm/${account.id}/export`)}
          disabled={!scan?.summary}
        >
          <HugeiconsIcon icon={FileExportIcon} data-icon="inline-start" strokeWidth={2} />
          Export Report
        </Button>
      </div>
    </div>
  );
}
