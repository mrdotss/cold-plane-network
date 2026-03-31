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
import {
  getAccountById,
  getAccountsByUser,
  getLatestScanForAccount,
  getEnrichedRecommendations,
  getScanByIdForAccount,
} from "@/lib/cfm/queries";
import { redirect } from "next/navigation";
import { CfmDashboard } from "@/components/cfm/CfmDashboard";
import type {
  CfmScanSummary,
  EnrichedRecommendation,
  RecommendationLifecycleStatus,
} from "@/lib/cfm/types";

interface AccountDashboardPageProps {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ scan?: string }>;
}

export default async function AccountDashboardPage({
  params,
  searchParams,
}: AccountDashboardPageProps) {
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch {
    redirect("/login");
  }

  const { accountId } = await params;
  const { scan: scanIdParam } = await searchParams;
  const account = await getAccountById(accountId, userId);

  if (!account) {
    redirect("/dashboard/cfm");
  }

  // Fetch all user accounts for the account selector
  const allAccounts = await getAccountsByUser(userId);

  // Fetch the requested scan (by param) or the latest scan
  let targetScan;
  if (scanIdParam) {
    // Historical view: load a specific scan
    targetScan = await getScanByIdForAccount(scanIdParam, accountId, userId);
    // Fall back to latest if param scan not found
    if (!targetScan) {
      targetScan = await getLatestScanForAccount(accountId);
    }
  } else {
    targetScan = await getLatestScanForAccount(accountId);
  }

  // Fetch enriched recommendations (with lifecycle data)
  const recommendations: EnrichedRecommendation[] = targetScan
    ? (await getEnrichedRecommendations(targetScan.id, accountId)).map(
        (r) => ({
          id: r.id,
          scanId: r.scanId,
          service: r.service,
          resourceId: r.resourceId,
          resourceName: r.resourceName,
          priority: r.priority as EnrichedRecommendation["priority"],
          recommendation: r.recommendation,
          currentCost: Number(r.currentCost),
          estimatedSavings: Number(r.estimatedSavings),
          effort: r.effort as EnrichedRecommendation["effort"],
          metadata: (r.metadata ?? {}) as Record<string, unknown>,
          createdAt: r.createdAt,
          lifecycleStatus:
            (r.lifecycleStatus as RecommendationLifecycleStatus) ?? "open",
          trackingId: r.trackingId ?? null,
          acknowledgedAt: r.acknowledgedAt ?? null,
          implementedAt: r.implementedAt ?? null,
          verifiedAt: r.verifiedAt ?? null,
          notes: r.notes ?? null,
        }),
      )
    : [];

  // Serialize for client component boundary
  const serializedAccount = {
    id: account.id,
    userId: account.userId,
    accountName: account.accountName,
    awsAccountId: account.awsAccountId,
    roleArn: account.roleArn,
    externalId: account.externalId,
    regions: account.regions as string[],
    services: account.services as string[],
    lastScanAt: account.lastScanAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };

  const serializedAccounts = allAccounts.map((a) => ({
    id: a.id,
    userId: a.userId,
    accountName: a.accountName,
    awsAccountId: a.awsAccountId,
    roleArn: a.roleArn,
    externalId: a.externalId,
    regions: a.regions as string[],
    services: a.services as string[],
    lastScanAt: a.lastScanAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  const serializedScan = targetScan
    ? {
        id: targetScan.id,
        accountId: targetScan.accountId,
        status: targetScan.status,
        summary: (targetScan.summary as CfmScanSummary) ?? null,
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
                <BreadcrumbLink href="/dashboard/cfm">CFM Analysis</BreadcrumbLink>
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
        <CfmDashboard
          account={serializedAccount}
          accounts={serializedAccounts}
          scan={serializedScan}
          recommendations={recommendations}
        />
      </div>
    </>
  );
}
