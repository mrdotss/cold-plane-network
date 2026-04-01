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
import { CspLanding } from "@/components/csp/CspLanding";
import type { CspAccountWithScan } from "@/components/csp/CspLanding";
import { getAccountsByUser } from "@/lib/cfm/queries";
import { getLatestCspScanForAccount } from "@/lib/csp/queries";
import { requireAuth } from "@/lib/auth/middleware";
import { redirect } from "next/navigation";
import type { CspScanSummary } from "@/lib/csp/types";

export default async function CspPage() {
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch {
    redirect("/login");
  }

  const accounts = await getAccountsByUser(userId);

  const accountsWithScans: CspAccountWithScan[] = await Promise.all(
    accounts.map(async (account) => {
      const latestScan = await getLatestCspScanForAccount(account.id);
      const scanSummary =
        (latestScan?.summary as CspScanSummary | null) ?? null;
      return {
        account: {
          id: account.id,
          accountName: account.accountName,
          awsAccountId: account.awsAccountId,
          lastScanAt: account.lastScanAt?.toISOString() ?? null,
        },
        scanSummary,
      };
    }),
  );

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
                <BreadcrumbPage>CSP Analysis</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="min-w-[1280px]">
        <CspLanding accounts={accountsWithScans} />
      </div>
    </>
  );
}
