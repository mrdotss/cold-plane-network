import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db/client";
import { projects, sizingReports, auditEvents } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

/**
 * GET /api/dashboard — Aggregated dashboard stats for the authenticated user.
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    const [
      [{ projectCount }],
      [{ sizingReportCount }],
      [{ auditEventCount }],
      recentSizingReports,
      recentAuditEvents,
    ] = await Promise.all([
      db.select({ projectCount: count() }).from(projects).where(eq(projects.createdById, userId)),
      db.select({ sizingReportCount: count() }).from(sizingReports).where(eq(sizingReports.userId, userId)),
      db.select({ auditEventCount: count() }).from(auditEvents).where(eq(auditEvents.userId, userId)),
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
        .limit(10),
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
