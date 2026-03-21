"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AccountCard } from "./AccountCard";
import { AccountWizard } from "./AccountWizard";
import { CfmErrorState } from "./CfmStates";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, AiInnovation01Icon } from "@hugeicons/core-free-icons";

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
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedAccountWithScan {
  account: SerializedCfmAccount;
  totalSavings: number;
}

interface CfmLandingProps {
  initialAccounts: SerializedAccountWithScan[];
}

export function CfmLanding({ initialAccounts }: CfmLandingProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SerializedAccountWithScan[]>(initialAccounts);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccountCreated = useCallback(() => {
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
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Connected Accounts</h2>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" strokeWidth={2} />
            Add Account
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map(({ account, totalSavings }) => (
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
