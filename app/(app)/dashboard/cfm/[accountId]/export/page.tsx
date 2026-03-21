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
import { getAccountById, getLatestScanForAccount } from "@/lib/cfm/queries";
import { redirect } from "next/navigation";
import { ExportDialog } from "@/components/cfm/ExportDialog";
import type { CfmScanSummary } from "@/lib/cfm/types";

interface ExportPageProps {
  params: Promise<{ accountId: string }>;
}

export default async function ExportPage({ params }: ExportPageProps) {
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
    redirect("/dashboard/cfm");
  }

  const latestScan = await getLatestScanForAccount(accountId);

  if (!latestScan || latestScan.status !== "completed") {
    redirect(`/dashboard/cfm/${accountId}`);
  }

  const summary = latestScan.summary as CfmScanSummary | null;
  const serviceCount = summary?.serviceBreakdown.length ?? 0;

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
                <BreadcrumbPage>Export Report</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="p-4">
        <h2 className="text-lg font-medium mb-4">Export Report</h2>
        <ExportDialog
          scanId={latestScan.id}
          accountName={account.accountName}
          serviceCount={serviceCount}
        />
      </div>
    </>
  );
}
