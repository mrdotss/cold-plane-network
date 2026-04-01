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
import { CfmLanding } from "@/components/cfm/CfmLanding";
import type { SerializedAccountWithScan } from "@/components/cfm/CfmLanding";
import { getAccountsByUser, getLatestScanForAccount } from "@/lib/cfm/queries";
import { getGroupsByUser } from "@/lib/cfm/group-queries";
import { requireAuth } from "@/lib/auth/middleware";
import { redirect } from "next/navigation";
import type { CfmScanSummary } from "@/lib/cfm/types";

export default async function CfmPage() {
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch {
    redirect("/login");
  }

  const [accounts, groups] = await Promise.all([
    getAccountsByUser(userId),
    getGroupsByUser(userId),
  ]);

  // Serialize Date objects to ISO strings for the client component boundary
  const accountsWithScans: SerializedAccountWithScan[] = await Promise.all(
    accounts.map(async (account) => {
      const latestScan = await getLatestScanForAccount(account.id);
      const scanSummary = (latestScan?.summary as CfmScanSummary | null) ?? null;
      return {
        account: {
          id: account.id,
          userId: account.userId,
          accountName: account.accountName,
          awsAccountId: account.awsAccountId,
          roleArn: account.roleArn,
          externalId: account.externalId,
          regions: account.regions as string[],
          services: account.services as string[],
          groupId: (account.groupId as string | null) ?? null,
          lastScanAt: account.lastScanAt?.toISOString() ?? null,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
        },
        totalSavings: scanSummary?.totalPotentialSavings ?? 0,
        scanSummary,
      };
    })
  );

  const serializedGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    color: g.color,
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
              <BreadcrumbItem>
                <BreadcrumbPage>CFM Analysis</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="min-w-[1280px]">
        <CfmLanding
          initialAccounts={accountsWithScans}
          initialGroups={serializedGroups}
        />
      </div>
    </>
  );
}
