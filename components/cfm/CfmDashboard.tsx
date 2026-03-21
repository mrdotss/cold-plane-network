"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { RepeatIcon, FileExportIcon } from "@hugeicons/core-free-icons";
import { SummaryCards } from "./SummaryCards";
import { ServiceCard } from "./ServiceCard";
import { RecommendationsTable } from "./RecommendationsTable";
import type { CfmScanSummary, CfmRecommendation } from "@/lib/cfm/types";
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
  recommendations: CfmRecommendation[];
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

export function CfmDashboard({
  account,
  accounts,
  scan,
  recommendations,
}: CfmDashboardProps) {
  const router = useRouter();
  const [rescanError, setRescanError] = useState<string | null>(null);

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

  // Zero-savings / no-scan state
  if (!summary || summary.recommendationCount === 0) {
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
              {scan
                ? "Great news — no significant optimization opportunities found."
                : "No scan results yet. Run a scan to see cost optimization recommendations."}
            </p>
            {!scan && (
              <Button size="sm" onClick={handleRescan}>
                <HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" strokeWidth={2} />
                Run Scan
              </Button>
            )}
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
      <SummaryCards summary={summary} />
      {/* Service grid */}
      {summary.serviceBreakdown.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.serviceBreakdown.map((svc) => (
            <ServiceCard
              key={svc.service}
              accountId={account.id}
              service={svc}
            />
          ))}
        </div>
      )}
      <RecommendationsTable recommendations={recommendations} />
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
        ) : (
          <span className="text-sm font-medium">{account.accountName}</span>
        )}
        {scan?.completedAt && (
          <span className="text-xs text-muted-foreground">
            Last scan: {formatDate(scan.completedAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
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
