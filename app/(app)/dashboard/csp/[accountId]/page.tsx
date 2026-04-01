import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth/middleware";
import { getAccountById } from "@/lib/cfm/queries";
import {
  getLatestCspScanForAccount,
  getEnrichedCspFindings,
} from "@/lib/csp/queries";
import { redirect } from "next/navigation";
import { CspDashboard } from "@/components/csp/CspDashboard";
import type { CspScanSummary } from "@/lib/csp/types";
import type { EnrichedCspFinding } from "@/components/csp/FindingsTable";

interface CspAccountPageProps {
  params: Promise<{ accountId: string }>;
}

export default async function CspAccountPage({
  params,
}: CspAccountPageProps) {
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch {
    redirect("/login");
  }

  const { accountId } = await params;
  const account = await getAccountById(accountId, userId);

  if (!account) {
    redirect("/dashboard/csp");
  }

  const targetScan = await getLatestCspScanForAccount(accountId);

  const findings: EnrichedCspFinding[] = targetScan
    ? (await getEnrichedCspFindings(targetScan.id, accountId)).map((r) => ({
        id: r.id,
        scanId: r.scanId,
        category: r.category,
        service: r.service,
        resourceId: r.resourceId,
        resourceName: r.resourceName,
        severity: r.severity,
        finding: r.finding,
        remediation: r.remediation,
        cisReference: r.cisReference,
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
        createdAt: r.createdAt,
        trackingId: r.trackingId ?? null,
        lifecycleStatus: (r.lifecycleStatus as string) ?? "open",
        acknowledgedAt: r.acknowledgedAt ?? null,
        remediatedAt: r.remediatedAt ?? null,
        notes: r.notes ?? null,
      }))
    : [];

  const serializedAccount = {
    id: account.id,
    accountName: account.accountName,
    awsAccountId: account.awsAccountId,
    lastScanAt: account.lastScanAt?.toISOString() ?? null,
  };

  const serializedScan = targetScan
    ? {
        id: targetScan.id,
        accountId: targetScan.accountId,
        status: targetScan.status,
        summary: (targetScan.summary as CspScanSummary) ?? null,
        completedAt: targetScan.completedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/csp">
                  CSP Analysis
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{account.accountName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="min-w-[1280px]">
        <CspDashboard
          account={serializedAccount}
          scan={serializedScan}
          findings={findings}
        />
      </div>
    </>
  );
}
