import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/dashboard — Aggregated dashboard stats for the authenticated user.
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

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
        take: 10,
      }),
    ]);

    // Compute total monthly estimate from latest sizing report
    const latestReport = recentSizingReports[0];
    const totalMonthlyEstimate = latestReport?.totalMonthly ?? 0;

    // Count sizing reports by type
    const reportsByType = recentSizingReports.reduce(
      (acc, r) => {
        acc[r.reportType] = (acc[r.reportType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      stats: {
        projects: projectCount,
        sizingReports: sizingReportCount,
        auditEvents: auditEventCount,
        totalMonthlyEstimate,
        reportsByType,
      },
      recentSizingReports,
      recentAuditEvents,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
