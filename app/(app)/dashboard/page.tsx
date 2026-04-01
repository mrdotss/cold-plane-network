import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import {
  projects,
  sizingReports,
  auditEvents,
  awsAccounts,
  cfmScans,
  cfmRecommendations,
} from "@/lib/db/schema";
import { eq, desc, count, sum, and } from "drizzle-orm";
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
    [{ projectCount }],
    [{ sizingReportCount }],
    [{ auditEventCount }],
    [{ cfmAccountCount }],
    [{ cfmScanCount }],
    recentSizingReports,
    recentAuditEvents,
    cfmSavingsResult,
  ] = await Promise.all([
    db.select({ projectCount: count() }).from(projects).where(eq(projects.createdById, userId)),
    db.select({ sizingReportCount: count() }).from(sizingReports).where(eq(sizingReports.userId, userId)),
    db.select({ auditEventCount: count() }).from(auditEvents).where(eq(auditEvents.userId, userId)),
    db.select({ cfmAccountCount: count() }).from(awsAccounts).where(eq(awsAccounts.userId, userId)),
    db.select({ cfmScanCount: count() }).from(cfmScans).where(
      and(eq(cfmScans.userId, userId), eq(cfmScans.status, "completed"))
    ),
    db
      .select()
      .from(sizingReports)
      .where(eq(sizingReports.userId, userId))
      .orderBy(desc(sizingReports.createdAt))
      .limit(5),
    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.userId, userId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(8),
    db
      .select({ totalSavings: sum(cfmRecommendations.estimatedSavings) })
      .from(cfmRecommendations)
      .innerJoin(cfmScans, eq(cfmRecommendations.scanId, cfmScans.id))
      .where(eq(cfmScans.userId, userId)),
  ]);

  const latestReport = recentSizingReports[0];

  return {
    stats: {
      projects: projectCount,
      sizingReports: sizingReportCount,
      auditEvents: auditEventCount,
      totalMonthlyEstimate: latestReport?.totalMonthly ?? 0,
      cfmAccounts: cfmAccountCount,
      cfmScans: cfmScanCount,
      cfmTotalSavings: Number(cfmSavingsResult[0]?.totalSavings ?? 0),
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
