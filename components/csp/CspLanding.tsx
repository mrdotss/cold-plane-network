"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShieldIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { CspScanSummary } from "@/lib/csp/types";

export interface SerializedCspAccount {
  id: string;
  accountName: string;
  awsAccountId: string;
  lastScanAt: string | null;
}

export interface CspAccountWithScan {
  account: SerializedCspAccount;
  scanSummary: CspScanSummary | null;
}

interface CspLandingProps {
  accounts: CspAccountWithScan[];
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function CspLanding({ accounts }: CspLandingProps) {
  const router = useRouter();
  const [scanningId, setScanningId] = useState<string | null>(null);

  const handleStartScan = useCallback(
    async (accountId: string) => {
      setScanningId(accountId);
      try {
        const res = await fetch("/api/csp/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        if (res.ok) {
          const data = await res.json();
          router.push(`/dashboard/csp/${accountId}/scan?scanId=${data.scan.id}`);
        }
      } catch {
        // ignore
      } finally {
        setScanningId(null);
      }
    },
    [router],
  );

  if (accounts.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <HugeiconsIcon
              icon={ShieldIcon}
              strokeWidth={2}
              className="size-12 text-muted-foreground mx-auto mb-4"
            />
            <h3 className="text-lg font-medium mb-2">
              No AWS Accounts Connected
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect an AWS account in CFM Analysis first, then run a security
              posture scan here.
            </p>
            <Button onClick={() => router.push("/dashboard/cfm")}>
              Go to CFM Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CSP Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Cloud Security Posture analysis across your AWS accounts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(({ account, scanSummary }) => {
          const sb = scanSummary?.severityBreakdown;
          const total = scanSummary?.totalFindings ?? 0;

          return (
            <Card
              key={account.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-muted p-1.5 rounded-lg">
                      <HugeiconsIcon
                        icon={ShieldIcon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {account.accountName}
                      </CardTitle>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {account.awsAccountId}
                      </div>
                    </div>
                  </div>
                  {scanSummary && (
                    <div className="text-right shrink-0">
                      <span
                        className={`text-2xl font-bold ${getScoreColor(scanSummary.securityScore)}`}
                      >
                        {scanSummary.securityScore}
                      </span>
                      <div className="text-[10px] text-muted-foreground">
                        / 100
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {scanSummary && sb ? (
                  <>
                    {/* Severity bar */}
                    <div className="space-y-1.5">
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        {sb.critical > 0 && (
                          <div
                            className="bg-red-500 dark:bg-red-400"
                            style={{
                              width: `${(sb.critical / total) * 100}%`,
                            }}
                          />
                        )}
                        {sb.high > 0 && (
                          <div
                            className="bg-orange-500 dark:bg-orange-400"
                            style={{
                              width: `${(sb.high / total) * 100}%`,
                            }}
                          />
                        )}
                        {sb.medium > 0 && (
                          <div
                            className="bg-yellow-500 dark:bg-yellow-400"
                            style={{
                              width: `${(sb.medium / total) * 100}%`,
                            }}
                          />
                        )}
                        {sb.low > 0 && (
                          <div
                            className="bg-blue-400 dark:bg-blue-300"
                            style={{
                              width: `${(sb.low / total) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {sb.critical > 0 && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-[10px] px-1.5 py-0">
                            {sb.critical} Critical
                          </Badge>
                        )}
                        {sb.high > 0 && (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 text-[10px] px-1.5 py-0">
                            {sb.high} High
                          </Badge>
                        )}
                        {sb.medium > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 text-[10px] px-1.5 py-0">
                            {sb.medium} Med
                          </Badge>
                        )}
                        {sb.low > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 text-[10px] px-1.5 py-0">
                            {sb.low} Low
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {total} findings &middot; Scanned{" "}
                      {account.lastScanAt
                        ? new Date(account.lastScanAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )
                        : "never"}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground py-2">
                    No security scan yet
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={scanningId === account.id}
                    onClick={() => handleStartScan(account.id)}
                  >
                    {scanningId === account.id ? "Starting..." : "Scan"}
                  </Button>
                  {scanSummary && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        router.push(`/dashboard/csp/${account.id}`)
                      }
                    >
                      View
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-3 ml-1"
                      />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
