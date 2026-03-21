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
import { ScanProgress } from "@/components/cfm/ScanProgress";

interface ScanPageProps {
  params: Promise<{ accountId: string }>;
}

export default async function ScanPage({ params }: ScanPageProps) {
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

  // Get the latest scan — the landing page or re-analyze action
  // should have already created one via POST /api/cfm/scans
  const latestScan = await getLatestScanForAccount(accountId);

  // If no scan exists or the latest scan is already terminal, redirect to dashboard
  if (!latestScan || latestScan.status === "completed" || latestScan.status === "failed") {
    redirect(`/dashboard/cfm/${accountId}`);
  }

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
                <BreadcrumbPage>Scanning — {account.accountName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <ScanProgress
        scanId={latestScan.id}
        accountId={accountId}
        services={account.services as string[]}
      />
    </>
  );
}
