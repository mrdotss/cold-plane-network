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
  getLatestScanForAccount,
  getRecommendationsByService,
} from "@/lib/cfm/queries";
import { redirect } from "next/navigation";
import { ServiceDeepDive } from "@/components/cfm/ServiceDeepDive";
import type { CfmRecommendation } from "@/lib/cfm/types";

interface ServiceDeepDivePageProps {
  params: Promise<{ accountId: string; service: string }>;
}

export default async function ServiceDeepDivePage({ params }: ServiceDeepDivePageProps) {
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch {
    redirect("/login");
  }

  const { accountId, service } = await params;
  const decodedService = decodeURIComponent(service);

  const account = await getAccountById(accountId, userId);
  if (!account) {
    redirect("/dashboard/cfm");
  }

  const latestScan = await getLatestScanForAccount(accountId);
  if (!latestScan || latestScan.status !== "completed") {
    redirect(`/dashboard/cfm/${accountId}`);
  }

  const rawRecs = await getRecommendationsByService(latestScan.id, decodedService);
  const recommendations: CfmRecommendation[] = rawRecs.map((r) => ({
    id: r.id,
    scanId: r.scanId,
    service: r.service,
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    priority: r.priority as CfmRecommendation["priority"],
    recommendation: r.recommendation,
    currentCost: Number(r.currentCost),
    estimatedSavings: Number(r.estimatedSavings),
    effort: r.effort as CfmRecommendation["effort"],
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt,
  }));

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
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/dashboard/cfm/${accountId}`}>
                  {account.accountName}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{decodedService}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex-1 p-4 min-w-[1280px]">
        <ServiceDeepDive
          accountId={accountId}
          accountName={account.accountName}
          awsAccountId={account.awsAccountId}
          service={decodedService}
          regions={account.regions as string[]}
          scanId={latestScan.id}
          azureConversationId={latestScan.azureConversationId}
          recommendations={recommendations}
        />
      </div>
    </>
  );
}
