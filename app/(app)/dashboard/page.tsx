import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

const SESSION_COOKIE_NAME = "session_token";

async function getDashboardData(userId: string) {
  const [
    projectCount,
    sizingReportCount,
    auditEventCount,
    recentSizingReports,
    recentAuditEvents,
  ] = await Promise.all([
    prisma.project.count({ where: { createdById: userId } }),
    prisma.sizingReport.count({ where: { userId } }),
    prisma.auditEvent.count({ where: { userId } }),
    prisma.sizingReport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.auditEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const latestReport = recentSizingReports[0];

  return {
    stats: {
      projects: projectCount,
      sizingReports: sizingReportCount,
      auditEvents: auditEventCount,
      totalMonthlyEstimate: latestReport?.totalMonthly ?? 0,
    },
    recentSizingReports: recentSizingReports.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      reportType: r.reportType,
      totalMonthly: r.totalMonthly,
      serviceCount: r.serviceCount,
      createdAt: r.createdAt.toISOString(),
    })),
    recentAuditEvents: recentAuditEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const session = await validateSession(token);
  if (!session) redirect("/login");

  const data = await getDashboardData(session.userId);

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
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <DashboardContent data={data} />
    </>
  );
}
