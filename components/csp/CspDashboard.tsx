"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import { RepeatIcon } from "@hugeicons/core-free-icons";
import { SecurityScoreCard } from "./SecurityScoreCard";
import { SeverityCards } from "./SeverityCards";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { TopFindings } from "./TopFindings";
import { FindingsTable } from "./FindingsTable";
import type { EnrichedCspFinding } from "./FindingsTable";
import type { CspScanSummary, CspCategory } from "@/lib/csp/types";
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

export function CspDashboard({
  account,
  scan,
  findings,
}: CspDashboardProps) {
  const router = useRouter();
  const [rescanError, setRescanError] = useState<string | null>(null);

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

  if (!scan || !scan.summary) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{account.accountName}</h1>
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
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
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
          <h1 className="text-2xl font-bold">{account.accountName}</h1>
          <p className="text-sm text-muted-foreground">
            {account.awsAccountId} &middot; Scanned{" "}
            {formatDate(scan.completedAt)}
          </p>
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
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
          {rescanError}
        </div>
      )}

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
            findings={findings}
          />

          {/* Top Issues */}
          {findings.length > 0 && <TopFindings findings={findings} />}
        </TabsContent>

        <TabsContent value="findings">
          <FindingsTable findings={findings} accountId={account.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
