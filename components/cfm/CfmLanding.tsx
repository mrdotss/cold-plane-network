"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AccountCard } from "./AccountCard";
import { AccountWizard } from "./AccountWizard";
import { CfmErrorState } from "./CfmStates";
import { AggregatedSummary } from "./AggregatedSummary";
import {
  AccountGroupManager,
  type AccountGroup,
} from "./AccountGroupManager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, AiInnovation01Icon } from "@hugeicons/core-free-icons";
import type { CfmScanSummary } from "@/lib/cfm/types";

// ─── Serialized types for server→client boundary ─────────────────────────────

/** Account shape with ISO string dates (serialized from server component) */
export interface SerializedCfmAccount {
  id: string;
  userId: string;
  accountName: string;
  awsAccountId: string;
  roleArn: string;
  externalId: string | null;
  regions: string[];
  services: string[];
  groupId: string | null;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedAccountWithScan {
  account: SerializedCfmAccount;
  totalSavings: number;
  scanSummary: CfmScanSummary | null;
}

interface CfmLandingProps {
  initialAccounts: SerializedAccountWithScan[];
  initialGroups: AccountGroup[];
}

export function CfmLanding({ initialAccounts, initialGroups }: CfmLandingProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SerializedAccountWithScan[]>(initialAccounts);
  const [groups, setGroups] = useState<AccountGroup[]>(initialGroups);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("all");

  // Aggregated stats across all accounts
  const aggregatedStats = useMemo(() => {
    let totalMonthlySpend = 0;
    let totalPotentialSavings = 0;
    let totalRecommendations = 0;
    let totalCritical = 0;

    for (const { scanSummary } of accounts) {
      if (scanSummary) {
        totalMonthlySpend += scanSummary.totalMonthlySpend;
        totalPotentialSavings += scanSummary.totalPotentialSavings;
        totalRecommendations += scanSummary.recommendationCount;
        totalCritical += scanSummary.priorityBreakdown?.critical ?? 0;
      }
    }

    return {
      totalAccounts: accounts.length,
      totalMonthlySpend,
      totalPotentialSavings,
      totalRecommendations,
      totalCritical,
    };
  }, [accounts]);

  // Filter accounts by group
  const filteredAccounts = useMemo(() => {
    if (activeGroup === "all") return accounts;
    if (activeGroup === "ungrouped") {
      return accounts.filter((a) => !a.account.groupId);
    }
    return accounts.filter((a) => a.account.groupId === activeGroup);
  }, [accounts, activeGroup]);

  const handleAccountCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleGroupsChanged = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleReanalyze = useCallback(async (accountId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/cfm/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        router.push(`/dashboard/cfm/${accountId}/scan`);
      } else {
        const body = await res.json().catch(() => ({ error: "Scan failed" }));
        setError(body.error ?? "Failed to start scan. Please try again.");
      }
    } catch {
      setError("Failed to start scan. Please try again.");
    }
  }, [router]);

  const handleEdit = useCallback((accountId: string) => {
    router.push(`/dashboard/cfm/${accountId}`);
  }, [router]);

  const handleDelete = useCallback(async (accountId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/cfm/accounts/${accountId}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.account.id !== accountId));
      } else {
        setError("Failed to delete account. Please try again.");
      }
    } catch {
      setError("Failed to delete account. Please try again.");
    }
  }, []);

  if (accounts.length === 0) {
    return (
      <>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <HugeiconsIcon
              icon={AiInnovation01Icon}
              strokeWidth={1.5}
              className="size-12 text-muted-foreground"
            />
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-medium">No accounts connected</h2>
              <p className="text-sm text-muted-foreground">
                Connect an AWS account to start analyzing cost optimization opportunities.
              </p>
            </div>
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" strokeWidth={2} />
              Add Account
            </Button>
          </div>
        </div>
        <AccountWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onAccountCreated={handleAccountCreated}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        {error && (
          <CfmErrorState
            message={error}
            onRetry={() => setError(null)}
            retryLabel="Dismiss"
          />
        )}

        {/* Aggregated metrics */}
        <AggregatedSummary stats={aggregatedStats} />

        {/* Header with groups and add button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-medium">Connected Accounts</h2>
            <AccountGroupManager
              groups={groups}
              onGroupsChanged={handleGroupsChanged}
            />
          </div>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" strokeWidth={2} />
            Add Account
          </Button>
        </div>

        {/* Group filter tabs */}
        {groups.length > 0 && (
          <Tabs value={activeGroup} onValueChange={setActiveGroup}>
            <TabsList>
              <TabsTrigger value="all">All ({accounts.length})</TabsTrigger>
              {groups.map((g) => {
                const count = accounts.filter(
                  (a) => a.account.groupId === g.id,
                ).length;
                return (
                  <TabsTrigger key={g.id} value={g.id}>
                    <span
                      className="mr-1.5 inline-block size-2 rounded-full"
                      style={{ backgroundColor: g.color ?? "#888" }}
                    />
                    {g.name} ({count})
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="ungrouped">
                Ungrouped (
                {accounts.filter((a) => !a.account.groupId).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Account cards grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map(({ account, totalSavings }) => (
            <AccountCard
              key={account.id}
              account={account}
              totalSavings={totalSavings}
              onReanalyze={handleReanalyze}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
      <AccountWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onAccountCreated={handleAccountCreated}
      />
    </>
  );
}
